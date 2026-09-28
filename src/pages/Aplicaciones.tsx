// ============================================================================
// 04 · APLICACIONES
// ----------------------------------------------------------------------------
// Todas las evaluaciones —una batería para una persona— en un solo listado:
// qué falta responder, qué está por revisar, qué salió alto. Se filtra por
// estado, batería, convocatoria y tipo, y se exporta a CSV para el archivo
// de Psicología (con nombres: este archivo NO va al mando).
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarBaterias, nombreDe, pacientesPorId, plano } from '../lib/datos'
import { ESTADOS_APLICACION, NOMBRE_NIVEL, TIPOS_EVALUACION, enlaceEvaluacion, fmtFecha, fmtFechaHora } from '../lib/formato'
import { exportar } from '../lib/descargas'
import type { Aplicacion, Bateria, Convocatoria, EstadoAplicacion as Estado, PacienteBreve, TipoEvaluacion } from '../lib/tipos'
import { Alerta, Boton, Buscador, Campo, Encabezado, EsqueletoTabla, EtiquetaNivel, Paginador, Select, Tarjeta, Vacio } from '../components/ui'
import { EstadoAplicacion } from '../components/psico'

type Fila = Omit<Aplicacion, 'respuestas'>
const POR_PAGINA = 50

export default function Aplicaciones() {
  const avisos = useAvisos()
  const [aps, setAps] = useState<Fila[] | null>(null)
  const [pac, setPac] = useState<Record<string, PacienteBreve>>({})
  const [baterias, setBaterias] = useState<Bateria[]>([])
  const [convs, setConvs] = useState<Pick<Convocatoria, 'id' | 'nombre'>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'' | Estado | 'por_revisar' | 'alerta'>('')
  const [bateria, setBateria] = useState('')
  const [conv, setConv] = useState('')
  const [tipo, setTipo] = useState<'' | TipoEvaluacion>('')
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('ps_aplicaciones')
        .select('id, convocatoria_id, bateria_id, paciente_id, tipo, token, origen, identidad_confirmada, estado, vence_en, iniciada_en, completada_en, contexto, resultados, calificada_en, nivel_max, alerta, validez_dudosa, revisada, revisada_en, observaciones, motivo_anulacion, creado_en')
        .order('creado_en', { ascending: false }).range(0, 4999),
      supabase.from('ps_convocatorias').select('id, nombre').order('creado_en', { ascending: false }),
      cargarBaterias(),
    ]).then(async ([a, c, b]) => {
      if (a.error) setError(a.error.message)
      const filas = (a.data ?? []) as Fila[]
      setConvs((c.data ?? []) as typeof convs)
      setBaterias(b)
      setPac(await pacientesPorId(filas.map((x) => x.paciente_id)))
      setAps(filas)
    }).catch((e) => setError(e.message))
  }, [])

  const filtradas = useMemo(() => {
    const t = plano(q.trim())
    return (aps ?? []).filter((a) => {
      if (estado === 'por_revisar') { if (a.estado !== 'completada' || a.revisada) return false }
      else if (estado === 'alerta') { if (!a.alerta) return false }
      else if (estado && a.estado !== estado) return false
      if (bateria && a.bateria_id !== bateria) return false
      if (conv && a.convocatoria_id !== conv) return false
      if (tipo && a.tipo !== tipo) return false
      if (t) {
        const p = pac[a.paciente_id]
        if (!p || !plano(`${p.codigo ?? ''} ${p.grado ?? ''} ${p.nombre_completo}`).includes(t)) return false
      }
      return true
    })
  }, [aps, q, estado, bateria, conv, tipo, pac])

  useEffect(() => setPagina(0), [q, estado, bateria, conv, tipo])
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const bat = (id: string) => baterias.find((b) => b.id === id)?.nombre ?? '—'

  function csv() {
    exportar('evaluaciones_psicologia', [
      'N° padrón', 'Grado', 'Nombre', 'Sección', 'Batería', 'Tipo', 'Estado', 'Creada', 'Completada', 'Nivel', 'Alerta', 'Validez dudosa', 'Revisada', 'Escalas',
    ], filtradas.map((a) => {
      const p = pac[a.paciente_id]
      const escalas = (a.resultados?.instrumentos ?? []).flatMap((i) => i.escalas.map((e) => `${i.sigla ?? i.instrumento} ${e.clave}=${e.t ?? e.bruta}`)).join('; ')
      return [p?.codigo, p?.grado, p?.nombre_completo, p?.seccion, bat(a.bateria_id), TIPOS_EVALUACION[a.tipo], ESTADOS_APLICACION[a.estado].etiqueta,
        fmtFecha(a.creado_en), fmtFecha(a.completada_en), a.nivel_max ? NOMBRE_NIVEL[a.nivel_max] : '', a.alerta ? 'Sí' : '', a.validez_dudosa ? 'Sí' : '', a.revisada ? 'Sí' : '', escalas]
    }))
  }

  async function copiar(a: Fila) {
    try { await navigator.clipboard.writeText(enlaceEvaluacion(a.token)); avisos.exito('Enlace copiado.') }
    catch { avisos.error('No se pudo copiar.') }
  }

  return (
    <div className="space-y-4">
      <Encabezado indice="04 / Aplicaciones" titulo="Aplicaciones"
        detalle="Cada evaluación es una batería aplicada a una persona. Aquí se sigue su estado, se abre su resultado y se copia su enlace."
        folio={aps ? `${filtradas.length} de ${aps.length}` : undefined}
        accion={<Boton variante="secundario" onClick={csv} disabled={!filtradas.length}>Exportar CSV</Boton>} />
      {error && <Alerta>{error}</Alerta>}

      <Tarjeta className="grid gap-3 p-4 md:grid-cols-5">
        <div className="md:col-span-5"><Buscador valor={q} onCambio={setQ} placeholder="Nombre, grado o número de padrón" /></div>
        <Campo etiqueta="Estado">
          <Select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completadas</option>
            <option value="por_revisar">Completadas sin revisar</option>
            <option value="alerta">Con alerta</option>
            <option value="anulada">Anuladas</option>
          </Select>
        </Campo>
        <Campo etiqueta="Batería">
          <Select value={bateria} onChange={(e) => setBateria(e.target.value)}>
            <option value="">Todas</option>
            {baterias.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Convocatoria">
          <Select value={conv} onChange={(e) => setConv(e.target.value)}>
            <option value="">Todas</option>
            {convs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_EVALUACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Campo>
      </Tarjeta>

      <Tarjeta>
        {!aps ? <div className="p-4"><EsqueletoTabla /></div> : filtradas.length === 0 ? <Vacio texto="Sin evaluaciones con esos filtros." /> : (
          <div className="cinta overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-borde bg-superficie-alta text-left text-tinta-tenue">
                <tr>
                  <th className="rotulo px-3 py-3">Evaluado</th>
                  <th className="rotulo px-3 py-3">Batería · tipo</th>
                  <th className="rotulo px-3 py-3">Estado</th>
                  <th className="rotulo px-3 py-3">Fecha</th>
                  <th className="rotulo px-3 py-3">Resultado</th>
                  <th className="rotulo px-3 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((a) => (
                  <tr key={a.id} className="fila-viva hover:bg-superficie-alta/40">
                    <td className="px-3 py-2">
                      <Link to={`/evaluados/${a.paciente_id}?ap=${a.id}`} className="text-tinta hover:text-marca hover:underline">{nombreDe(pac[a.paciente_id])}</Link>
                      <div className="text-[11px] text-tinta-tenue">{pac[a.paciente_id]?.seccion}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-tinta-suave">{bat(a.bateria_id)}<div className="text-tinta-tenue">{TIPOS_EVALUACION[a.tipo]}</div></td>
                    <td className="px-3 py-2"><EstadoAplicacion ap={a} /></td>
                    <td className="cifras px-3 py-2 text-xs text-tinta-suave">{a.completada_en ? fmtFechaHora(a.completada_en) : fmtFecha(a.creado_en)}</td>
                    <td className="px-3 py-2">
                      {a.estado === 'completada' ? (
                        <span className="inline-flex flex-wrap gap-1">
                          <EtiquetaNivel nivel={a.nivel_max} />
                          {a.alerta && <EtiquetaNivel nivel="critico" texto="Alerta" />}
                          {!a.revisada && <span className="text-[11px] text-aviso">sin revisar</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(a.estado === 'pendiente' || a.estado === 'en_curso') && (
                        <button type="button" onClick={() => copiar(a)} className="rotulo px-2 py-1 text-tinta-tenue hover:text-marca">Copiar enlace</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={pagina} paginas={Math.ceil(filtradas.length / POR_PAGINA)} total={filtradas.length} onIr={setPagina} />
      </Tarjeta>
    </div>
  )
}
