// ============================================================================
// 05 · CONVOCATORIAS Y ENLACES
// ----------------------------------------------------------------------------
// Una convocatoria es una batería aplicada a una COHORTE —una sección, una
// ubicación, una lista a mano— con un TIPO de evaluación (ingreso, periódica,
// post-incidente…) y un plazo. Al crearla nace un enlace personal por
// evaluado y, si se quiere, un enlace de cohorte con PIN para pegar en un
// grupo o proyectar en formación.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cargarBaterias, padron, plano } from '../lib/datos'
import { TIPOS_EVALUACION, fmtFecha, hoy, sumarDias } from '../lib/formato'
import type { Bateria, Convocatoria, PacienteBreve, TipoEvaluacion } from '../lib/tipos'
import { Alerta, Boton, Buscador, Campo, Checkbox, Encabezado, EsqueletoTabla, Input, Insignia, Modal, Select, Tarjeta, Textarea, Vacio } from '../components/ui'

interface Cuenta { total: number; completadas: number }

export default function Convocatorias() {
  const [convs, setConvs] = useState<Convocatoria[] | null>(null)
  const [cuentas, setCuentas] = useState<Record<string, Cuenta>>({})
  const [baterias, setBaterias] = useState<Bateria[]>([])
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)
  const navegar = useNavigate()

  useEffect(() => {
    Promise.all([
      supabase.from('ps_convocatorias').select('*').order('creado_en', { ascending: false }),
      supabase.from('ps_aplicaciones').select('convocatoria_id, estado').not('convocatoria_id', 'is', null).neq('estado', 'anulada').range(0, 9999),
      cargarBaterias(),
    ]).then(([c, a, b]) => {
      if (c.error) setError(c.error.message)
      const m: Record<string, Cuenta> = {}
      for (const x of (a.data ?? []) as { convocatoria_id: string; estado: string }[]) {
        const r = (m[x.convocatoria_id] ??= { total: 0, completadas: 0 })
        r.total++
        if (x.estado === 'completada') r.completadas++
      }
      setCuentas(m)
      setBaterias(b)
      setConvs((c.data ?? []) as Convocatoria[])
    })
  }, [])

  return (
    <div className="space-y-4">
      <Encabezado indice="05 / Convocatorias" titulo="Convocatorias y enlaces"
        detalle="Prepare los enlaces por cohorte y tipo de evaluación. Cada persona recibe un enlace propio; los resultados se asignan solos a su ficha."
        accion={<Boton onClick={() => setNueva(true)}>Nueva convocatoria</Boton>} />
      {error && <Alerta>{error}</Alerta>}

      <Tarjeta>
        {!convs ? <div className="p-4"><EsqueletoTabla filas={4} /></div> : convs.length === 0 ? (
          <Vacio texto="Todavía no hay convocatorias." detalle="Cree una para una sección, una ubicación o una lista de personas." accion={<Boton onClick={() => setNueva(true)}>Nueva convocatoria</Boton>} />
        ) : (
          <ul className="divide-y divide-borde">
            {convs.map((c) => {
              const k = cuentas[c.id] ?? { total: 0, completadas: 0 }
              const vencida = c.cierra_en && c.cierra_en < hoy()
              return (
                <li key={c.id}>
                  <Link to={`/convocatorias/${c.id}`} className="pulsable fila-liquida block px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-tinta">{c.nombre}</div>
                        <div className="text-[12px] text-tinta-tenue">
                          {TIPOS_EVALUACION[c.tipo]} · {baterias.find((b) => b.id === c.bateria_id)?.nombre ?? '—'} · {c.cohorte ?? 'Cohorte'} · {fmtFecha(c.abre_en)} – {fmtFecha(c.cierra_en)}
                        </div>
                      </div>
                      <span className="flex items-center gap-2">
                        {c.permite_general && <Insignia tono="azul">Enlace de cohorte</Insignia>}
                        <Insignia tono={c.estado === 'cerrada' || vencida ? 'neutro' : 'verde'}>{c.estado === 'cerrada' ? 'Cerrada' : vencida ? 'Vencida' : 'Abierta'}</Insignia>
                        <span className="cifras text-sm text-tinta-suave">{k.completadas}/{k.total}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-pastilla bg-superficie-alta">
                      <div className="h-full bg-marca" style={{ width: `${k.total ? (k.completadas / k.total) * 100 : 0}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Tarjeta>

      {nueva && <ModalConvocatoria baterias={baterias.filter((b) => b.activa)} onCerrar={() => setNueva(false)} onCreada={(id) => navegar(`/convocatorias/${id}`)} />}
    </div>
  )
}

/** Constructor de cohortes: por sección, por ubicación y a mano. */
export function ModalConvocatoria({ baterias, onCerrar, onCreada, existente }: {
  baterias: Bateria[]
  onCerrar: () => void
  onCreada: (id: string) => void
  /** Para añadir personas a una convocatoria ya creada. */
  existente?: Convocatoria & { yaIncluidos: Set<string> }
}) {
  const [lista, setLista] = useState<PacienteBreve[] | null>(null)
  const [f, setF] = useState({
    nombre: '', tipo: 'periodica' as TipoEvaluacion, bateria_id: baterias[0]?.id ?? '',
    abre_en: hoy(), cierra_en: sumarDias(hoy(), 14), descripcion: '', permite_general: false,
  })
  const [secciones, setSecciones] = useState<Set<string>>(new Set())
  const [ubicaciones, setUbicaciones] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState<Set<string>>(new Set())
  const [quitados, setQuitados] = useState<Set<string>>(new Set())
  const [soloActivos, setSoloActivos] = useState(true)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { padron().then(setLista).catch((e) => setError(e.message)) }, [])

  const conteo = (campo: 'seccion' | 'ubicacion') => {
    const m = new Map<string, number>()
    for (const p of lista ?? []) if (p[campo] && (!soloActivos || p.estado === 'activo')) m.set(p[campo]!, (m.get(p[campo]!) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }

  const elegidos = useMemo(() => (lista ?? []).filter((p) => {
    if (existente?.yaIncluidos.has(p.id)) return false
    if (quitados.has(p.id)) return false
    if (manual.has(p.id)) return true
    if (soloActivos && p.estado !== 'activo') return false
    return (!!p.seccion && secciones.has(p.seccion)) || (!!p.ubicacion && ubicaciones.has(p.ubicacion))
  }), [lista, secciones, ubicaciones, manual, quitados, soloActivos, existente])

  const sugeridos = useMemo(() => {
    const t = plano(q.trim())
    if (!t) return []
    return (lista ?? []).filter((p) => plano(`${p.codigo ?? ''} ${p.grado ?? ''} ${p.nombre_completo}`).includes(t)).slice(0, 8)
  }, [q, lista])

  const alternar = (s: Set<string>, v: string, set: (x: Set<string>) => void) => {
    const n = new Set(s)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    set(n)
  }

  async function crear() {
    setGuardando(true)
    setError(null)
    let conv = existente as Convocatoria | undefined
    if (!conv) {
      const cohorte = [
        secciones.size ? `Secciones: ${[...secciones].join(', ')}` : '',
        ubicaciones.size ? `Ubicaciones: ${[...ubicaciones].join(', ')}` : '',
        manual.size ? `${manual.size} a mano` : '',
      ].filter(Boolean).join(' · ') || 'Lista a mano'
      const { data, error } = await supabase.from('ps_convocatorias').insert({
        nombre: f.nombre.trim(), tipo: f.tipo, bateria_id: f.bateria_id, descripcion: f.descripcion || null,
        abre_en: f.abre_en, cierra_en: f.cierra_en || null, permite_general: f.permite_general, cohorte,
        filtro: { secciones: [...secciones], ubicaciones: [...ubicaciones] },
      }).select('*').single()
      if (error) { setGuardando(false); return setError(error.message) }
      conv = data as Convocatoria
    }
    const filas = elegidos.map((p) => ({
      convocatoria_id: conv!.id, bateria_id: conv!.bateria_id, paciente_id: p.id, tipo: conv!.tipo, origen: 'individual',
      vence_en: conv!.cierra_en ? `${conv!.cierra_en}T23:59:59` : null,
    }))
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await supabase.from('ps_aplicaciones').insert(filas.slice(i, i + 200))
      if (error) { setGuardando(false); return setError(`Se crearon ${i} de ${filas.length}: ${error.message}`) }
    }
    setGuardando(false)
    onCreada(conv.id)
  }

  const valido = (existente || (f.nombre.trim() && f.bateria_id)) && (elegidos.length > 0 || (!existente && f.permite_general))

  return (
    <Modal titulo={existente ? `Añadir personas · ${existente.nombre}` : 'Nueva convocatoria'} onCerrar={onCerrar} ancho="max-w-4xl">
      <div className="space-y-5">
        {!existente && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Tamizaje octubre · Compañía de Apoyo" /></Campo>
            <Campo etiqueta="Tipo de evaluación">
              <Select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoEvaluacion })}>
                {Object.entries(TIPOS_EVALUACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Campo>
            <Campo etiqueta="Batería">
              <Select value={f.bateria_id} onChange={(e) => setF({ ...f, bateria_id: e.target.value })}>
                {baterias.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </Select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Abre"><Input type="date" value={f.abre_en} onChange={(e) => setF({ ...f, abre_en: e.target.value })} /></Campo>
              <Campo etiqueta="Cierra"><Input type="date" value={f.cierra_en} min={f.abre_en} onChange={(e) => setF({ ...f, cierra_en: e.target.value })} /></Campo>
            </div>
            <div className="sm:col-span-2"><Campo etiqueta="Descripción (opcional)"><Textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo></div>
            <div className="sm:col-span-2">
              <Checkbox etiqueta="Crear también un enlace de cohorte (cada quien se identifica con su número de padrón y un PIN)"
                checked={f.permite_general} onChange={(v) => setF({ ...f, permite_general: v })} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="rotulo text-tinta-suave">Cohorte</h3>
            <Checkbox etiqueta="Sólo personal activo" checked={soloActivos} onChange={setSoloActivos} />
          </div>
          {!lista ? <EsqueletoTabla filas={3} columnas={3} /> : (
            <div className="grid gap-4 md:grid-cols-2">
              <Grupo titulo="Por sección" items={conteo('seccion')} activos={secciones} onAlternar={(v) => alternar(secciones, v, setSecciones)} />
              <Grupo titulo="Por ubicación" items={conteo('ubicacion')} activos={ubicaciones} onAlternar={(v) => alternar(ubicaciones, v, setUbicaciones)} />
            </div>
          )}
          <div>
            <Buscador valor={q} onCambio={setQ} placeholder="Añadir una persona por nombre o número" atajo={false} />
            {sugeridos.length > 0 && (
              <ul className="mt-2 divide-y divide-borde rounded-control border border-borde">
                {sugeridos.map((p) => {
                  const dentro = elegidos.some((x) => x.id === p.id)
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate"><span className="text-tinta-tenue">{p.codigo} · {p.grado} </span>{p.nombre_completo}</span>
                      <Boton variante="fantasma" onClick={() => {
                        if (dentro) { alternar(quitados, p.id, setQuitados); const m = new Set(manual); m.delete(p.id); setManual(m) }
                        else { const qq = new Set(quitados); qq.delete(p.id); setQuitados(qq); alternar(manual, p.id, setManual) }
                      }}>{dentro ? 'Quitar' : 'Añadir'}</Boton>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="rounded-control border border-borde bg-superficie-alta/40 p-3">
            <div className="text-sm text-tinta"><span className="cifras font-semibold">{elegidos.length}</span> personas recibirán un enlace personal.</div>
            {elegidos.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto text-[12px] leading-relaxed text-tinta-tenue">
                {elegidos.map((p) => (
                  <button key={p.id} type="button" title="Quitar" onClick={() => alternar(quitados, p.id, setQuitados)}
                    className="mr-2 hover:text-alerta hover:line-through">{p.grado} {p.nombre_completo};</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <Alerta>{error}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={crear} disabled={!valido || guardando}>{guardando ? 'Creando enlaces…' : existente ? `Añadir ${elegidos.length}` : 'Crear convocatoria'}</Boton>
        </div>
      </div>
    </Modal>
  )
}

function Grupo({ titulo, items, activos, onAlternar }: { titulo: string; items: [string, number][]; activos: Set<string>; onAlternar: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-tinta-tenue">{titulo}</div>
      <div className="max-h-52 overflow-y-auto rounded-control border border-borde p-2">
        {items.map(([v, n]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-superficie-alta">
            <input type="checkbox" className="accent-marca" checked={activos.has(v)} onChange={() => onAlternar(v)} />
            <span className="flex-1 truncate">{v}</span>
            <span className="cifras text-[11px] text-tinta-tenue">{n}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
