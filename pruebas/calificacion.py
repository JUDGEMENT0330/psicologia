#!/usr/bin/env python3
# Cotejo de la calificación: la base (ps_calificar) contra un cálculo
# independiente en Python, más las reglas de acceso (anónimo, S-4, médica).
#
#   PGURL="-h /tmp -p 5432 -U postgres -d prueba" python3 pruebas/calificacion.py
#
# Necesita una base de prueba con pruebas/stub.sql y las migraciones 30–34.
import json, os, subprocess, random, math, shlex
PG = shlex.split(os.environ.get('PGURL', '-h /tmp -p 5499 -U postgres -d t'))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def q(sql, rol=None, uid=None):
    pre = ""
    if uid: pre += f"set prueba.uid = '{uid}';"
    if rol: pre += f"set role {rol};"
    r = subprocess.run(["psql", *PG, "-At","-q","-v","ON_ERROR_STOP=1","-c", pre + sql], capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr)
    return r.stdout.strip()
PSI='11111111-1111-1111-1111-111111111111'; S4='22222222-2222-2222-2222-222222222222'; MED='33333333-3333-3333-3333-333333333333'
q(f"insert into perfiles values ('{PSI}','Psi','psicologo'),('{S4}','S4','admin_s4'),('{MED}','Med','admin_medico') on conflict do nothing")
q("insert into pacientes (codigo, grado, nombre_completo, seccion) select lpad(g::text,3,'0'), 'Sdo.', 'Persona '||g||' Apellido', case when g<=6 then 'SECCION A' else 'SECCION B' end from generate_series(1,12) g where not exists (select 1 from pacientes)")
bat = q("select id from ps_baterias where nombre='Evaluación integral'")
conv = q(f"insert into ps_convocatorias (nombre, bateria_id, permite_general) values ('Prueba', '{bat}', true) returning id", 'authenticated', PSI).splitlines()[-1]
print("conv", conv)
q(f"insert into ps_aplicaciones (convocatoria_id, bateria_id, paciente_id) select '{conv}', '{bat}', id from pacientes where codigo <= '006'", 'authenticated', PSI)
defs = {r['clave']: r for r in json.load(open(os.path.join(RAIZ, 'supabase/semillas/instrumentos.json')))}
toks = q(f"select token from ps_aplicaciones where convocatoria_id='{conv}' order by paciente_id").split()
# anon checks
ab = json.loads(q(f"select ps_publico_abrir('{toks[0]}')", 'anon'))
assert ab['modo']=='aplicacion' and 'escalas' not in json.dumps(ab) and 'clave_v' not in json.dumps(ab), ab.keys()
print('saludo', ab['saludo'], [i['clave'] for i in ab['instrumentos']])
for t in ['ps_aplicaciones','ps_instrumentos','pacientes']:
    r = subprocess.run(["psql", *PG, "-At","-q","-c", f"set role anon; select count(*) from {t}"], capture_output=True, text=True)
    print('anon lee', t, '->', 'DENEGADO' if r.returncode else r.stdout.strip())

def esperado(defn, resp):
    items = defn['items']; ops0 = defn.get('opciones')
    val = {}; mn={}; mx={}
    for it in items:
        ops = it.get('opciones') or ops0
        vs=[o['valor'] for o in ops]; mn[it['n']]=min(vs); mx[it['n']]=max(vs)
        val[it['n']] = ops[resp[str(it['n'])]]['valor']
    brutas={}; out={}
    for e in defn['escalas']:
        if e.get('clave_v') or e.get('clave_f'):
            b = sum(1 for n in e.get('clave_v',[]) if val[n]==1) + sum(1 for n in e.get('clave_f',[]) if val[n]==0)
        else:
            lista = list(val) if e.get('items', 'todos') == 'todos' else e['items']
            b = sum((mn[n]+mx[n]-val[n]) if n in e.get('invertidos',[]) else val[n] for n in lista)
        if 'suma_k' in e: b += math.ceil(brutas['K']*e['suma_k']['factor'])
        brutas[e['clave']] = b
        t = round(50+10*(b-e['t']['media'])/e['t']['de'],1) if 't' in e else None
        v = t if e.get('usa') == 't' else b
        r = next((r for r in e.get('rangos', []) if r.get('desde', -1e9) <= v <= r.get('hasta', 1e9)), {})
        out[e['clave']] = (b, t, r.get('nivel', 'normal'))
    return out

random.seed(7)
for k, tok in enumerate(toks):
    resp = {}
    for c in ['rosenberg','bai','bdi2','minimult']:
        d = defs[c]['definicion']
        resp[c] = {str(it['n']): random.randrange(len(it.get('opciones') or d['opciones'])) for it in d['items']}
    if k == 0: resp['bdi2']['9'] = 2
    if k < 5: resp['bai'] = {str(n): 3 for n in range(1,22)}
    parcial = {c: dict(list(v.items())[:3]) for c, v in resp.items()}
    r = json.loads(q(f"select ps_publico_guardar('{tok}', '{json.dumps(parcial)}'::jsonb, '{{\"escolaridad\":\"Bachillerato\",\"consentimiento\":true}}'::jsonb, true)", 'anon'))
    assert r['ok'] is False and r['faltan'] > 0, r
    malo = dict(resp); malo['hack'] = {'1': 99}
    r = json.loads(q(f"select ps_publico_guardar('{tok}', '{json.dumps(malo)}'::jsonb, '{{}}'::jsonb, true)", 'anon'))
    assert r['ok'], r
    res = json.loads(q(f"select resultados from ps_aplicaciones where token='{tok}'"))
    for ins in res['instrumentos']:
        esp = esperado(defs[ins['instrumento']]['definicion'], resp[ins['instrumento']])
        for e in ins['escalas']:
            b, t, nv = esp[e['clave']]
            assert float(e['bruta']) == b and (t is None or abs(float(e['t'])-t) < 0.051), (ins['instrumento'], e, b, t)
            assert e['nivel'] == nv, (ins['instrumento'], e, nv)
    print('ok', tok[:6], q(f"select nivel_max||' alerta='||alerta||' dudosa='||validez_dudosa from ps_aplicaciones where token='{tok}'"))
# reenviar
r = json.loads(q(f"select ps_publico_guardar('{toks[0]}', '{{}}'::jsonb, '{{}}'::jsonb, true)", 'anon')); assert not r['ok']
print('abrir completada:', json.loads(q(f"select ps_publico_abrir('{toks[0]}')", 'anon'))['modo'])
# enlace general
g, pin = q(f"select token_general||' '||pin from ps_convocatorias where id='{conv}'").split()
print('ident mal pin', q(f"select ps_publico_identificar('{g}', '007', '000000x')", 'anon'))
print('ident indiv', q(f"select ps_publico_identificar('{g}', '002', '{pin}')", 'anon'))
r = json.loads(q(f"select ps_publico_identificar('{g}', '7', '{pin}')", 'anon')); print('ident cohorte', r['ok'])
print('hallazgos', q("select problema||':'||nivel||':'||count(*) from ps_hallazgos group by problema, nivel order by 1").replace('\n',' | '))
# RLS
print('S4 lee aplicaciones:', q("select count(*) from ps_aplicaciones", 'authenticated', S4))
print('MED lee hallazgos:', q("select count(*) from ps_hallazgos", 'authenticated', MED))
print('PSI lee aplicaciones:', q("select count(*) from ps_aplicaciones", 'authenticated', PSI))
print('S4 lee problemas:', q("select count(*) from ps_problemas", 'authenticated', S4))
e = json.loads(q("select ps_estadisticas()", 'authenticated', S4))
print('S4 stats keys', sorted(e.keys()), e['totales'])
print('secciones', e.get('por_seccion'))
print('regiones n', len(e.get('regiones', {})))
assert 'Persona' not in json.dumps(e)
e2 = json.loads(q(f"select ps_estadisticas(null,null,null,'post_incidente')", 'authenticated', S4)); print('S4 filtro vacío', sorted(e2.keys()))
r = subprocess.run(["psql", *PG, "-At","-q","-c", f"set prueba.uid='{MED}'; set role authenticated; select ps_estadisticas()"], capture_output=True, text=True)
print('MED stats ->', 'DENEGADO' if r.returncode else r.stdout[:80])
r = subprocess.run(["psql", *PG, "-At","-q","-c", f"set prueba.uid='{PSI}'; set role authenticated; insert into ps_hallazgos (aplicacion_id,paciente_id,instrumento,escala,nivel) select id,paciente_id,'x','x','leve' from ps_aplicaciones limit 1"], capture_output=True, text=True)
print('PSI inserta hallazgo ->', 'DENEGADO' if r.returncode else 'PERMITIDO')
print('recalificar', q(f"select jsonb_array_length(ps_recalificar(id)->'instrumentos') from ps_aplicaciones where token='{toks[1]}'", 'authenticated', PSI))

# ---- BPS (Ryff) y ADS: contra la hoja de corrección de la clínica --------
bat2 = q("insert into ps_baterias (nombre, instrumentos) values ('Prueba BPS y ADS', array['ryff','ads']) returning id", 'authenticated', PSI).splitlines()[-1]
conv2 = q(f"insert into ps_convocatorias (nombre, bateria_id) values ('Prueba 2', '{bat2}') returning id", 'authenticated', PSI).splitlines()[-1]
q(f"insert into ps_aplicaciones (convocatoria_id, bateria_id, paciente_id) select '{conv2}', '{bat2}', id from pacientes", 'authenticated', PSI)
toks2 = q(f"select token from ps_aplicaciones where convocatoria_id='{conv2}' order by paciente_id").split()
ry, ad = defs['ryff']['definicion'], defs['ads']['definicion']
INV = set(ry['escalas'][0]['invertidos'])
def ryff_resp(fn): return {str(n): fn(n) for n in range(1, 40)}
casos = [
    # (respuestas ryff, respuestas ads, total ryff, nivel ryff, total ads, nivel ads)
    # Todo «Totalmente de acuerdo» con lo positivo y en desacuerdo con lo negativo: máximo.
    (ryff_resp(lambda n: 0 if n in INV else 5), {str(n): 0 for n in range(1, 26)}, 234, 'normal', 0, 'normal'),
    # El opuesto: mínimo de bienestar; ADS con todas las alternativas más altas = 48.
    (ryff_resp(lambda n: 5 if n in INV else 0), {str(it['n']): len(it['opciones']) - 1 for it in ad['items']}, 39, 'severo', 48, 'severo'),
    # Todo «Algunas veces de acuerdo» (3): 22·3 + 17·4 = 134 → moderado; ADS 1 en cada ítem salvo el 25 (Sí=0) = 24.
    (ryff_resp(lambda n: 2), {**{str(n): 1 for n in range(1, 25)}, '25': 0}, 134, 'leve', 24, 'severo'),
    # Todo 4: 22·4 + 17·3 = 139 (moderado); ADS sólo el ítem 25 «No» = 1.
    (ryff_resp(lambda n: 3), {**{str(n): 0 for n in range(1, 25)}, '25': 1}, 139, 'leve', 1, 'normal'),
    # Todo 5: 22·5 + 17·2 = 144 → alto; ADS 8 → bajo.
    (ryff_resp(lambda n: 4), {**{str(n): 0 for n in range(1, 26)}, '1': 2, '10': 3, '16': 3}, 144, 'normal', 8, 'leve'),
    # Corte exacto 176 y 116; ADS 14 y 21 (moderado).
]
def ryff_con_total(objetivo):
    r = ryff_resp(lambda n: 0 if n not in INV else 5)   # 39
    for n in range(1, 40):
        while objetivo > sum((5 - r[str(m)] + 1) if m in INV else r[str(m)] + 1 for m in range(1, 40)):
            if n in INV and r[str(n)] > 0: r[str(n)] -= 1
            elif n not in INV and r[str(n)] < 5: r[str(n)] += 1
            else: break
    return r
def ads_con_total(objetivo):
    r = {str(n): 0 for n in range(1, 26)}
    for it in ad['items']:
        while sum(ad['items'][int(k)-1]['opciones'][v]['valor'] for k, v in r.items()) < objetivo and r[str(it['n'])] < len(it['opciones']) - 1:
            r[str(it['n'])] += 1
    return r
for tot, nv, ta, na in [(116, 'severo', 7, 'normal'), (117, 'leve', 13, 'leve'), (140, 'leve', 14, 'moderado'),
                        (141, 'normal', 21, 'moderado'), (175, 'normal', 22, 'severo'), (176, 'normal', 31, 'severo')]:
    casos.append((ryff_con_total(tot), ads_con_total(ta), tot, nv, ta, na))
assert len(casos) <= len(toks2)
for tok, (rr, ra, tr, nr, ta, na) in zip(toks2, casos):
    r = json.loads(q(f"select ps_publico_guardar('{tok}', '{json.dumps({'ryff': rr, 'ads': ra})}'::jsonb, '{{\"consentimiento\":true}}'::jsonb, true)", 'anon'))
    assert r['ok'], r
    res = {i['instrumento']: i for i in json.loads(q(f"select resultados from ps_aplicaciones where token='{tok}'"))['instrumentos']}
    for c, resp in (('ryff', rr), ('ads', ra)):
        esp = esperado(defs[c]['definicion'], resp)
        for e in res[c]['escalas']:
            b, _, nv = esp[e['clave']]
            assert float(e['bruta']) == b and e['nivel'] == nv, (c, e, b, nv)
    tot_r = next(e for e in res['ryff']['escalas'] if e['clave'] == 'total')
    tot_a = res['ads']['escalas'][0]
    assert (float(tot_r['bruta']), tot_r['nivel']) == (tr, nr), (tot_r, tr, nr)
    assert (float(tot_a['bruta']), tot_a['nivel']) == (ta, na), (tot_a, ta, na)
    dims = sum(float(e['bruta']) for e in res['ryff']['escalas'] if e['clave'] != 'total')
    assert dims == tr, ('las seis dimensiones deben sumar el total', dims, tr)
    print('ok BPS', tr, tot_r['etiqueta'], '| ADS', ta, tot_a['etiqueta'])
print('hallazgos BPS/ADS', q(f"select h.instrumento||':'||coalesce(h.problema,'-')||':'||h.nivel||':'||count(*) from ps_hallazgos h join ps_aplicaciones a on a.id=h.aplicacion_id where a.convocatoria_id='{conv2}' group by h.instrumento, h.problema, h.nivel order by 1").replace('\n',' | '))
