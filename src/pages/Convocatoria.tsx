// ============================================================================
// 05b · UNA CONVOCATORIA
// ----------------------------------------------------------------------------
// Los enlaces de una cohorte listos para repartir: uno por persona (copiar,
// WhatsApp, QR impreso), el de cohorte con su PIN, la lista en CSV para un
// envío masivo y el avance de quién ya respondió.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarBaterias, cargarInstrumentos, nombreDe, pacientesPorId } from '../lib/datos'
import { TIPOS_EVALUACION, enlaceEvaluacion, fmtFecha, fmtFechaHora, hoy } from '../lib/formato'
import { exportar } from '../lib/descargas'
import { hojaEnBlanco, listaEnlaces } from '../lib/impresos'
import type { Aplicacion, Bateria, Convocatoria as Conv, PacienteBreve } from '../lib/tipos'
import { Alerta, Boton, BotonEnlace, Cargando, Encabezado, EtiquetaNivel, Metrica, Modal, Tarjeta, TituloSeccion, Vacio } from '../components/ui'
import { EstadoAplicacion } from '../components/psico'
import { CompartirEnlace } from '../components/Enlace'
import { ModalConvocatoria } from './Convocatorias'

type Fila = Pick<Aplicacion, 'id' | 'paciente_id' | 'token' | 'estado' | 'origen' | 'identidad_confirmada' | 'completada_en' | 'nivel_max' | 'alerta' | 'revisada'>

export default function Convocatoria() {
  const { id = '' } = useParams()
  const avisos = useAvisos()
  const [conv, setConv] = useState<Conv | null>(null)
  const [aps, setAps] = useState<Fila[]>([])
  const [pac, setPac] = useState<Record<string, PacienteBreve>>({})
  const [bateria, setBateria] = useState<Bateria | null>(null)
  const [baterias, setBaterias] = useState<Bateria[]>([])
  const [error, setError] = useState<string | null>(null)
  const [compartir, setCompartir] = useState<Fila | null>(null)
  const [anadir, setAnadir] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)

  const cargar = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from('ps_convocatorias').select('*').eq('id', id).maybeSingle(),
      supabase.from('ps_aplicaciones').select('id, paciente_id, token, estado, origen, identidad_confirmada, completada_en, nivel_max, alerta, revisada')
        .eq('convocatoria_id', id).neq('estado', 'anulada').range(0, 4999),
    ])
    if (c.error || a.error) setError((c.error ?? a.error)!.message)
    const filas = (a.data ?? []) as Fila[]
    const p = await pacientesPorId(filas.map((x) => x.paciente_id))
    filas.sort((x, y) => (p[x.paciente_id]?.nombre_completo ?? '').localeCompare(p[y.paciente_id]?.nombre_completo ?? ''))
    setPac(p)
    setAps(filas)
    setConv(c.data as Conv | null)
    const bs = await cargarBaterias()
    setBaterias(bs)
    setBateria(bs.find((b) => b.id === (c.data as Conv | null)?.bateria_id) ?? null)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const k = useMemo(() => ({
    total: aps.length,
    completadas: aps.filter((a) => a.estado === 'completada').length,
    en_curso: aps.filter((a) => a.estado === 'en_curso').length,
    alertas: aps.filter((a) => a.alerta).length,
    identidad: aps.filter((a) => !a.identidad_confirmada).length,
  }), [aps])

  if (error && !conv) return <Alerta>{error}</Alerta>
  if (!conv) return <Cargando texto="Abriendo convocatoria…" />

  const general = conv.permite_general ? enlaceEvaluacion(conv.token_general) : null
  const abierta = conv.estado === 'abierta' && (!conv.cierra_en || conv.cierra_en >= hoy())

  async function cambiar(cambios: Partial<Conv>, msg: string) {
    const { error } = await supabase.from('ps_convocatorias').update(cambios).eq('id', conv!.id)
    if (error) return avisos.error(error.message)
    avisos.exito(msg)
    cargar()
  }

  const filasEnlace = () => aps.filter((a) => a.estado !== 'completada').map((a) => {
    const p = pac[a.paciente_id]
    return { nombre: nombreDe(p), codigo: p?.codigo ?? null, seccion: p?.seccion ?? null, enlace: enlaceEvaluacion(a.token), estado: a.estado }
  })

  function csv() {
    exportar(`enlaces_${conv!.nombre.replace(/\W+/g, '_')}`, ['N° padrón', 'Grado', 'Nombre', 'Sección', 'Teléfono', 'Estado', 'Enlace'],
      aps.map((a) => {
        const p = pac[a.paciente_id]
        return [p?.codigo, p?.grado, p?.nombre_completo, p?.seccion, '', a.estado, enlaceEvaluacion(a.token)]
      }))
  }

  async function copiarTodos() {
    const texto = filasEnlace().map((f) => `${f.nombre}: ${f.enlace}`).join('\n')
    try { await navigator.clipboard.writeText(texto); avisos.exito(`${filasEnlace().length} enlaces copiados.`) }
    catch { avisos.error('No se pudo copiar.') }
  }

  async function imprimir() {
    setImprimiendo(true)
    try { await listaEnlaces({ convocatoria: conv!, bateria, filas: filasEnlace(), general }) }
    finally { setImprimiendo(false) }
  }

  return (
    <div className="space-y-5">
      <Encabezado indice="05 / Convocatoria" titulo={conv.nombre}
        antes={<BotonEnlace to="/convocatorias" variante="fantasma">← Convocatorias</BotonEnlace>}
        detalle={`${TIPOS_EVALUACION[conv.tipo]} · ${bateria?.nombre ?? ''} · ${conv.cohorte ?? ''} · ${fmtFecha(conv.abre_en)} – ${fmtFecha(conv.cierra_en)}`}
        accion={<>
          {abierta && <Boton variante="secundario" onClick={() => setAnadir(true)}>Añadir personas</Boton>}
          {conv.estado === 'abierta'
            ? <Boton variante="secundario" onClick={() => cambiar({ estado: 'cerrada' }, 'Convocatoria cerrada: los enlaces dejan de abrir.')}>Cerrar</Boton>
            : <Boton variante="secundario" onClick={() => cambiar({ estado: 'abierta' }, 'Convocatoria reabierta.')}>Reabrir</Boton>}
        </>} />
      {error && <Alerta>{error}</Alerta>}
      {!abierta && <Alerta tono="aviso">La convocatoria está {conv.estado === 'cerrada' ? 'cerrada' : 'vencida'}: los enlaces no abren. {conv.estado === 'abierta' && 'Cambie la fecha de cierre para reactivarla.'}</Alerta>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica titulo="Respondieron" numero={k.completadas} detalle={`de ${k.total} convocados`} proporcion={k.total ? k.completadas / k.total : 0} tono="verde" />
        <Metrica titulo="Respondiendo ahora" numero={k.en_curso} />
        <Metrica titulo="Alertas" numero={k.alertas} tono={k.alertas ? 'rojo' : 'neutro'} />
        <Metrica titulo="Identidad por confirmar" numero={k.identidad} tono={k.identidad ? 'ambar' : 'neutro'} detalle="entraron por el enlace de cohorte" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <TituloSeccion>Repartir enlaces personales</TituloSeccion>
          <div className="space-y-3 p-4 text-sm text-tinta-suave">
            <p>Cada persona tiene un enlace propio: al responder, el resultado se asigna solo a su ficha.</p>
            <div className="flex flex-wrap gap-2">
              <Boton onClick={imprimir} disabled={imprimiendo || !filasEnlace().length}>{imprimiendo ? 'Preparando QR…' : 'Imprimir con QR'}</Boton>
              <Boton variante="secundario" onClick={copiarTodos} disabled={!filasEnlace().length}>Copiar lista</Boton>
              <Boton variante="secundario" onClick={csv} disabled={!aps.length}>CSV para envío masivo</Boton>
              {bateria && <Boton variante="fantasma" onClick={async () => hojaEnBlanco({ bateria, instrumentos: await cargarInstrumentos() })}>Hoja en papel</Boton>}
            </div>
          </div>
        </Tarjeta>
        <Tarjeta>
          <TituloSeccion accion={
            <Boton variante="fantasma" onClick={() => cambiar({ permite_general: !conv.permite_general }, conv.permite_general ? 'Enlace de cohorte desactivado.' : 'Enlace de cohorte activado.')}>
              {conv.permite_general ? 'Desactivar' : 'Activar'}
            </Boton>
          }>Enlace de cohorte</TituloSeccion>
          <div className="space-y-3 p-4">
            {conv.permite_general ? (
              <>
                <p className="text-sm text-tinta-suave">Un solo enlace para el grupo. Cada quien escribe su número de padrón y este PIN, que conviene decir en persona:</p>
                <div className="cifras text-3xl font-semibold tracking-[0.3em] text-tinta">{conv.pin}</div>
                <CompartirEnlace token={conv.token_general} compacto />
                <p className="text-[11px] text-tinta-tenue">
                  Quien entra así queda con «identidad por confirmar» hasta que usted la valide en su ficha.
                  {conv.intentos_fallidos > 0 && ` Intentos fallidos: ${conv.intentos_fallidos} (a los 40 el enlace se bloquea).`}
                </p>
              </>
            ) : <p className="text-sm text-tinta-tenue">Desactivado. Sólo funcionan los enlaces personales.</p>}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta>
        <TituloSeccion>Convocados</TituloSeccion>
        {aps.length === 0 ? <Vacio texto="Sin personas todavía." /> : (
          <div className="cinta overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-borde bg-superficie-alta text-left text-tinta-tenue">
                <tr>
                  <th className="rotulo px-3 py-3">Evaluado</th>
                  <th className="rotulo px-3 py-3">Estado</th>
                  <th className="rotulo px-3 py-3">Respondió</th>
                  <th className="rotulo px-3 py-3">Resultado</th>
                  <th className="rotulo px-3 py-3"><span className="sr-only">Enlace</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {aps.map((a) => (
                  <tr key={a.id} className="hover:bg-superficie-alta/40">
                    <td className="px-3 py-2">
                      <Link to={`/evaluados/${a.paciente_id}?ap=${a.id}`} className="hover:text-marca hover:underline">{nombreDe(pac[a.paciente_id])}</Link>
                      <div className="text-[11px] text-tinta-tenue">{pac[a.paciente_id]?.codigo} · {pac[a.paciente_id]?.seccion}</div>
                    </td>
                    <td className="px-3 py-2"><EstadoAplicacion ap={a} /></td>
                    <td className="cifras px-3 py-2 text-xs text-tinta-suave">{fmtFechaHora(a.completada_en)}</td>
                    <td className="px-3 py-2">{a.estado === 'completada' ? <span className="inline-flex gap-1"><EtiquetaNivel nivel={a.nivel_max} />{a.alerta && <EtiquetaNivel nivel="critico" texto="Alerta" />}</span> : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {a.estado !== 'completada' && <button type="button" onClick={() => setCompartir(a)} className="rotulo px-2 py-1 text-tinta-tenue hover:text-marca">Enlace</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {compartir && (
        <Modal titulo={`Enlace de ${nombreDe(pac[compartir.paciente_id])}`} onCerrar={() => setCompartir(null)}>
          <CompartirEnlace token={compartir.token} nombre={pac[compartir.paciente_id]?.grado ?? undefined} />
        </Modal>
      )}
      {anadir && (
        <ModalConvocatoria baterias={baterias} existente={{ ...conv, yaIncluidos: new Set(aps.map((a) => a.paciente_id)) }}
          onCerrar={() => setAnadir(false)} onCreada={() => { setAnadir(false); cargar() }} />
      )}
    </div>
  )
}
