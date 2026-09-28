// ============================================================================
// 03 · FICHA PSICOLÓGICA
// ----------------------------------------------------------------------------
// Todo lo psicológico de un efectivo: sus evaluaciones con los resultados, los
// problemas identificados y su mapa cerebral, y las notas de la psicóloga.
// Desde aquí se crea un enlace nuevo, se transcribe una hoja en papel, se
// revisa, se anota y se imprime el informe.
// ============================================================================

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAvisos } from '../lib/avisos'
import { cargarBaterias, cargarInstrumentos, cargarProblemas, nombreDe } from '../lib/datos'
import { ORDEN_NIVEL, TIPOS_EVALUACION, TIPOS_NOTA, edad, fmtFecha, fmtFechaHora, hoy } from '../lib/formato'
import { hojaEnBlanco, informe } from '../lib/impresos'
import type { Aplicacion, Bateria, Hallazgo, Nota, Paciente, Problema, TipoNota } from '../lib/tipos'
import {
  Alerta, Boton, BotonEnlace, Campo, Cargando, Encabezado, EtiquetaNivel, Input, Metrica, Modal, Pestanas, Select, Tarjeta,
  Textarea, TituloSeccion, Vacio,
} from '../components/ui'
import { EstadoAplicacion, ResultadoAplicacion } from '../components/psico'
import { CompartirEnlace, ModalNuevaAplicacion } from '../components/Enlace'
import Captura from '../components/Captura'

const Cerebro3D = lazy(() => import('../components/Cerebro3D'))

type Apartado = 'evaluaciones' | 'mapa' | 'notas'

export default function Ficha() {
  const { id = '' } = useParams()
  const [busqueda] = useSearchParams()
  const { perfil } = useAuth()
  const avisos = useAvisos()
  const [pac, setPac] = useState<Paciente | null>(null)
  const [aps, setAps] = useState<Aplicacion[] | null>(null)
  const [hall, setHall] = useState<Hallazgo[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [baterias, setBaterias] = useState<Bateria[]>([])
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [error, setError] = useState<string | null>(null)
  const [apartado, setApartado] = useState<Apartado>('evaluaciones')
  const [abierta, setAbierta] = useState<string | null>(busqueda.get('ap'))
  const [nueva, setNueva] = useState(false)
  const [compartir, setCompartir] = useState<Aplicacion | null>(null)
  const [capturar, setCapturar] = useState<Aplicacion | null>(null)
  const [nota, setNota] = useState<Partial<Nota> | null>(null)
  const [anular, setAnular] = useState<Aplicacion | null>(null)

  const cargar = useCallback(async () => {
    const [p, a, h, n] = await Promise.all([
      supabase.from('pacientes').select('id, codigo, grado, nombre_completo, sexo, cargo, seccion, ubicacion, fecha_nacimiento, edad_registrada, telefono, estado').eq('id', id).maybeSingle(),
      supabase.from('ps_aplicaciones').select('*').eq('paciente_id', id).order('creado_en', { ascending: false }),
      supabase.from('ps_hallazgos').select('*').eq('paciente_id', id),
      supabase.from('ps_notas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
    ])
    const falla = [p, a, h, n].find((x) => x.error)
    if (falla?.error) setError(falla.error.message)
    setPac(p.data as Paciente | null)
    setAps((a.data ?? []) as Aplicacion[])
    setHall((h.data ?? []) as Hallazgo[])
    setNotas((n.data ?? []) as Nota[])
  }, [id])

  useEffect(() => {
    cargar()
    cargarBaterias().then(setBaterias)
    cargarProblemas().then(setProblemas)
  }, [cargar])

  // Sólo los hallazgos de aplicaciones vigentes (no anuladas).
  const vigentes = useMemo(() => {
    const ok = new Set((aps ?? []).filter((a) => a.estado === 'completada').map((a) => a.id))
    return hall.filter((h) => ok.has(h.aplicacion_id))
  }, [aps, hall])

  // Problemas de la persona: el nivel más alto con que aparece cada uno.
  const suyos = useMemo(() => {
    const m = new Map<string, Hallazgo>()
    for (const h of vigentes) {
      if (!h.problema) continue
      const prev = m.get(h.problema)
      if (!prev || ORDEN_NIVEL.indexOf(h.nivel) > ORDEN_NIVEL.indexOf(prev.nivel)) m.set(h.problema, h)
    }
    return [...m.values()].sort((a, b) => ORDEN_NIVEL.indexOf(b.nivel) - ORDEN_NIVEL.indexOf(a.nivel))
  }, [vigentes])

  const pesos = useMemo(() => {
    const out: Record<number, number> = {}
    for (const h of suyos) {
      const p = problemas.find((x) => x.clave === h.problema)
      for (const r of p?.regiones ?? []) out[r] = (out[r] ?? 0) + ORDEN_NIVEL.indexOf(h.nivel)
    }
    return out
  }, [suyos, problemas])

  if (error && !pac) return <Alerta>{error}</Alerta>
  if (!pac || !aps) return <Cargando texto="Abriendo ficha…" />

  const bat = (bid: string) => baterias.find((b) => b.id === bid)
  const completadas = aps.filter((a) => a.estado === 'completada')

  async function actualizar(a: Aplicacion, cambios: Partial<Aplicacion>, mensaje: string) {
    const { error } = await supabase.from('ps_aplicaciones').update(cambios).eq('id', a.id)
    if (error) return avisos.error(error.message)
    avisos.exito(mensaje)
    cargar()
  }

  async function recalificar(a: Aplicacion) {
    const { error } = await supabase.rpc('ps_recalificar', { p_aplicacion: a.id })
    if (error) return avisos.error(error.message)
    avisos.exito('Recalificada con los puntos de corte vigentes.')
    cargar()
  }

  async function imprimirInforme(a: Aplicacion) {
    informe({ ap: a, paciente: pac!, bateria: bat(a.bateria_id), notas: notas.filter((n) => n.aplicacion_id === a.id), firmante: perfil?.nombre_completo })
  }

  async function imprimirHoja(b: Bateria) {
    hojaEnBlanco({ bateria: b, instrumentos: await cargarInstrumentos(), paciente: pac })
  }

  return (
    <div className="space-y-5">
      <Encabezado
        indice="03 / Ficha psicológica"
        titulo={nombreDe(pac)}
        antes={<BotonEnlace to="/evaluados" variante="fantasma">← Evaluados</BotonEnlace>}
        detalle={[pac.codigo && `N.º ${pac.codigo}`, pac.cargo, pac.seccion, edad(pac.fecha_nacimiento, pac.edad_registrada) != null && `${edad(pac.fecha_nacimiento, pac.edad_registrada)} años`, pac.estado !== 'activo' && pac.estado]
          .filter(Boolean).join(' · ')}
        accion={<Boton onClick={() => setNueva(true)}>Nueva evaluación</Boton>}
      />
      {error && <Alerta>{error}</Alerta>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica titulo="Evaluaciones" numero={completadas.length} detalle={`${aps.filter((a) => a.estado === 'pendiente' || a.estado === 'en_curso').length} pendientes`} />
        <Metrica titulo="Última" valor={completadas[0] ? fmtFecha(completadas[0].completada_en) : '—'} detalle={completadas[0] ? TIPOS_EVALUACION[completadas[0].tipo] : 'Sin evaluaciones'} />
        <Metrica titulo="Problemas identificados" numero={suyos.length} tono={suyos.some((h) => ORDEN_NIVEL.indexOf(h.nivel) >= 2) ? 'ambar' : 'neutro'} />
        <Metrica titulo="Alertas" numero={completadas.filter((a) => a.alerta).length} tono={completadas.some((a) => a.alerta) ? 'rojo' : 'neutro'}
          detalle={completadas.some((a) => a.alerta && !a.revisada) ? 'hay alertas sin revisar' : undefined} />
      </div>

      {suyos.length > 0 && (
        <Tarjeta className="p-4">
          <div className="rotulo mb-2 text-tinta-tenue">Problemas identificados</div>
          <div className="flex flex-wrap gap-2">
            {suyos.map((h) => {
              const p = problemas.find((x) => x.clave === h.problema)
              return (
                <span key={h.problema} className="inline-flex items-center gap-2 rounded-chip border border-borde px-2.5 py-1 text-[12px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: p?.color }} />{p?.nombre ?? h.problema}
                  <EtiquetaNivel nivel={h.nivel} />
                </span>
              )
            })}
          </div>
        </Tarjeta>
      )}

      <Pestanas etiqueta="Apartados de la ficha" activa={apartado} onCambio={setApartado} pestanas={[
        { clave: 'evaluaciones', titulo: 'Evaluaciones', cuenta: aps.length },
        { clave: 'mapa', titulo: 'Mapa cerebral' },
        { clave: 'notas', titulo: 'Notas', cuenta: notas.length },
      ]} />

      {apartado === 'evaluaciones' && (
        aps.length === 0 ? <Tarjeta><Vacio texto="Sin evaluaciones todavía." accion={<Boton onClick={() => setNueva(true)}>Nueva evaluación</Boton>} /></Tarjeta> : (
          <div className="space-y-3">
            {aps.map((a) => {
              const b = bat(a.bateria_id)
              const expandida = abierta === a.id
              return (
                <Tarjeta key={a.id} className={a.estado === 'anulada' ? 'opacity-60' : ''}>
                  <button type="button" onClick={() => setAbierta(expandida ? null : a.id)}
                    className="pulsable fila-liquida flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-tinta">{b?.nombre ?? 'Batería'} <span className="text-tinta-tenue">· {TIPOS_EVALUACION[a.tipo]}</span></div>
                      <div className="text-[12px] text-tinta-tenue">
                        {a.estado === 'completada' ? `Completada ${fmtFechaHora(a.completada_en)}` : `Creada ${fmtFecha(a.creado_en)}${a.vence_en ? ` · vence ${fmtFecha(a.vence_en)}` : ''}`}
                        {a.origen === 'presencial' ? ' · en papel' : a.origen === 'cohorte' ? ' · enlace de cohorte' : ''}
                        {a.revisada && ' · revisada'}
                      </div>
                    </div>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <EstadoAplicacion ap={a} />
                      {a.estado === 'completada' && <EtiquetaNivel nivel={a.nivel_max} />}
                      {a.alerta && <EtiquetaNivel nivel="critico" texto="Alerta" />}
                    </span>
                  </button>
                  {expandida && (
                    <div className="space-y-4 border-t border-borde p-4">
                      {a.estado === 'completada' ? <ResultadoAplicacion ap={a} /> : a.estado !== 'anulada' ? (
                        <div className="space-y-3">
                          <p className="text-sm text-tinta-suave">{a.estado === 'en_curso' ? 'La persona empezó a responder y no ha enviado.' : 'Todavía no la ha abierto.'}</p>
                          <CompartirEnlace token={a.token} nombre={pac.grado ?? undefined} compacto />
                        </div>
                      ) : <p className="text-sm text-alerta">Anulada: {a.motivo_anulacion}</p>}

                      {a.estado === 'completada' && (
                        <Observaciones inicial={a.observaciones ?? ''} onGuardar={(t) => actualizar(a, { observaciones: t }, 'Observaciones guardadas.')} />
                      )}

                      <div className="flex flex-wrap gap-2">
                        {a.estado === 'completada' && <Boton onClick={() => imprimirInforme(a)}>Imprimir informe</Boton>}
                        {a.estado === 'completada' && !a.revisada && (
                          <Boton variante="secundario" onClick={() => actualizar(a, { revisada: true, revisada_en: new Date().toISOString(), revisada_por: perfil?.id } as Partial<Aplicacion>, 'Marcada como revisada.')}>Marcar revisada</Boton>
                        )}
                        {!a.identidad_confirmada && a.estado !== 'anulada' && (
                          <Boton variante="secundario" onClick={() => actualizar(a, { identidad_confirmada: true }, 'Identidad confirmada.')}>Confirmar identidad</Boton>
                        )}
                        {(a.estado === 'pendiente' || a.estado === 'en_curso') && b && (
                          <>
                            <Boton variante="secundario" onClick={() => setCompartir(a)}>Compartir enlace</Boton>
                            <Boton variante="secundario" onClick={() => setCapturar(a)}>Capturar hoja en papel</Boton>
                            <Boton variante="fantasma" onClick={() => imprimirHoja(b)}>Imprimir hoja en blanco</Boton>
                          </>
                        )}
                        {a.estado === 'completada' && <Boton variante="fantasma" onClick={() => recalificar(a)}>Recalificar</Boton>}
                        {a.estado === 'completada' && (
                          <Boton variante="fantasma" onClick={() => setNota({ aplicacion_id: a.id, tipo: 'devolucion', fecha: hoy() })}>Anotar devolución</Boton>
                        )}
                        {a.estado !== 'anulada' && <Boton variante="fantasma" className="text-alerta" onClick={() => setAnular(a)}>Anular</Boton>}
                      </div>
                    </div>
                  )}
                </Tarjeta>
              )
            })}
          </div>
        )
      )}

      {apartado === 'mapa' && (
        <Tarjeta>
          <TituloSeccion>Áreas cerebrales asociadas a sus hallazgos</TituloSeccion>
          <div className="p-4">
            {suyos.length === 0 ? <Vacio texto="Sin problemas identificados." detalle="El mapa se tiñe cuando una evaluación identifica algún problema." /> : (
              <Suspense fallback={<Cargando texto="Cargando visor 3D…" />}>
                <Cerebro3D pesos={pesos} problemas={problemas.filter((p) => suyos.some((h) => h.problema === p.clave))} alto={460}
                  pie={(
                    <div className="grid gap-3 sm:grid-cols-2">
                      {suyos.map((h) => {
                        const p = problemas.find((x) => x.clave === h.problema)
                        return p ? (
                          <div key={p.clave} className="rounded-control border border-borde p-3 text-[12px] leading-relaxed">
                            <div className="mb-1 flex items-center gap-2 font-semibold text-tinta"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.nombre} <EtiquetaNivel nivel={h.nivel} /></div>
                            <p className="text-tinta-suave">{p.explicacion}</p>
                          </div>
                        ) : null
                      })}
                    </div>
                  )} />
              </Suspense>
            )}
          </div>
        </Tarjeta>
      )}

      {apartado === 'notas' && (
        <Tarjeta>
          <TituloSeccion accion={<Boton variante="fantasma" onClick={() => setNota({ tipo: 'seguimiento', fecha: hoy() })}>Nueva nota</Boton>}>Notas de psicología</TituloSeccion>
          {notas.length === 0 ? <Vacio texto="Sin notas." /> : (
            <ul className="divide-y divide-borde">
              {notas.map((n) => (
                <li key={n.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rotulo text-tinta-tenue">{fmtFecha(n.fecha)} · {TIPOS_NOTA[n.tipo]}</span>
                    <button type="button" className="text-[12px] text-tinta-tenue hover:text-marca" onClick={() => setNota(n)}>Editar</button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-tinta">{n.texto}</p>
                  {n.plan && <p className="mt-1 text-tinta-suave"><b>Plan:</b> {n.plan}</p>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      {nueva && (
        <ModalNuevaAplicacion paciente={pac} onCerrar={() => setNueva(false)} onCreada={(a, modo) => {
          setNueva(false)
          setAbierta(a.id)
          cargar()
          if (modo === 'presencial') setCapturar(a)
          else setCompartir(a)
        }} />
      )}
      {compartir && (
        <Modal titulo="Compartir enlace de evaluación" onCerrar={() => setCompartir(null)}>
          <CompartirEnlace token={compartir.token} nombre={pac.grado ?? undefined} />
        </Modal>
      )}
      {capturar && bat(capturar.bateria_id) && (
        <Captura ap={capturar} bateria={bat(capturar.bateria_id)!} onCerrar={() => setCapturar(null)} onGuardado={() => { setCapturar(null); cargar() }} />
      )}
      {nota && <ModalNota paciente={pac.id} nota={nota} onCerrar={() => setNota(null)} onGuardada={() => { setNota(null); cargar() }} />}
      {anular && <ModalAnular ap={anular} onCerrar={() => setAnular(null)} onAnulada={() => { setAnular(null); cargar() }} />}
    </div>
  )
}

function Observaciones({ inicial, onGuardar }: { inicial: string; onGuardar: (t: string) => void }) {
  const [t, setT] = useState(inicial)
  return (
    <Campo etiqueta="Observaciones de la psicóloga" hint="Van en el informe impreso.">
      <Textarea rows={3} value={t} onChange={(e) => setT(e.target.value)} onBlur={() => t !== inicial && onGuardar(t)} />
    </Campo>
  )
}

function ModalNota({ paciente, nota, onCerrar, onGuardada }: { paciente: string; nota: Partial<Nota>; onCerrar: () => void; onGuardada: () => void }) {
  const [f, setF] = useState({ fecha: nota.fecha ?? hoy(), tipo: (nota.tipo ?? 'seguimiento') as TipoNota, texto: nota.texto ?? '', plan: nota.plan ?? '' })
  const [error, setError] = useState<string | null>(null)
  async function guardar() {
    const fila = { ...f, plan: f.plan || null, paciente_id: paciente, aplicacion_id: nota.aplicacion_id ?? null }
    const { error } = nota.id
      ? await supabase.from('ps_notas').update(fila).eq('id', nota.id)
      : await supabase.from('ps_notas').insert(fila)
    if (error) return setError(error.message)
    onGuardada()
  }
  async function borrar() {
    if (!nota.id || !confirm('¿Eliminar esta nota?')) return
    const { error } = await supabase.from('ps_notas').delete().eq('id', nota.id)
    if (error) return setError(error.message)
    onGuardada()
  }
  return (
    <Modal titulo={nota.id ? 'Editar nota' : 'Nueva nota'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
          <Campo etiqueta="Tipo">
            <Select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoNota })}>
              {Object.entries(TIPOS_NOTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Campo>
        </div>
        <Campo etiqueta="Nota"><Textarea rows={6} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} /></Campo>
        <Campo etiqueta="Plan / próximos pasos"><Textarea rows={2} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></Campo>
        {error && <Alerta>{error}</Alerta>}
        <div className="flex justify-between gap-2">
          {nota.id ? <Boton variante="fantasma" className="text-alerta" onClick={borrar}>Eliminar</Boton> : <span />}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
            <Boton onClick={guardar} disabled={!f.texto.trim()}>Guardar</Boton>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ModalAnular({ ap, onCerrar, onAnulada }: { ap: Aplicacion; onCerrar: () => void; onAnulada: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function anular() {
    const { error } = await supabase.from('ps_aplicaciones').update({ estado: 'anulada', motivo_anulacion: motivo }).eq('id', ap.id)
    if (error) return setError(error.message)
    onAnulada()
  }
  return (
    <Modal titulo="Anular evaluación" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-tinta-suave">El enlace deja de abrir y sus resultados salen de las estadísticas. No se borra: queda en la ficha como anulada.</p>
        <Campo etiqueta="Motivo"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Respondió otra persona, error de batería…" /></Campo>
        {error && <Alerta>{error}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="peligro" onClick={anular} disabled={!motivo.trim()}>Anular</Boton>
        </div>
      </div>
    </Modal>
  )
}
