#!/usr/bin/env python3
# Cotejo de la calificación: la base (ps_calificar) contra un cálculo
# independiente en Python, más las reglas de acceso (anónimo, S-4, médica).
#
#   PGURL="-h /tmp -p 5432 -U postgres -d prueba" python3 pruebas/calificacion.py
#
# Necesita una base de prueba con pruebas/stub.sql y las migraciones 30–33.
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
q("insert into pacientes (codigo, grado, nombre_completo, seccion) select lpad(g::text,3,'0'), 'Sdo.', 'Persona '||g||' Apellido', case when g<=6 then 'SECCION A' else 'SECCION B' end from generate_series(1,8) g where not exists (select 1 from pacientes)")
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
            b = sum((mn[n]+mx[n]-val[n]) if n in e.get('invertidos',[]) else val[n] for n in val)
        if 'suma_k' in e: b += math.ceil(brutas['K']*e['suma_k']['factor'])
        brutas[e['clave']] = b
        t = round(50+10*(b-e['t']['media'])/e['t']['de'],1) if 't' in e else None
        out[e['clave']] = (b, t)
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
            b, t = esp[e['clave']]
            assert float(e['bruta']) == b and (t is None or abs(float(e['t'])-t) < 0.051), (ins['instrumento'], e, b, t)
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
