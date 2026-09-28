// ============================================================================
// 02 · EVALUADOS
// ----------------------------------------------------------------------------
// El padrón compartido con la consulta médica y odontología, visto desde
// psicología: cuántas evaluaciones tiene cada efectivo, la última, y el nivel
// más alto que se le identificó. Desde aquí se abre su ficha psicológica.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { padron, plano } from '../lib/datos'
import { ORDEN_NIVEL, fmtFecha } from '../lib/formato'
import type { Nivel, PacienteBreve } from '../lib/tipos'
import { Alerta, Buscador, Campo, Encabezado, EsqueletoTabla, EtiquetaNivel, Paginador, Select, Tarjeta, Vacio } from '../components/ui'

interface Resumen { total: number; completadas: number; pendientes: number; ultima: string | null; nivel: Nivel | null; alerta: boolean }

const POR_PAGINA = 50

export default function Evaluados() {
  const [lista, setLista] = useState<PacienteBreve[] | null>(null)
  const [res, setRes] = useState<Record<string, Resumen>>({})
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [seccion, setSeccion] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'evaluados' | 'sin' | 'hallazgo' | 'alerta'>('todos')
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    Promise.all([
      padron(),
      supabase.from('ps_aplicaciones').select('paciente_id, estado, completada_en, nivel_max, alerta').neq('estado', 'anulada').range(0, 9999),
    ]).then(([p, a]) => {
      if (a.error) setError(a.error.message)
      const m: Record<string, Resumen> = {}
      for (const x of (a.data ?? []) as { paciente_id: string; estado: string; completada_en: string | null; nivel_max: Nivel | null; alerta: boolean }[]) {
        const r = (m[x.paciente_id] ??= { total: 0, completadas: 0, pendientes: 0, ultima: null, nivel: null, alerta: false })
        r.total++
        if (x.estado === 'completada') {
          r.completadas++
          if (!r.ultima || (x.completada_en && x.completada_en > r.ultima)) r.ultima = x.completada_en
          if (x.nivel_max && (!r.nivel || ORDEN_NIVEL.indexOf(x.nivel_max) > ORDEN_NIVEL.indexOf(r.nivel))) r.nivel = x.nivel_max
          r.alerta ||= x.alerta
        } else r.pendientes++
      }
      setRes(m)
      setLista(p)
    }).catch((e) => setError(e.message))
  }, [])

  const secciones = useMemo(() => [...new Set((lista ?? []).map((p) => p.seccion).filter(Boolean) as string[])].sort(), [lista])

  const filtrados = useMemo(() => {
    const t = plano(q.trim())
    return (lista ?? []).filter((p) => {
      if (t && !plano(`${p.codigo ?? ''} ${p.grado ?? ''} ${p.nombre_completo}`).includes(t)) return false
      if (seccion && p.seccion !== seccion) return false
      const r = res[p.id]
      if (filtro === 'evaluados') return !!r?.completadas
      if (filtro === 'sin') return !r?.completadas
      if (filtro === 'hallazgo') return !!r?.nivel && ORDEN_NIVEL.indexOf(r.nivel) >= 2
      if (filtro === 'alerta') return !!r?.alerta
      return true
    }).sort((a, b) => {
      // Con alerta primero, luego por gravedad, luego por nombre.
      const ra = res[a.id], rb = res[b.id]
      const ga = (ra?.alerta ? 10 : 0) + (ra?.nivel ? ORDEN_NIVEL.indexOf(ra.nivel) : -1)
      const gb = (rb?.alerta ? 10 : 0) + (rb?.nivel ? ORDEN_NIVEL.indexOf(rb.nivel) : -1)
      return filtro === 'todos' ? a.nombre_completo.localeCompare(b.nombre_completo) : gb - ga || a.nombre_completo.localeCompare(b.nombre_completo)
    })
  }, [lista, q, seccion, filtro, res])

  useEffect(() => setPagina(0), [q, seccion, filtro])
  const paginas = Math.ceil(filtrados.length / POR_PAGINA)
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const evaluados = Object.values(res).filter((r) => r.completadas).length

  return (
    <div className="space-y-4">
      <Encabezado indice="02 / Evaluados" titulo="Evaluados"
        detalle="El padrón del destacamento con sus evaluaciones psicológicas. Los nombres sólo los ve Psicología."
        folio={lista ? `${evaluados} evaluados de ${lista.length}` : undefined} />
      {error && <Alerta>{error}</Alerta>}

      <Tarjeta className="grid gap-3 p-4 sm:grid-cols-[1fr_14rem_14rem]">
        <Buscador valor={q} onCambio={setQ} placeholder="Nombre, grado o número de padrón" />
        <Campo etiqueta="Sección">
          <Select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="">Todas</option>
            {secciones.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Mostrar">
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todos">Todo el padrón</option>
            <option value="evaluados">Con evaluación</option>
            <option value="sin">Sin evaluar</option>
            <option value="hallazgo">Con problema moderado o mayor</option>
            <option value="alerta">Con alerta de riesgo</option>
          </Select>
        </Campo>
      </Tarjeta>

      <Tarjeta>
        {!lista ? <div className="p-4"><EsqueletoTabla /></div> : filtrados.length === 0 ? <Vacio texto="Sin coincidencias." /> : (
          <div className="cinta overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-borde bg-superficie-alta text-left text-tinta-tenue">
                <tr>
                  <th className="rotulo px-3 py-3">N°</th>
                  <th className="rotulo px-3 py-3">Grado y nombre</th>
                  <th className="rotulo px-3 py-3">Sección</th>
                  <th className="rotulo px-3 py-3">Evaluaciones</th>
                  <th className="rotulo px-3 py-3">Última</th>
                  <th className="rotulo px-3 py-3">Nivel más alto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((p) => {
                  const r = res[p.id]
                  return (
                    <tr key={p.id} className="fila-viva transition-colors hover:bg-superficie-alta/40">
                      <td className="cifras px-3 py-2 text-xs text-tinta-tenue">{p.codigo}</td>
                      <td className="px-3 py-2">
                        <Link to={`/evaluados/${p.id}`} className="text-tinta hover:text-marca hover:underline">
                          <span className="text-xs text-tinta-tenue">{p.grado} </span>{p.nombre_completo}
                        </Link>
                        <div className="text-[11px] text-tinta-tenue">{p.cargo}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-tinta-suave">{p.seccion}</td>
                      <td className="cifras px-3 py-2 text-xs text-tinta-suave">
                        {r ? <>{r.completadas}{r.pendientes ? <span className="text-tinta-tenue"> + {r.pendientes} pend.</span> : null}</> : '—'}
                      </td>
                      <td className="cifras px-3 py-2 text-xs text-tinta-suave">{r?.ultima ? fmtFecha(r.ultima) : '—'}</td>
                      <td className="px-3 py-2">
                        {r?.completadas ? (
                          <span className="inline-flex gap-1">
                            <EtiquetaNivel nivel={r.nivel} />
                            {r.alerta && <EtiquetaNivel nivel="critico" texto="Alerta" />}
                          </span>
                        ) : <span className="text-xs text-tinta-tenue">Sin evaluar</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={pagina} paginas={paginas} total={filtrados.length} onIr={setPagina} />
      </Tarjeta>
    </div>
  )
}
