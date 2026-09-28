// ============================================================================
// 07b · EDITOR DE INSTRUMENTO
// ----------------------------------------------------------------------------
// Toda la corrección de un cuestionario, editable sin tocar código:
//
//   · Alternativas de respuesta (comunes, o propias de cada ítem como en el
//     BDI-II, donde 1a y 1b valen lo mismo).
//   · Ítems.
//   · Escalas: qué ítems suman, cuáles se invierten, clave Verdadero/Falso,
//     corrección K, normas T y puntos de corte con su nivel y el problema que
//     identifican.
//   · Alertas: un ítem que por sí solo exige atención (ideación suicida).
//
// «Probar» califica respuestas de ejemplo con la MISMA función de la base que
// califica los enlaces, antes de guardar. Guardar sube la versión; las
// evaluaciones ya calificadas conservan su resultado hasta que se recalifican.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarInstrumentos, cargarProblemas, invalidar } from '../lib/datos'
import { NOMBRE_NIVEL, ORDEN_NIVEL } from '../lib/formato'
import type { Alerta as AlertaDef, Definicion, Escala, Instrumento as Ins, InstrumentoCalificado, Nivel, Opcion, Problema, Rango } from '../lib/tipos'
import {
  Alerta, Boton, BotonEnlace, Campo, Cargando, Checkbox, Encabezado, EtiquetaNivel, Input, Pestanas, Select, Tarjeta, Textarea, TituloSeccion,
} from '../components/ui'

type Apartado = 'general' | 'items' | 'escalas' | 'alertas' | 'json'

const NUEVO: Ins = {
  clave: '', nombre: '', sigla: '', autores: '', descripcion: '', instrucciones: '', activo: true, orden: 100, version: 1, actualizado_en: '',
  definicion: {
    opciones: [{ valor: 0, texto: 'Nunca' }, { valor: 1, texto: 'A veces' }, { valor: 2, texto: 'Casi siempre' }, { valor: 3, texto: 'Siempre' }],
    items: [{ n: 1, texto: '' }],
    escalas: [{ clave: 'total', nombre: 'Total', items: 'todos', usa: 'bruta', rangos: [{ desde: 0, nivel: 'normal', etiqueta: 'Dentro de la norma' }] }],
    alertas: [],
  },
}

const lista = (v?: number[] | 'todos') => (v === 'todos' ? 'todos' : (v ?? []).join(', '))
const aLista = (s: string): number[] => s.split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0)
const numONulo = (s: string) => (s.trim() === '' ? undefined : Number(s))

export default function Instrumento() {
  const { clave = '' } = useParams()
  const nuevo = clave === 'nuevo'
  const navegar = useNavigate()
  const { state } = useLocation() as { state: { copia?: Ins } | null }
  const avisos = useAvisos()
  const [ins, setIns] = useState<Ins | null>(null)
  const [original, setOriginal] = useState<string>('')
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [todos, setTodos] = useState<Ins[]>([])
  const [apartado, setApartado] = useState<Apartado>('general')
  const [json, setJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [prueba, setPrueba] = useState<InstrumentoCalificado | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    invalidar('instrumentos')
    Promise.all([cargarInstrumentos(), cargarProblemas()]).then(([l, p]) => {
      setTodos(l)
      setProblemas(p)
      // «Duplicar» llega aquí con la copia en el estado de la navegación.
      const i = nuevo ? structuredClone(state?.copia ?? NUEVO) : l.find((x) => x.clave === clave)
      if (!i) return setError('No existe ese instrumento.')
      setIns(structuredClone(i))
      setOriginal(nuevo ? '' : JSON.stringify(i))
    })
  }, [clave, nuevo, state])

  const d = ins?.definicion
  const cambiado = useMemo(() => !!ins && JSON.stringify(ins) !== original, [ins, original])

  if (error && !ins) return <Alerta>{error}</Alerta>
  if (!ins || !d) return <Cargando />

  const setD = (nd: Partial<Definicion>) => setIns({ ...ins, definicion: { ...d, ...nd } })
  const setEscala = (k: number, e: Partial<Escala>) => setD({ escalas: d.escalas.map((x, i) => (i === k ? { ...x, ...e } : x)) })

  async function probar(modo: 'min' | 'max' | 'azar') {
    const resp: Record<string, number> = {}
    for (const it of d!.items) {
      const ops = it.opciones ?? d!.opciones ?? []
      const vals = ops.map((o) => o.valor)
      const idx = modo === 'azar' ? Math.floor(Math.random() * ops.length)
        : vals.indexOf(modo === 'min' ? Math.min(...vals) : Math.max(...vals))
      resp[it.n] = idx
    }
    const { data, error } = await supabase.rpc('ps_calificar_instrumento', { def: d, resp })
    if (error) return avisos.error(error.message)
    setPrueba({ ...(data as InstrumentoCalificado), instrumento: ins!.clave, nombre: ins!.nombre, sigla: ins!.sigla, version: ins!.version })
  }

  function validar(): string | null {
    if (!ins!.nombre.trim()) return 'Falta el nombre.'
    if (nuevo && !/^[a-z0-9_]{2,40}$/.test(ins!.clave)) return 'La clave va en minúsculas, sin espacios ni tildes (p. ej. «estres_pss»).'
    if (nuevo && todos.some((x) => x.clave === ins!.clave)) return 'Ya existe un instrumento con esa clave.'
    if (!d!.items.length) return 'Agregue al menos un ítem.'
    if (d!.items.some((i) => !i.texto.trim())) return 'Hay ítems sin texto.'
    if (!d!.opciones?.length && d!.items.some((i) => !i.opciones?.length)) return 'Faltan alternativas de respuesta.'
    if (!d!.escalas.length) return 'Agregue al menos una escala.'
    const claves = new Set<string>()
    for (const e of d!.escalas) {
      if (!e.clave.trim() || claves.has(e.clave)) return `Clave de escala vacía o repetida: «${e.clave}».`
      claves.add(e.clave)
      if (e.suma_k && !claves.has(e.suma_k.escala)) return `La escala ${e.clave} suma ${e.suma_k.escala}, que debe ir ANTES en la lista.`
    }
    return null
  }

  async function guardar() {
    const malo = validar()
    if (malo) return setError(malo)
    setGuardando(true)
    setError(null)
    const fila = {
      nombre: ins!.nombre.trim(), sigla: ins!.sigla || null, autores: ins!.autores || null, descripcion: ins!.descripcion || null,
      instrucciones: ins!.instrucciones || null, activo: ins!.activo, orden: ins!.orden, definicion: d,
    }
    const { error } = nuevo
      ? await supabase.from('ps_instrumentos').insert({ ...fila, clave: ins!.clave })
      : await supabase.from('ps_instrumentos').update(fila).eq('clave', ins!.clave)
    setGuardando(false)
    if (error) return setError(error.message)
    invalidar('instrumentos')
    avisos.exito(nuevo ? 'Instrumento creado. Añádalo a una batería para aplicarlo.' : 'Guardado. Las evaluaciones nuevas se califican con esta versión.')
    if (nuevo) navegar(`/instrumentos/${ins!.clave}`, { replace: true })
    else setOriginal(JSON.stringify(ins))
  }

  function duplicar() {
    const copia = structuredClone(ins!)
    copia.clave = `${ins!.clave}_copia`.slice(0, 40)
    copia.nombre = `${ins!.nombre} (copia)`
    navegar('/instrumentos/nuevo', { state: { copia } })
  }

  return (
    <div className="space-y-5">
      <Encabezado indice="07 / Instrumento" titulo={ins.nombre || 'Nuevo instrumento'}
        antes={<BotonEnlace to="/instrumentos" variante="fantasma">← Instrumentos</BotonEnlace>}
        detalle={nuevo ? 'Defina ítems, alternativas y escalas. Pruebe la calificación antes de guardar.' : `Versión ${ins.version}. ${d.items.length} ítems, ${d.escalas.length} escalas.`}
        accion={<>
          {!nuevo && <Boton variante="secundario" onClick={duplicar}>Duplicar</Boton>}
          <Boton onClick={guardar} disabled={guardando || (!cambiado && !nuevo)}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
        </>} />
      {error && <Alerta>{error}</Alerta>}
      {cambiado && !nuevo && <Alerta tono="aviso">Hay cambios sin guardar. Las evaluaciones ya calificadas no cambian hasta que se recalifican desde su ficha.</Alerta>}

      <Pestanas etiqueta="Apartados del instrumento" activa={apartado} onCambio={(a) => { if (a === 'json') setJson(JSON.stringify(d, null, 2)); setApartado(a) }} pestanas={[
        { clave: 'general', titulo: 'General' },
        { clave: 'items', titulo: 'Ítems y alternativas', cuenta: d.items.length },
        { clave: 'escalas', titulo: 'Escalas y corrección', cuenta: d.escalas.length },
        { clave: 'alertas', titulo: 'Alertas', cuenta: d.alertas?.length ?? 0 },
        { clave: 'json', titulo: 'Avanzado' },
      ]} />

      {apartado === 'general' && (
        <Tarjeta className="grid gap-4 p-4 sm:grid-cols-2">
          {nuevo && <Campo etiqueta="Clave (única, sin espacios)"><Input value={ins.clave} onChange={(e) => setIns({ ...ins, clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></Campo>}
          <Campo etiqueta="Nombre"><Input value={ins.nombre} onChange={(e) => setIns({ ...ins, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Sigla"><Input value={ins.sigla ?? ''} onChange={(e) => setIns({ ...ins, sigla: e.target.value })} /></Campo>
          <Campo etiqueta="Autores y adaptación"><Input value={ins.autores ?? ''} onChange={(e) => setIns({ ...ins, autores: e.target.value })} /></Campo>
          <Campo etiqueta="Orden en los listados"><Input type="number" value={ins.orden} onChange={(e) => setIns({ ...ins, orden: Number(e.target.value) })} /></Campo>
          <div className="sm:col-span-2"><Campo etiqueta="Descripción"><Textarea rows={2} value={ins.descripcion ?? ''} onChange={(e) => setIns({ ...ins, descripcion: e.target.value })} /></Campo></div>
          <div className="sm:col-span-2"><Campo etiqueta="Instrucciones para quien responde"><Textarea rows={3} value={ins.instrucciones ?? ''} onChange={(e) => setIns({ ...ins, instrucciones: e.target.value })} /></Campo></div>
          <Checkbox etiqueta="Activo (disponible para baterías)" checked={ins.activo} onChange={(v) => setIns({ ...ins, activo: v })} />
        </Tarjeta>
      )}

      {apartado === 'items' && (
        <div className="space-y-4">
          <Tarjeta>
            <TituloSeccion accion={<Boton variante="fantasma" onClick={() => setD({ opciones: [...(d.opciones ?? []), { valor: (d.opciones?.length ?? 0), texto: '' }] })}>Añadir alternativa</Boton>}>
              Alternativas comunes
            </TituloSeccion>
            <div className="space-y-2 p-4">
              <p className="text-[12px] text-tinta-tenue">Las usan todos los ítems que no tienen alternativas propias. «Valor» es lo que suma.</p>
              <EditorOpciones ops={d.opciones ?? []} onCambio={(o) => setD({ opciones: o })} />
            </div>
          </Tarjeta>
          <Tarjeta>
            <TituloSeccion accion={<Boton variante="fantasma" onClick={() => setD({ items: [...d.items, { n: d.items.length + 1, texto: '' }] })}>Añadir ítem</Boton>}>Ítems</TituloSeccion>
            <ol className="divide-y divide-borde">
              {d.items.map((it, k) => (
                <li key={k} className="space-y-2 px-4 py-2">
                  <div className="flex items-start gap-2">
                    <span className="cifras w-7 pt-3 text-[12px] text-tinta-tenue">{it.n}</span>
                    <Input value={it.texto} onChange={(e) => setD({ items: d.items.map((x, i) => (i === k ? { ...x, texto: e.target.value } : x)) })} />
                    <Boton variante="fantasma" title={it.opciones ? 'Usar alternativas comunes' : 'Alternativas propias'}
                      onClick={() => setD({ items: d.items.map((x, i) => (i === k ? { ...x, opciones: x.opciones ? undefined : structuredClone(d.opciones ?? [{ valor: 0, texto: '' }]) } : x)) })}>
                      {it.opciones ? 'Comunes' : 'Propias'}
                    </Boton>
                    <Boton variante="fantasma" aria-label="Quitar ítem" className="text-alerta"
                      onClick={() => setD({ items: d.items.filter((_, i) => i !== k).map((x, i) => ({ ...x, n: i + 1 })) })}>×</Boton>
                  </div>
                  {it.opciones && (
                    <div className="ml-9">
                      <EditorOpciones ops={it.opciones} conRotulo onCambio={(o) => setD({ items: d.items.map((x, i) => (i === k ? { ...x, opciones: o } : x)) })} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <p className="px-4 pb-4 text-[11px] text-tinta-tenue">Quitar un ítem renumera los siguientes: revise después las listas de las escalas.</p>
          </Tarjeta>
        </div>
      )}

      {apartado === 'escalas' && (
        <div className="space-y-4">
          {d.escalas.map((e, k) => (
            <Tarjeta key={k}>
              <TituloSeccion accion={
                <span className="flex gap-1">
                  <Boton variante="fantasma" disabled={k === 0} onClick={() => { const l = [...d.escalas]; [l[k - 1], l[k]] = [l[k], l[k - 1]]; setD({ escalas: l }) }}>▲</Boton>
                  <Boton variante="fantasma" className="text-alerta" onClick={() => setD({ escalas: d.escalas.filter((_, i) => i !== k) })}>Quitar</Boton>
                </span>
              }>{e.nombre || e.clave || 'Escala'}</TituloSeccion>
              <div className="grid gap-4 p-4 md:grid-cols-4">
                <Campo etiqueta="Clave"><Input value={e.clave} onChange={(x) => setEscala(k, { clave: x.target.value })} /></Campo>
                <div className="md:col-span-2"><Campo etiqueta="Nombre"><Input value={e.nombre} onChange={(x) => setEscala(k, { nombre: x.target.value })} /></Campo></div>
                <Campo etiqueta="Tipo">
                  <Select value={e.clave_v || e.clave_f ? 'vf' : 'suma'} onChange={(x) => setEscala(k, x.target.value === 'vf'
                    ? { clave_v: e.clave_v ?? [], clave_f: e.clave_f ?? [], items: undefined, invertidos: undefined }
                    : { clave_v: undefined, clave_f: undefined, items: e.items ?? 'todos' })}>
                    <option value="suma">Suma de valores</option>
                    <option value="vf">Clave Verdadero/Falso</option>
                  </Select>
                </Campo>
                {e.clave_v || e.clave_f ? (
                  <>
                    <div className="md:col-span-2"><Campo etiqueta="Suman si Verdadero" hint="Números de ítem separados por coma.">
                      <ListaNumeros valor={e.clave_v} onCambio={(v) => setEscala(k, { clave_v: v })} /></Campo></div>
                    <div className="md:col-span-2"><Campo etiqueta="Suman si Falso">
                      <ListaNumeros valor={e.clave_f} onCambio={(v) => setEscala(k, { clave_f: v })} /></Campo></div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2"><Campo etiqueta="Ítems que suman" hint="«todos» o números separados por coma.">
                      <Input defaultValue={lista(e.items)} onBlur={(x) => setEscala(k, { items: x.target.value.trim() === 'todos' || !x.target.value.trim() ? 'todos' : aLista(x.target.value) })} /></Campo></div>
                    <div className="md:col-span-2"><Campo etiqueta="Ítems invertidos" hint="Se puntúan al revés (mín + máx − valor).">
                      <ListaNumeros valor={e.invertidos} onCambio={(v) => setEscala(k, { invertidos: v })} /></Campo></div>
                  </>
                )}
                <Campo etiqueta="Corrección K: escala">
                  <Select value={e.suma_k?.escala ?? ''} onChange={(x) => setEscala(k, { suma_k: x.target.value ? { escala: x.target.value, factor: e.suma_k?.factor ?? 0.5, redondeo: e.suma_k?.redondeo ?? 'techo' } : undefined })}>
                    <option value="">Sin corrección</option>
                    {d.escalas.slice(0, k).map((o) => <option key={o.clave} value={o.clave}>{o.clave}</option>)}
                  </Select>
                </Campo>
                {e.suma_k && (
                  <Campo etiqueta="Fracción de K"><Input type="number" step="0.1" value={e.suma_k.factor} onChange={(x) => setEscala(k, { suma_k: { ...e.suma_k!, factor: Number(x.target.value) } })} /></Campo>
                )}
                <Campo etiqueta="Norma T: media" hint="Vacío si no se tipifica.">
                  <Input type="number" step="0.01" value={e.t?.media ?? ''} onChange={(x) => {
                    const m = numONulo(x.target.value)
                    setEscala(k, { t: m === undefined ? undefined : { media: m, de: e.t?.de ?? 10 }, usa: m === undefined ? 'bruta' : e.usa })
                  }} />
                </Campo>
                {e.t && <Campo etiqueta="Norma T: desviación"><Input type="number" step="0.01" value={e.t.de} onChange={(x) => setEscala(k, { t: { ...e.t!, de: Number(x.target.value) } })} /></Campo>}
                {e.t && (
                  <Campo etiqueta="Los cortes se aplican sobre">
                    <Select value={e.usa ?? 'bruta'} onChange={(x) => setEscala(k, { usa: x.target.value as 'bruta' | 't' })}>
                      <option value="bruta">Puntaje bruto</option><option value="t">Puntaje T</option>
                    </Select>
                  </Campo>
                )}
                <div className="flex items-end"><Checkbox etiqueta="Escala de validez (no identifica problema)" checked={!!e.validez} onChange={(v) => setEscala(k, { validez: v || undefined })} /></div>

                <div className="md:col-span-4">
                  <div className="rotulo mb-2 text-tinta-tenue">Puntos de corte</div>
                  <EditorRangos rangos={e.rangos ?? []} problemas={problemas} validez={!!e.validez} onCambio={(r) => setEscala(k, { rangos: r })} />
                </div>
              </div>
            </Tarjeta>
          ))}
          <Boton variante="secundario" onClick={() => setD({ escalas: [...d.escalas, { clave: `e${d.escalas.length + 1}`, nombre: '', items: 'todos', usa: 'bruta', rangos: [] }] })}>Añadir escala</Boton>
          <Probar d={d} prueba={prueba} onProbar={probar} />
        </div>
      )}

      {apartado === 'alertas' && (
        <Tarjeta>
          <TituloSeccion accion={<Boton variante="fantasma" onClick={() => setD({ alertas: [...(d.alertas ?? []), { item: 1, minimo: 1, nivel: 'critico', mensaje: '' }] })}>Añadir alerta</Boton>}>Alertas por ítem</TituloSeccion>
          <div className="space-y-3 p-4">
            <p className="text-[12px] text-tinta-tenue">Un ítem que, con un valor igual o mayor al mínimo, dispara una alerta aunque el total sea normal. Las alertas severas o críticas encabezan el tablero.</p>
            {(d.alertas ?? []).map((a, k) => {
              const set = (c: Partial<AlertaDef>) => setD({ alertas: (d.alertas ?? []).map((x, i) => (i === k ? { ...x, ...c } : x)) })
              return (
                <div key={k} className="grid gap-3 rounded-control border border-borde p-3 md:grid-cols-[5rem_5rem_9rem_1fr_auto]">
                  <Campo etiqueta="Ítem"><Input type="number" value={a.item} onChange={(e) => set({ item: Number(e.target.value) })} /></Campo>
                  <Campo etiqueta="Desde valor"><Input type="number" value={a.minimo} onChange={(e) => set({ minimo: Number(e.target.value) })} /></Campo>
                  <Campo etiqueta="Nivel">
                    <Select value={a.nivel ?? 'critico'} onChange={(e) => set({ nivel: e.target.value as AlertaDef['nivel'] })}>
                      {ORDEN_NIVEL.filter((n) => n !== 'normal').map((n) => <option key={n} value={n}>{NOMBRE_NIVEL[n]}</option>)}
                    </Select>
                  </Campo>
                  <Campo etiqueta="Mensaje"><Input value={a.mensaje} onChange={(e) => set({ mensaje: e.target.value })} /></Campo>
                  <div className="flex items-end"><Boton variante="fantasma" className="text-alerta" onClick={() => setD({ alertas: (d.alertas ?? []).filter((_, i) => i !== k) })}>Quitar</Boton></div>
                  <div className="md:col-span-5">
                    <Campo etiqueta="Problema que identifica">
                      <Select value={a.problema ?? ''} onChange={(e) => set({ problema: e.target.value || undefined })}>
                        <option value="">Ninguno</option>
                        {problemas.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
                      </Select>
                    </Campo>
                  </div>
                </div>
              )
            })}
          </div>
        </Tarjeta>
      )}

      {apartado === 'json' && (
        <Tarjeta className="space-y-3 p-4">
          <p className="text-[12px] text-tinta-tenue">La definición completa en JSON, para copiar un instrumento entre sistemas o hacer cambios masivos. Formato en docs/INSTRUMENTOS.md.</p>
          <Textarea rows={24} value={json} onChange={(e) => setJson(e.target.value)} className="cifras text-[12px]" spellCheck={false} />
          <Boton variante="secundario" onClick={() => {
            try { setD(JSON.parse(json) as Definicion); setError(null); avisos.info('Definición aplicada. Revise y guarde.') }
            catch (e) { setError(`JSON inválido: ${(e as Error).message}`) }
          }}>Aplicar JSON</Boton>
        </Tarjeta>
      )}
    </div>
  )
}

function ListaNumeros({ valor, onCambio }: { valor?: number[]; onCambio: (v: number[]) => void }) {
  const [t, setT] = useState(lista(valor))
  useEffect(() => setT(lista(valor)), [valor])
  return <Input value={t} onChange={(e) => setT(e.target.value)} onBlur={() => onCambio(aLista(t))} />
}

function EditorOpciones({ ops, onCambio, conRotulo }: { ops: Opcion[]; onCambio: (o: Opcion[]) => void; conRotulo?: boolean }) {
  return (
    <div className="space-y-1.5">
      {ops.map((o, k) => (
        <div key={k} className={`grid gap-2 ${conRotulo ? 'grid-cols-[4rem_4rem_1fr_auto]' : 'grid-cols-[5rem_1fr_auto]'}`}>
          <Input type="number" aria-label="Valor" value={o.valor} onChange={(e) => onCambio(ops.map((x, i) => (i === k ? { ...x, valor: Number(e.target.value) } : x)))} />
          {conRotulo && <Input aria-label="Rótulo" value={o.rotulo ?? ''} placeholder="1a" onChange={(e) => onCambio(ops.map((x, i) => (i === k ? { ...x, rotulo: e.target.value || undefined } : x)))} />}
          <Input aria-label="Texto" value={o.texto} onChange={(e) => onCambio(ops.map((x, i) => (i === k ? { ...x, texto: e.target.value } : x)))} />
          <Boton variante="fantasma" aria-label="Quitar alternativa" className="text-alerta" onClick={() => onCambio(ops.filter((_, i) => i !== k))}>×</Boton>
        </div>
      ))}
      {conRotulo && <Boton variante="fantasma" onClick={() => onCambio([...ops, { valor: ops.length, texto: '' }])}>Añadir alternativa</Boton>}
    </div>
  )
}

function EditorRangos({ rangos, problemas, validez, onCambio }: { rangos: Rango[]; problemas: Problema[]; validez: boolean; onCambio: (r: Rango[]) => void }) {
  const set = (k: number, c: Partial<Rango>) => onCambio(rangos.map((x, i) => (i === k ? { ...x, ...c } : x)))
  return (
    <div className="space-y-2">
      {rangos.map((r, k) => (
        <div key={k} className="grid gap-2 md:grid-cols-[5.5rem_5.5rem_8rem_1fr_12rem_auto]">
          <Input type="number" step="0.1" aria-label="Desde" placeholder="desde" value={r.desde ?? ''} onChange={(e) => set(k, { desde: numONulo(e.target.value) })} />
          <Input type="number" step="0.1" aria-label="Hasta" placeholder="hasta" value={r.hasta ?? ''} onChange={(e) => set(k, { hasta: numONulo(e.target.value) })} />
          <Select aria-label="Nivel" value={r.nivel} onChange={(e) => set(k, { nivel: e.target.value as Nivel })}>
            {ORDEN_NIVEL.map((n) => <option key={n} value={n}>{NOMBRE_NIVEL[n]}</option>)}
          </Select>
          <Input aria-label="Interpretación" placeholder="Interpretación" value={r.etiqueta ?? ''} onChange={(e) => set(k, { etiqueta: e.target.value })} />
          <Select aria-label="Problema" value={r.problema ?? ''} disabled={validez || r.nivel === 'normal'} onChange={(e) => set(k, { problema: e.target.value || undefined })}>
            <option value="">Sin problema</option>
            {problemas.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
          </Select>
          <Boton variante="fantasma" aria-label="Quitar corte" className="text-alerta" onClick={() => onCambio(rangos.filter((_, i) => i !== k))}>×</Boton>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Boton variante="fantasma" onClick={() => onCambio([...rangos, { desde: (rangos.at(-1)?.hasta ?? 0) + 1, nivel: 'leve', etiqueta: '' }])}>Añadir corte</Boton>
        <span className="text-[11px] text-tinta-tenue">Se aplica el primer corte que contiene el valor. Vacío = sin límite.</span>
      </div>
    </div>
  )
}

function Probar({ d, prueba, onProbar }: { d: Definicion; prueba: InstrumentoCalificado | null; onProbar: (m: 'min' | 'max' | 'azar') => void }) {
  return (
    <Tarjeta>
      <TituloSeccion>Probar la calificación</TituloSeccion>
      <div className="space-y-3 p-4">
        <p className="text-[12px] text-tinta-tenue">Califica respuestas de ejemplo con la función de la base, con la definición tal como está en pantalla (sin guardar).</p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => onProbar('min')}>Todo al mínimo</Boton>
          <Boton variante="secundario" onClick={() => onProbar('max')}>Todo al máximo</Boton>
          <Boton variante="secundario" onClick={() => onProbar('azar')}>Al azar</Boton>
        </div>
        {prueba && (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-borde">
              {prueba.escalas.map((e) => (
                <tr key={e.clave}>
                  <td className="py-1.5">{e.nombre}</td>
                  <td className="cifras py-1.5 text-right">{e.bruta}{e.t !== null ? ` · T ${e.t}` : ''}</td>
                  <td className="py-1.5 pl-3"><EtiquetaNivel nivel={e.nivel} texto={e.etiqueta ?? undefined} /></td>
                </tr>
              ))}
              {prueba.alertas.map((a, i) => <tr key={i}><td colSpan={3} className="py-1.5 text-alerta">{a.mensaje}</td></tr>)}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-tinta-tenue">{d.items.length} ítems · {d.escalas.length} escalas</p>
      </div>
    </Tarjeta>
  )
}
