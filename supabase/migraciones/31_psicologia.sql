-- ============================================================================
-- 31 · MÓDULO DE PSICOLOGÍA
-- ----------------------------------------------------------------------------
-- Vive en el MISMO proyecto de Supabase que medicina general y odontología y
-- comparte con ellas sólo lo imprescindible:
--
--   · `perfiles`  — las mismas cuentas (autenticación) y roles.
--   · `pacientes` — el mismo padrón de efectivos.
--
-- No lee ni escribe ninguna otra tabla clínica (`consultas`, `antecedentes`,
-- `od_*`…). Todo lo psicológico lleva el prefijo `ps_` y es aditivo: nada de
-- esta migración modifica ni borra una tabla existente.
--
-- EL PRINCIPIO DE ACCESO
--   · Con nombre y apellido: sólo el rol `psicologo`. Ni la médica, ni el
--     odontólogo, ni el jefe de la S-4, ni el Comandante leen una fila `ps_*`.
--   · Sin nombres: `ps_estadisticas()` devuelve cifras agregadas —nunca un
--     identificador de persona— a `psicologo`, `admin_s4` y `comandante`, y
--     suprime los grupos de menos de cinco evaluados para que un filtro
--     estrecho no delate a nadie.
--   · Anónimo (el enlace que se comparte): no tiene permisos sobre ninguna
--     tabla. Sólo puede llamar a tres funciones que abren, identifican y
--     guardan UNA aplicación por su ficha (token), y la calificación la hace
--     la base, no el navegador: quien responde no puede alterar su puntaje.
-- ============================================================================

-- ------------------------------------------------------------ funciones --
create or replace function public.ps_es_psicologo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol()::text = 'psicologo', false)
$$;

create or replace function public.ps_ve_estadisticas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol()::text in ('psicologo','admin_s4','comandante'), false)
$$;

-- Ficha de 24 caracteres, apta para URL: 144 bits de azar.
create or replace function public.ps_nuevo_token() returns text
language sql volatile security definer set search_path = public, extensions as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_')
$$;

-- Orden de gravedad de los niveles. `critico` es para alertas de riesgo.
create or replace function public.ps_orden_nivel(n text) returns int
language sql immutable as $$
  select case n when 'leve' then 1 when 'moderado' then 2 when 'severo' then 3 when 'critico' then 4 else 0 end
$$;

-- ---------------------------------------------------------------- tablas --

-- Instrumentos: la definición completa (ítems, opciones, escalas, puntos de
-- corte, normas y alertas) vive en `definicion`, que la psicóloga edita desde
-- la aplicación. Ver `docs/INSTRUMENTOS.md` para el formato.
create table if not exists ps_instrumentos (
  clave text primary key check (clave ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null,
  sigla text,
  autores text,
  descripcion text,
  instrucciones text,
  definicion jsonb not null,
  activo boolean not null default true,
  orden int not null default 100,
  version int not null default 1,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null
);

-- Batería: qué instrumentos se aplican juntos y en qué orden.
create table if not exists ps_baterias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  instrucciones text,
  consentimiento text,
  instrumentos text[] not null check (cardinality(instrumentos) > 0),
  -- ¿Ve quien responde un resumen de su resultado al terminar? Por defecto no:
  -- la devolución la hace la psicóloga.
  mostrar_resultado boolean not null default false,
  -- ¿Se piden escolaridad y estado civil al empezar?
  pedir_contexto boolean not null default true,
  activa boolean not null default true,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Convocatoria: una batería aplicada a una cohorte, con un tipo de evaluación
-- y un plazo. Genera una aplicación (y un enlace personal) por evaluado, y
-- opcionalmente un enlace de cohorte que pide número de padrón y PIN.
create table if not exists ps_convocatorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'periodica'
    check (tipo in ('ingreso','periodica','post_incidente','seguimiento','seleccion','egreso','otro')),
  bateria_id uuid not null references ps_baterias(id) on delete restrict,
  descripcion text,
  cohorte text,
  filtro jsonb,
  abre_en date not null default current_date,
  cierra_en date,
  estado text not null default 'abierta' check (estado in ('abierta','cerrada')),
  token_general text not null unique default public.ps_nuevo_token(),
  permite_general boolean not null default false,
  pin text not null default lpad((floor(random() * 1000000))::int::text, 6, '0'),
  intentos_fallidos int not null default 0,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);

-- Aplicación: UNA batería para UNA persona. Es lo que abre el enlace.
create table if not exists ps_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  convocatoria_id uuid references ps_convocatorias(id) on delete set null,
  bateria_id uuid not null references ps_baterias(id) on delete restrict,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  tipo text not null default 'periodica'
    check (tipo in ('ingreso','periodica','post_incidente','seguimiento','seleccion','egreso','otro')),
  token text not null unique default public.ps_nuevo_token(),
  -- individual: enlace personal · cohorte: se identificó con padrón y PIN ·
  -- presencial: la psicóloga transcribe una hoja en papel.
  origen text not null default 'individual' check (origen in ('individual','cohorte','presencial')),
  identidad_confirmada boolean not null default true,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','completada','anulada')),
  vence_en timestamptz,
  iniciada_en timestamptz,
  completada_en timestamptz,
  -- { "<instrumento>": { "<ítem>": <índice de opción> } }
  respuestas jsonb not null default '{}'::jsonb,
  contexto jsonb not null default '{}'::jsonb,
  resultados jsonb,
  calificada_en timestamptz,
  nivel_max text,
  alerta boolean not null default false,
  validez_dudosa boolean not null default false,
  revisada boolean not null default false,
  revisada_por uuid references perfiles(id) on delete set null,
  revisada_en timestamptz,
  observaciones text,
  motivo_anulacion text,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  check (pg_column_size(respuestas) < 65536),
  check (pg_column_size(contexto) < 4096)
);
create unique index if not exists ps_aplicaciones_una_por_convocatoria
  on ps_aplicaciones (convocatoria_id, paciente_id)
  where convocatoria_id is not null and estado <> 'anulada';
create index if not exists ps_aplicaciones_paciente on ps_aplicaciones (paciente_id);
create index if not exists ps_aplicaciones_estado on ps_aplicaciones (estado, completada_en);

-- Problemas identificados y las áreas cerebrales asociadas (atlas AAL).
create table if not exists ps_problemas (
  clave text primary key check (clave ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null,
  descripcion text,
  -- Áreas del atlas AAL (1–116) que la literatura asocia al problema.
  regiones int[] not null default '{}',
  explicacion text,
  color text not null default '#b8241a',
  orden int not null default 100,
  activo boolean not null default true
);

-- Hallazgos: se derivan de la calificación. Uno por escala o alerta fuera de
-- norma. Son la base del «total de evaluaciones con sus problemas».
create table if not exists ps_hallazgos (
  id bigint generated always as identity primary key,
  aplicacion_id uuid not null references ps_aplicaciones(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  instrumento text not null,
  escala text not null,
  problema text references ps_problemas(clave) on update cascade on delete set null,
  nivel text not null check (nivel in ('leve','moderado','severo','critico')),
  puntaje numeric,
  etiqueta text,
  fecha date not null default current_date
);
create index if not exists ps_hallazgos_aplicacion on ps_hallazgos (aplicacion_id);
create index if not exists ps_hallazgos_problema on ps_hallazgos (problema, fecha);

-- Notas de la psicóloga: entrevista, seguimiento, intervención, referencia.
create table if not exists ps_notas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  aplicacion_id uuid references ps_aplicaciones(id) on delete set null,
  fecha date not null default current_date,
  tipo text not null default 'seguimiento'
    check (tipo in ('entrevista','seguimiento','intervencion','devolucion','referencia','otro')),
  texto text not null,
  plan text,
  autor uuid references perfiles(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists ps_notas_paciente on ps_notas (paciente_id, fecha desc);

-- -------------------------------------------------------------- tocados --
create or replace function public.ps_tocar() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'ps_instrumentos' then
    new.actualizado_en := now();
    new.actualizado_por := auth.uid();
    if new.definicion is distinct from old.definicion then new.version := old.version + 1; end if;
  elsif tg_table_name = 'ps_baterias' then
    new.actualizado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists t_ps_instrumentos_tocar on ps_instrumentos;
create trigger t_ps_instrumentos_tocar before update on ps_instrumentos
  for each row execute function public.ps_tocar();
drop trigger if exists t_ps_baterias_tocar on ps_baterias;
create trigger t_ps_baterias_tocar before update on ps_baterias
  for each row execute function public.ps_tocar();

-- ------------------------------------------------------------------- RLS --
do $$
declare t text;
begin
  foreach t in array array['ps_instrumentos','ps_baterias','ps_convocatorias','ps_aplicaciones',
                           'ps_problemas','ps_hallazgos','ps_notas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_psicologo', t);
    execute format('create policy %I on public.%I for all to authenticated
                      using (public.ps_es_psicologo()) with check (public.ps_es_psicologo())', t || '_psicologo', t);
  end loop;
end $$;

-- El catálogo de problemas y el nombre de los instrumentos no son datos de
-- nadie: la S-4 y el Comandante los necesitan para leer sus estadísticas.
drop policy if exists ps_problemas_estadistica on ps_problemas;
create policy ps_problemas_estadistica on ps_problemas for select to authenticated
  using (public.ps_ve_estadisticas());
drop policy if exists ps_instrumentos_estadistica on ps_instrumentos;
create policy ps_instrumentos_estadistica on ps_instrumentos for select to authenticated
  using (public.ps_ve_estadisticas());

-- Los hallazgos no se escriben a mano: sólo la calificación.
revoke insert, update on ps_hallazgos from authenticated;

-- =============================================================== CALIFICAR
-- Motor genérico. Lee la `definicion` del instrumento y las respuestas
-- (índice de opción por ítem) y devuelve escalas, niveles y alertas.
--
--   escala.items       "todos" | [n, …]
--   escala.invertidos  ítems que se puntúan al revés (Likert)
--   escala.clave_v     ítems que suman 1 si se responden Verdadero (valor 1)
--   escala.clave_f     ítems que suman 1 si se responden Falso (valor 0)
--   escala.suma_k      {escala, factor, redondeo: "techo"|"normal"} (MMPI)
--   escala.t           {media, de} → T = 50 + 10·(bruta − media)/de
--   escala.usa         "bruta" | "t": sobre qué se aplican los rangos
--   escala.rangos      [{desde, hasta, nivel, etiqueta, problema}]
--   escala.validez     true: no genera hallazgo, marca validez dudosa
--   alertas            [{item, minimo, nivel, problema, mensaje}]
-- ========================================================================
create or replace function public.ps_calificar_instrumento(def jsonb, resp jsonb)
returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  it jsonb; ops jsonb; e jsonb; r jsonb; a jsonb;
  valores jsonb := '{}'::jsonb;   -- n → valor
  minimos jsonb := '{}'::jsonb;   -- n → mínimo posible
  maximos jsonb := '{}'::jsonb;   -- n → máximo posible
  brutas jsonb := '{}'::jsonb;    -- clave de escala → bruta
  escalas jsonb := '[]'::jsonb;
  alertas jsonb := '[]'::jsonb;
  n text; idx int; v numeric; bruta numeric; t numeric; valor numeric; k numeric;
  lista int[]; inv int[]; cv int[]; cf int[];
  total int := 0; respondidos int := 0; x int;
  rango jsonb;
begin
  for it in select * from jsonb_array_elements(coalesce(def->'items', '[]'::jsonb)) loop
    total := total + 1;
    n := it->>'n';
    ops := coalesce(it->'opciones', def->'opciones', '[]'::jsonb);
    select min((o->>'valor')::numeric), max((o->>'valor')::numeric) into v, bruta
      from jsonb_array_elements(ops) o;
    minimos := minimos || jsonb_build_object(n, v);
    maximos := maximos || jsonb_build_object(n, bruta);
    if resp ? n and jsonb_typeof(resp->n) = 'number' then
      idx := (resp->>n)::int;
      if idx >= 0 and idx < jsonb_array_length(ops) then
        valores := valores || jsonb_build_object(n, (ops->idx->>'valor')::numeric);
        respondidos := respondidos + 1;
      end if;
    end if;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(def->'escalas', '[]'::jsonb)) loop
    if e->'items' = '"todos"'::jsonb or e->'items' is null then
      select array_agg((el.it->>'n')::int) into lista from jsonb_array_elements(def->'items') el(it);
    else
      select array_agg(el.val::int) into lista from jsonb_array_elements_text(e->'items') el(val);
    end if;
    select coalesce(array_agg(el.val::int), '{}') into inv from jsonb_array_elements_text(coalesce(e->'invertidos', '[]')) el(val);
    select coalesce(array_agg(el.val::int), '{}') into cv from jsonb_array_elements_text(coalesce(e->'clave_v', '[]')) el(val);
    select coalesce(array_agg(el.val::int), '{}') into cf from jsonb_array_elements_text(coalesce(e->'clave_f', '[]')) el(val);

    bruta := 0;
    if cardinality(cv) > 0 or cardinality(cf) > 0 then
      foreach x in array cv loop
        if (valores->>x::text)::numeric = 1 then bruta := bruta + 1; end if;
      end loop;
      foreach x in array cf loop
        if (valores->>x::text)::numeric = 0 then bruta := bruta + 1; end if;
      end loop;
    else
      foreach x in array coalesce(lista, '{}') loop
        v := (valores->>x::text)::numeric;
        continue when v is null;
        if x = any(inv) then
          v := (minimos->>x::text)::numeric + (maximos->>x::text)::numeric - v;
        end if;
        bruta := bruta + v;
      end loop;
    end if;

    if e ? 'suma_k' then
      k := coalesce((brutas->>(e->'suma_k'->>'escala'))::numeric, 0) * (e->'suma_k'->>'factor')::numeric;
      bruta := bruta + case when e->'suma_k'->>'redondeo' = 'techo' then ceil(k) else round(k) end;
    end if;
    brutas := brutas || jsonb_build_object(e->>'clave', bruta);

    t := null;
    if e ? 't' and coalesce((e->'t'->>'de')::numeric, 0) <> 0 then
      t := round(50 + 10 * (bruta - (e->'t'->>'media')::numeric) / (e->'t'->>'de')::numeric, 1);
    end if;
    valor := case when e->>'usa' = 't' and t is not null then t else bruta end;

    rango := null;
    for r in select * from jsonb_array_elements(coalesce(e->'rangos', '[]'::jsonb)) loop
      if valor >= coalesce((r->>'desde')::numeric, '-infinity'::numeric)
         and valor <= coalesce((r->>'hasta')::numeric, 'infinity'::numeric) then
        rango := r; exit;
      end if;
    end loop;

    escalas := escalas || jsonb_build_array(jsonb_build_object(
      'clave', e->>'clave',
      'nombre', e->>'nombre',
      'bruta', bruta,
      't', t,
      'valor', valor,
      'nivel', coalesce(rango->>'nivel', 'normal'),
      'etiqueta', rango->>'etiqueta',
      'problema', rango->>'problema',
      'validez', coalesce((e->>'validez')::boolean, false)
    ));
  end loop;

  for a in select * from jsonb_array_elements(coalesce(def->'alertas', '[]'::jsonb)) loop
    v := (valores->>(a->>'item'))::numeric;
    if v is not null and v >= (a->>'minimo')::numeric then
      alertas := alertas || jsonb_build_array(a || jsonb_build_object('valor', v));
    end if;
  end loop;

  return jsonb_build_object('escalas', escalas, 'alertas', alertas,
                            'respondidos', respondidos, 'total', total);
end $$;

-- Califica una aplicación completa y reescribe sus hallazgos. Interna: la
-- llaman `ps_publico_guardar` y `ps_recalificar`, no el navegador.
create or replace function public.ps_calificar(p_aplicacion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ap ps_aplicaciones%rowtype;
  bat ps_baterias%rowtype;
  ins ps_instrumentos%rowtype;
  v_clave text; r jsonb; e jsonb; a jsonb;
  todo jsonb := '[]'::jsonb;
  nmax int := 0; hay_alerta boolean := false; dudosa boolean := false;
  fecha date;
begin
  select * into ap from ps_aplicaciones where id = p_aplicacion;
  if not found then raise exception 'Aplicación inexistente'; end if;
  select * into bat from ps_baterias where id = ap.bateria_id;
  fecha := coalesce(ap.completada_en, now())::date;

  delete from ps_hallazgos where aplicacion_id = ap.id;

  foreach v_clave in array bat.instrumentos loop
    select * into ins from ps_instrumentos where ps_instrumentos.clave = v_clave;
    continue when not found;
    r := ps_calificar_instrumento(ins.definicion, coalesce(ap.respuestas->v_clave, '{}'::jsonb));

    for e in select * from jsonb_array_elements(r->'escalas') loop
      continue when e->>'nivel' = 'normal';
      if (e->>'validez')::boolean then
        dudosa := true;
        continue;
      end if;
      nmax := greatest(nmax, ps_orden_nivel(e->>'nivel'));
      insert into ps_hallazgos (aplicacion_id, paciente_id, instrumento, escala, problema, nivel, puntaje, etiqueta, fecha)
      values (ap.id, ap.paciente_id, v_clave, e->>'clave',
              (select p.clave from ps_problemas p where p.clave = e->>'problema'),
              e->>'nivel', (e->>'valor')::numeric, e->>'etiqueta', fecha);
    end loop;

    for a in select * from jsonb_array_elements(r->'alertas') loop
      hay_alerta := hay_alerta or coalesce(a->>'nivel', 'critico') in ('severo','critico');
      nmax := greatest(nmax, ps_orden_nivel(coalesce(a->>'nivel', 'critico')));
      insert into ps_hallazgos (aplicacion_id, paciente_id, instrumento, escala, problema, nivel, puntaje, etiqueta, fecha)
      values (ap.id, ap.paciente_id, v_clave, 'item_' || (a->>'item'),
              (select p.clave from ps_problemas p where p.clave = a->>'problema'),
              coalesce(a->>'nivel', 'critico'), (a->>'valor')::numeric, a->>'mensaje', fecha);
    end loop;

    todo := todo || jsonb_build_array(r || jsonb_build_object(
      'instrumento', v_clave, 'nombre', ins.nombre, 'sigla', ins.sigla, 'version', ins.version));
  end loop;

  update ps_aplicaciones set
    resultados = jsonb_build_object('instrumentos', todo),
    calificada_en = now(),
    nivel_max = case nmax when 0 then 'normal' when 1 then 'leve' when 2 then 'moderado' when 3 then 'severo' else 'critico' end,
    alerta = hay_alerta,
    validez_dudosa = dudosa
  where id = ap.id;

  return jsonb_build_object('instrumentos', todo);
end $$;
revoke all on function public.ps_calificar(uuid) from public, anon, authenticated;
revoke all on function public.ps_calificar_instrumento(jsonb, jsonb) from public, anon;
grant execute on function public.ps_calificar_instrumento(jsonb, jsonb) to authenticated;

-- La psicóloga vuelve a calificar (tras transcribir una hoja o cambiar un
-- punto de corte).
create or replace function public.ps_recalificar(p_aplicacion uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.ps_es_psicologo() then raise exception 'Sin permiso'; end if;
  return public.ps_calificar(p_aplicacion);
end $$;
revoke all on function public.ps_recalificar(uuid) from public, anon;
grant execute on function public.ps_recalificar(uuid) to authenticated;

-- ======================================================== ENLACE PÚBLICO

-- Lo que el formulario público necesita: la batería y los ítems. NUNCA las
-- escalas, las claves ni los puntos de corte.
create or replace function public.ps_publico_instrumentos(p_bateria uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'clave', i.clave, 'nombre', i.nombre, 'sigla', i.sigla,
      'instrucciones', i.instrucciones,
      'opciones', i.definicion->'opciones',
      'items', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'n', it->'n', 'texto', it->'texto', 'grupo', it->'grupo', 'opciones', it->'opciones')))
                from jsonb_array_elements(i.definicion->'items') it)
    ) order by u.pos), '[]'::jsonb)
  from ps_baterias b
  cross join lateral unnest(b.instrumentos) with ordinality as u(clave, pos)
  join ps_instrumentos i on i.clave = u.clave
  where b.id = p_bateria
$$;
revoke all on function public.ps_publico_instrumentos(uuid) from public, anon, authenticated;

create or replace function public.ps_publico_abrir(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ap ps_aplicaciones%rowtype;
  cv ps_convocatorias%rowtype;
  bat ps_baterias%rowtype;
  pa pacientes%rowtype;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 64 then
    return jsonb_build_object('modo', 'invalido');
  end if;

  select * into ap from ps_aplicaciones where token = p_token;
  if found then
    if ap.estado = 'completada' then return jsonb_build_object('modo', 'completada'); end if;
    if ap.estado = 'anulada' then return jsonb_build_object('modo', 'invalido'); end if;
    if ap.convocatoria_id is not null then
      select * into cv from ps_convocatorias where id = ap.convocatoria_id;
      if cv.estado = 'cerrada' or (cv.cierra_en is not null and cv.cierra_en < current_date) then
        return jsonb_build_object('modo', 'vencida');
      end if;
    end if;
    if ap.vence_en is not null and ap.vence_en < now() then
      return jsonb_build_object('modo', 'vencida');
    end if;
    select * into bat from ps_baterias where id = ap.bateria_id;
    select * into pa from pacientes where id = ap.paciente_id;
    return jsonb_build_object(
      'modo', 'aplicacion',
      'estado', ap.estado,
      -- Sólo el grado y el primer nombre: lo justo para que la persona sepa
      -- que el enlace es suyo, sin publicar el nombre completo.
      'saludo', trim(coalesce(pa.grado, '') || ' ' || split_part(pa.nombre_completo, ' ', 1)),
      'bateria', jsonb_build_object('nombre', bat.nombre, 'instrucciones', bat.instrucciones,
                                    'consentimiento', bat.consentimiento, 'pedir_contexto', bat.pedir_contexto),
      'instrumentos', ps_publico_instrumentos(bat.id),
      'respuestas', ap.respuestas,
      'contexto', ap.contexto
    );
  end if;

  select * into cv from ps_convocatorias where token_general = p_token and permite_general;
  if found then
    if cv.estado = 'cerrada' or (cv.cierra_en is not null and cv.cierra_en < current_date)
       or cv.intentos_fallidos >= 40 then
      return jsonb_build_object('modo', 'vencida');
    end if;
    return jsonb_build_object('modo', 'identificar', 'convocatoria', cv.nombre);
  end if;

  return jsonb_build_object('modo', 'invalido');
end $$;

-- Enlace de cohorte: quien lo abre da su número de padrón y el PIN que la
-- psicóloga dijo en persona. Devuelve la ficha personal. La identidad queda
-- «por confirmar» hasta que la psicóloga la valide.
create or replace function public.ps_publico_identificar(p_token text, p_codigo text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cv ps_convocatorias%rowtype;
  pa pacientes%rowtype;
  ap ps_aplicaciones%rowtype;
begin
  select * into cv from ps_convocatorias where token_general = p_token and permite_general for update;
  if not found or cv.estado = 'cerrada' or (cv.cierra_en is not null and cv.cierra_en < current_date)
     or cv.intentos_fallidos >= 40 then
    return jsonb_build_object('ok', false, 'motivo', 'La convocatoria no está disponible.');
  end if;

  if coalesce(p_pin, '') <> cv.pin then
    update ps_convocatorias set intentos_fallidos = intentos_fallidos + 1 where id = cv.id;
    return jsonb_build_object('ok', false, 'motivo', 'El PIN no es correcto.');
  end if;

  select * into pa from pacientes
   where nullif(ltrim(trim(codigo), '0'), '') = nullif(ltrim(trim(p_codigo), '0'), '')
     and estado = 'activo'
   limit 1;
  if not found then
    update ps_convocatorias set intentos_fallidos = intentos_fallidos + 1 where id = cv.id;
    return jsonb_build_object('ok', false, 'motivo', 'No se encontró ese número de padrón.');
  end if;

  select * into ap from ps_aplicaciones
   where convocatoria_id = cv.id and paciente_id = pa.id and estado <> 'anulada';
  if found then
    if ap.estado = 'completada' then
      return jsonb_build_object('ok', false, 'motivo', 'Esta evaluación ya fue respondida.');
    end if;
    if ap.origen = 'individual' then
      return jsonb_build_object('ok', false, 'motivo', 'Usted tiene un enlace personal. Use ese enlace o pida uno a Psicología.');
    end if;
    return jsonb_build_object('ok', true, 'token', ap.token);
  end if;

  insert into ps_aplicaciones (convocatoria_id, bateria_id, paciente_id, tipo, origen, identidad_confirmada)
  values (cv.id, cv.bateria_id, pa.id, cv.tipo, 'cohorte', false)
  returning * into ap;
  return jsonb_build_object('ok', true, 'token', ap.token);
end $$;

create or replace function public.ps_publico_guardar(p_token text, p_respuestas jsonb, p_contexto jsonb, p_finalizar boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ap ps_aplicaciones%rowtype;
  cv ps_convocatorias%rowtype;
  bat ps_baterias%rowtype;
  ins ps_instrumentos%rowtype;
  v_clave text; limpias jsonb := '{}'::jsonb; bloque jsonb; it jsonb; ops jsonb; n text; idx int;
  faltan int := 0; res jsonb; ctx jsonb;
begin
  select * into ap from ps_aplicaciones where token = p_token for update;
  if not found or ap.estado in ('completada','anulada') then
    return jsonb_build_object('ok', false, 'motivo', 'Este enlace ya no admite respuestas.');
  end if;
  if ap.vence_en is not null and ap.vence_en < now() then
    return jsonb_build_object('ok', false, 'motivo', 'El enlace venció.');
  end if;
  if ap.convocatoria_id is not null then
    select * into cv from ps_convocatorias where id = ap.convocatoria_id;
    if cv.estado = 'cerrada' or (cv.cierra_en is not null and cv.cierra_en < current_date) then
      return jsonb_build_object('ok', false, 'motivo', 'La convocatoria está cerrada.');
    end if;
  end if;
  select * into bat from ps_baterias where id = ap.bateria_id;

  -- Sólo se guardan respuestas válidas: instrumento de la batería, ítem que
  -- existe e índice de opción dentro de rango. Lo demás se descarta.
  foreach v_clave in array bat.instrumentos loop
    select * into ins from ps_instrumentos where ps_instrumentos.clave = v_clave;
    continue when not found;
    bloque := '{}'::jsonb;
    for it in select * from jsonb_array_elements(ins.definicion->'items') loop
      n := it->>'n';
      ops := coalesce(it->'opciones', ins.definicion->'opciones', '[]'::jsonb);
      if coalesce(p_respuestas->v_clave, '{}'::jsonb) ? n
         and jsonb_typeof(p_respuestas->v_clave->n) = 'number' then
        idx := (p_respuestas->v_clave->>n)::int;
        if idx >= 0 and idx < jsonb_array_length(ops) then
          bloque := bloque || jsonb_build_object(n, idx);
        end if;
      end if;
      if not (bloque ? n) then faltan := faltan + 1; end if;
    end loop;
    limpias := limpias || jsonb_build_object(v_clave, bloque);
  end loop;

  ctx := jsonb_strip_nulls(jsonb_build_object(
    'escolaridad', left(p_contexto->>'escolaridad', 80),
    'estado_civil', left(p_contexto->>'estado_civil', 40),
    'edad', case when (p_contexto->>'edad') ~ '^\d{1,2}$' then (p_contexto->>'edad')::int end,
    'consentimiento', case when p_contexto->>'consentimiento' = 'true' then now()::text end
  ));

  update ps_aplicaciones set
    respuestas = limpias,
    contexto = contexto || ctx,
    estado = 'en_curso',
    iniciada_en = coalesce(iniciada_en, now())
  where id = ap.id;

  if not p_finalizar then
    return jsonb_build_object('ok', true, 'faltan', faltan);
  end if;
  if faltan > 0 then
    return jsonb_build_object('ok', false, 'faltan', faltan,
                              'motivo', 'Faltan ' || faltan || ' preguntas por responder.');
  end if;

  update ps_aplicaciones set estado = 'completada', completada_en = now() where id = ap.id;
  res := public.ps_calificar(ap.id);

  if bat.mostrar_resultado then
    return jsonb_build_object('ok', true, 'resumen', (
      select jsonb_agg(jsonb_build_object('instrumento', i->>'nombre',
        'escalas', (select jsonb_agg(jsonb_build_object('nombre', e->>'nombre', 'etiqueta', e->>'etiqueta'))
                    from jsonb_array_elements(i->'escalas') e where not (e->>'validez')::boolean)))
      from jsonb_array_elements(res->'instrumentos') i));
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.ps_publico_abrir(text) from public;
revoke all on function public.ps_publico_identificar(text, text, text) from public;
revoke all on function public.ps_publico_guardar(text, jsonb, jsonb, boolean) from public;
grant execute on function public.ps_publico_abrir(text) to anon, authenticated;
grant execute on function public.ps_publico_identificar(text, text, text) to anon, authenticated;
grant execute on function public.ps_publico_guardar(text, jsonb, jsonb, boolean) to anon, authenticated;

-- ============================================================ ESTADÍSTICA
-- Cifras sin nombres para la psicóloga, la S-4 y el Comandante. Los grupos de
-- menos de cinco evaluados se funden en «Otras secciones» y, si todo el filtro
-- queda por debajo de cinco evaluados, a la S-4 y al Comandante sólo se les
-- devuelven los totales: con tres personas, «una con ideación suicida» ya
-- señala a alguien.

-- Las aplicaciones que entran en el filtro. Interna: no se concede a nadie.
create or replace function public.ps__filtradas(
  p_desde date, p_hasta date, p_convocatoria uuid, p_tipo text)
returns setof ps_aplicaciones
language sql stable security definer set search_path = public as $$
  select a.* from ps_aplicaciones a
   where a.estado <> 'anulada'
     and (p_convocatoria is null or a.convocatoria_id = p_convocatoria)
     and (p_tipo is null or a.tipo = p_tipo)
     and (p_desde is null or coalesce(a.completada_en, a.creado_en)::date >= p_desde)
     and (p_hasta is null or coalesce(a.completada_en, a.creado_en)::date <= p_hasta)
$$;
revoke all on function public.ps__filtradas(date, date, uuid, text) from public, anon, authenticated;

create or replace function public.ps_estadisticas(
  p_desde date default null, p_hasta date default null,
  p_convocatoria uuid default null, p_tipo text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  minimo constant int := 5;
  n_eval int;
  salida jsonb;
begin
  if not public.ps_ve_estadisticas() then raise exception 'Sin permiso'; end if;

  select count(distinct paciente_id) into n_eval
    from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo) where estado = 'completada';

  select jsonb_build_object(
      'generado', now(),
      'minimo_grupo', minimo,
      'suficiente', n_eval >= minimo,
      'totales', jsonb_build_object(
        'aplicaciones', count(*),
        'pendientes', count(*) filter (where estado = 'pendiente'),
        'en_curso', count(*) filter (where estado = 'en_curso'),
        'completadas', count(*) filter (where estado = 'completada'),
        'evaluados', count(distinct paciente_id) filter (where estado = 'completada'),
        'con_hallazgo', count(*) filter (where estado = 'completada' and nivel_max in ('moderado','severo','critico')),
        'con_alerta', count(*) filter (where alerta),
        'validez_dudosa', count(*) filter (where validez_dudosa),
        'sin_revisar', count(*) filter (where estado = 'completada' and not revisada)))
    into salida
    from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo);

  if n_eval < minimo and not public.ps_es_psicologo() then
    return salida;
  end if;

  return salida || jsonb_build_object(
    'por_nivel', (select coalesce(jsonb_object_agg(k, c), '{}') from (
        select coalesce(nivel_max, 'normal') k, count(*) c
          from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo)
         where estado = 'completada' group by 1) s),

    'por_problema', (select coalesce(jsonb_agg(jsonb_build_object(
          'problema', p.clave, 'nombre', p.nombre, 'color', p.color, 'regiones', p.regiones,
          'personas', s.personas, 'leve', s.leve, 'moderado', s.moderado, 'severo', s.severo, 'critico', s.critico)
          order by s.personas desc, p.orden), '[]')
        from (select h.problema,
                     count(distinct h.paciente_id) personas,
                     count(distinct h.paciente_id) filter (where h.nivel = 'leve') leve,
                     count(distinct h.paciente_id) filter (where h.nivel = 'moderado') moderado,
                     count(distinct h.paciente_id) filter (where h.nivel = 'severo') severo,
                     count(distinct h.paciente_id) filter (where h.nivel = 'critico') critico
                from ps_hallazgos h
                join ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo) a on a.id = h.aplicacion_id
               where h.problema is not null and a.estado = 'completada'
               group by h.problema) s
        join ps_problemas p on p.clave = s.problema),

    'por_instrumento', (select coalesce(jsonb_agg(x order by x->>'nombre', x->>'escala'), '[]') from (
        select jsonb_build_object('instrumento', i->>'instrumento', 'nombre', i->>'nombre', 'escala', e->>'nombre',
                 'aplicados', count(*),
                 'promedio', round(avg((e->>'valor')::numeric), 1),
                 'normal', count(*) filter (where e->>'nivel' = 'normal'),
                 'leve', count(*) filter (where e->>'nivel' = 'leve'),
                 'moderado', count(*) filter (where e->>'nivel' = 'moderado'),
                 'severo', count(*) filter (where e->>'nivel' = 'severo')) x
          from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo) a
          cross join lateral jsonb_array_elements(a.resultados->'instrumentos') i
          cross join lateral jsonb_array_elements(i->'escalas') e
         where a.estado = 'completada' and not coalesce((e->>'validez')::boolean, false)
         group by i->>'instrumento', i->>'nombre', e->>'nombre') q),

    'por_seccion', (select coalesce(jsonb_agg(jsonb_build_object('seccion', seccion, 'evaluados', ev, 'con_hallazgo', ch)
                                              order by (seccion = 'Otras secciones'), ev desc), '[]')
        from (select case when ev >= minimo then seccion else 'Otras secciones' end seccion,
                     sum(ev)::int ev, sum(ch)::int ch
                from (select coalesce(p.seccion, 'Sin sección') seccion,
                             count(distinct a.paciente_id) ev,
                             count(distinct a.paciente_id) filter (where a.nivel_max in ('moderado','severo','critico')) ch
                        from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo) a
                        join pacientes p on p.id = a.paciente_id
                       where a.estado = 'completada'
                       group by 1) s0
               group by 1) s1),

    'por_mes', (select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'completadas', c, 'con_hallazgo', h) order by mes), '[]')
        from (select to_char(completada_en, 'YYYY-MM') mes, count(*) c,
                     count(*) filter (where nivel_max in ('moderado','severo','critico')) h
                from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo)
               where estado = 'completada' group by 1) s),

    'por_tipo', (select coalesce(jsonb_object_agg(tipo, c), '{}') from (
        select tipo, count(*) c from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo)
         where estado = 'completada' group by 1) s),

    'convocatorias', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'estado', c.estado, 'abre_en', c.abre_en, 'cierra_en', c.cierra_en,
          'asignadas', s.asignadas, 'completadas', s.completadas) order by c.abre_en desc), '[]')
        from ps_convocatorias c
        join (select convocatoria_id, count(*) asignadas, count(*) filter (where estado = 'completada') completadas
                from ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo)
               where convocatoria_id is not null group by 1) s on s.convocatoria_id = c.id),

    -- Peso de cada área AAL: gravedad acumulada de los hallazgos cuyo problema
    -- la involucra (leve 1 · moderado 2 · severo 3 · crítico 4).
    'regiones', (select coalesce(jsonb_object_agg(region, peso), '{}') from (
        select r region, sum(ps_orden_nivel(h.nivel)) peso
          from ps_hallazgos h
          join ps__filtradas(p_desde, p_hasta, p_convocatoria, p_tipo) a on a.id = h.aplicacion_id and a.estado = 'completada'
          join ps_problemas p on p.clave = h.problema
          cross join lateral unnest(p.regiones) r
         group by r) s)
  );
end $$;
revoke all on function public.ps_estadisticas(date, date, uuid, text) from public, anon;
grant execute on function public.ps_estadisticas(date, date, uuid, text) to authenticated;
