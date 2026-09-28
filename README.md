# Psicología DM-1

Sistema de **psicología clínica y evaluación** de la Sección de Sanidad del
Destacamento Militar N° 1. Misma marca, tipografía y sistema visual que la
consulta de medicina general y la clínica odontológica.

- **Baterías configurables** por la psicóloga (Rosenberg, BAI, BDI-II y
  Mini-Mult precargados; se pueden editar o crear instrumentos nuevos).
- **Enlaces para compartir**: uno personal por evaluado —WhatsApp, copiar o QR
  impreso— y, opcionalmente, uno de cohorte con PIN. Al responder, **la base
  califica y asigna el resultado a la ficha** de esa persona.
- **Convocatorias por cohorte y tipo de evaluación** (ingreso, periódica,
  post-incidente, seguimiento, selección, egreso): se arma la cohorte por
  sección, ubicación o a mano.
- **Total de evaluaciones con sus problemas identificados**, alertas de riesgo
  (ítem 9 del BDI-II, consumo de alcohol) y validez del perfil (L, F, K).
- **Estadística anónima** para el jefe de la S-4 y el Comandante: nunca ven
  un nombre.
- **Mapa cerebral 3D** (atlas AAL, 116 áreas) con las áreas asociadas a los
  problemas identificados: por persona, para toda la unidad y por problema.
- **Impresión**: informe de evaluación con perfil T, hoja de respuestas en
  papel (y captura de la hoja con teclado), lista de enlaces con QR.

React 19 + TypeScript + Vite + Tailwind 4, datos y autenticación en Supabase,
despliegue en Vercel.

---

## Qué comparte y qué no

Usa **el mismo proyecto de Supabase** (`medicina-general-dm1`,
`rqbktclippbypchkilgw`) y comparte **sólo**:

| Tabla | Para qué |
| --- | --- |
| `perfiles` (+ `auth.users`) | Las mismas cuentas y la misma contraseña en los tres sistemas. |
| `pacientes` | El mismo padrón de efectivos. Psicología sólo lo lee. |

No lee ni escribe `consultas`, `antecedentes`, `od_*` ni ninguna otra tabla
clínica. Todo lo propio lleva prefijo `ps_`:

| Tabla | Qué guarda |
| --- | --- |
| `ps_instrumentos` | Cuestionarios con su corrección completa en `definicion` (ver [docs/INSTRUMENTOS.md](docs/INSTRUMENTOS.md)) |
| `ps_baterias` | Qué instrumentos se aplican juntos, instrucciones y consentimiento |
| `ps_convocatorias` | Batería + cohorte + tipo + plazo; enlace de cohorte y PIN |
| `ps_aplicaciones` | Una batería para una persona: su enlace (token), respuestas, resultado, nivel, alerta, revisión |
| `ps_hallazgos` | Problemas identificados por escala o alerta (derivados de la calificación) |
| `ps_problemas` | Catálogo de problemas y sus áreas cerebrales (AAL) |
| `ps_notas` | Notas de la psicóloga: entrevista, seguimiento, devolución, referencia |

Migraciones en `supabase/migraciones/` (30–33), **ya aplicadas** en el
proyecto. Son aditivas: el único cambio sobre lo compartido son dos valores
nuevos del tipo `rol_usuario` (`psicologo`, `comandante`).

## Quién ve qué

| Rol | En psicología |
| --- | --- |
| `psicologo` | Todo, con nombre y apellido. Configura baterías, instrumentos, problemas y convocatorias. |
| `admin_s4`, `comandante` | Sólo **Estadísticas**: cifras agregadas, sin nombres. |
| Resto (`admin_medico`, `asistente`, `lectura`) | Sin acceso al módulo. |

Lo impone **la base**, no la pantalla:

- RLS en todas las tablas `ps_*`: con nombre, sólo `ps_es_psicologo()`.
- La S-4 y el Comandante leen `ps_estadisticas()` (security definer), que sólo
  devuelve agregados, funde las secciones de menos de 5 evaluados en «Otras» y,
  si el filtro deja menos de 5 evaluados, entrega únicamente los totales.
- El visitante del enlace es anónimo y **no tiene permisos sobre ninguna tabla**:
  sólo llama a `ps_publico_abrir`, `ps_publico_identificar` y
  `ps_publico_guardar`. Nunca recibe claves de corrección ni puntos de corte, y
  la calificación la hace `ps_calificar` en la base: no se puede alterar desde
  el navegador.
- `admin-cuentas` (función compartida) trata `psicologo` y `comandante` como
  cuentas reservadas: sólo `admin_medico` las crea, cambia o restablece. Sin
  eso, la S-4 podría restablecer la clave de la psicóloga y entrar con su cuenta.

### Cuentas creadas

| Cuenta | Persona | Rol |
| --- | --- | --- |
| `erika@dm1.sv` | Psicóloga Erika Dolores Serrano López (N.º 571, Sección de Sanidad) | `psicologo` |
| `comandante@dm1.sv` | Cnel. Cab. DEM Roberto Belarmino Guevara Bardales, Comandante del DM-1 | `comandante` |

Las dos nacen con **contraseña provisional** que se entrega en persona; el
sistema obliga a cambiarla en el primer ingreso. El jefe de la S-4 entra con su
cuenta de siempre (`alex@dm1.sv`).

## El recorrido

1. **Baterías / Instrumentos / Problemas y áreas** — la psicóloga ajusta lo que
   considere: puntos de corte, normas T, alertas, consentimiento, áreas.
2. **Convocatorias → Nueva** — nombre, tipo de evaluación, batería, plazo y
   cohorte (secciones, ubicaciones, personas sueltas). Nacen los enlaces.
3. **Repartir** — imprimir con QR, copiar la lista, CSV para envío masivo,
   WhatsApp por persona, o el enlace de cohorte con PIN.
4. **Responder** — el efectivo abre `/e/<token>` en su teléfono, acepta el
   consentimiento y responde; se guarda al pasar de página y en el teléfono.
5. **Calificar** — al enviar, la base califica, registra hallazgos y alertas.
6. **Revisar** — tablero con alertas y pendientes; ficha con resultados, perfil,
   mapa cerebral, notas; imprimir informe; marcar revisada.
7. **Mando** — la S-4 y el Comandante ven Estadísticas.

Sin teléfono: «Imprimir hoja en blanco» y luego «Capturar hoja en papel» en la
ficha (teclado: 1–7 alternativa, V/F).

## Desarrollo

```bash
npm install
npm run dev
```

Variables (opcionales; hay valores públicos por defecto): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`. La clave es publicable; la protección es RLS.

- `npm run semilla` — regenera `supabase/migraciones/32_instrumentos_iniciales.sql`
  y `supabase/semillas/*.json` desde `herramientas/semilla.py`.
- `python3 herramientas/cerebro/construir.py <aal.mz3>` — regenera
  `public/cerebro/aal.bin` (instrucciones en el propio archivo).

## Despliegue

Vercel, `npm run build`, salida `dist/`. `vercel.json` reescribe las rutas a
`index.html` (incluidas las de `/e/…`). Si cambia el dominio, actualice las
etiquetas `og:` de `index.html`: son la tarjeta que se ve al pegar un enlace en
WhatsApp.

## Referencias y licencias

Ver [docs/CREDITOS.md](docs/CREDITOS.md). En resumen: malla del atlas AAL vía
NiiVue (BSD-2-Clause); ítems, clave y normas del Mini-Mult tomados como datos
de `vilnar/quiz` (sistema de evaluación psicológica militar, GPL-2.0) y
traducidos; Rosenberg, BAI y BDI-II desde las hojas de respuesta de la clínica.
