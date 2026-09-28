// ============================================================================
// 09 · ESTADÍSTICAS — cifras sin nombres
// ----------------------------------------------------------------------------
// Es la única pantalla del jefe de la S-4 y del Comandante. Todo sale de
// `ps_estadisticas()`, que la base sólo entrega agregado: ninguna fila trae
// una persona, las secciones con menos de cinco evaluados se funden en «Otras
// secciones», y si el filtro deja menos de cinco evaluados sólo hay totales.
// La psicóloga ve la misma pantalla con el mismo dato: lo que el mando ve es
// exactamente esto, ni más ni menos.
// ============================================================================

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useColoresGrafico } from '../lib/tema'
import { cargarProblemas } from '../lib/datos'
import { COLOR_NIVEL, NOMBRE_NIVEL, ORDEN_NIVEL, TIPOS_EVALUACION, fmtFechaHora, fmtMes } from '../lib/formato'
import { exportar } from '../lib/descargas'
import type { Estadisticas as Est, Problema, TipoEvaluacion } from '../lib/tipos'
import { Alerta, Boton, Campo, Cargando, Encabezado, EsqueletoMetricas, Input, Metrica, Select, Tarjeta, TituloSeccion, Vacio } from '../components/ui'
import { BarraNiveles, LeyendaNiveles } from '../components/psico'
import { useVidrio } from '../components/GraficoVidrio'

const Cerebro3D = lazy(() => import('../components/Cerebro3D'))

export default function Estadisticas() {
  const { esPsicologo } = useAuth()
  const c = useColoresGrafico()
  const vidrio = useVidrio([c.marca, c.alerta])
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipo, setTipo] = useState<'' | TipoEvaluacion>('')
  const [conv, setConv] = useState('')
  const [est, setEst] = useState<Est | null>(null)
  const [convs, setConvs] = useState<NonNullable<Est['convocatorias']>>([])
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [foco, setFoco] = useState<string | null>(null)

  useEffect(() => { cargarProblemas().then(setProblemas).catch(() => {}) }, [])

  useEffect(() => {
    setCargando(true)
    supabase.rpc('ps_estadisticas', {
      p_desde: desde || null, p_hasta: hasta || null, p_convocatoria: conv || null, p_tipo: tipo || null,
    }).then(({ data, error }) => {
      setCargando(false)
      if (error) return setError(error.message)
      setError(null)
      const e = data as Est
      setEst(e)
      if (!conv && e.convocatorias) setConvs(e.convocatorias)
    })
  }, [desde, hasta, tipo, conv])

  const pesos = useMemo(() => Object.fromEntries(Object.entries(est?.regiones ?? {}).map(([k, v]) => [Number(k), v])), [est])
  const t = est?.totales

  function csv() {
    if (!est) return
    const filas: (string | number)[][] = []
    const add = (bloque: string, clave: string, valor: number | string) => filas.push([bloque, clave, valor])
    Object.entries(est.totales).forEach(([k, v]) => add('Totales', k, v))
    est.por_problema?.forEach((p) => add('Problemas (personas)', p.nombre, p.personas))
    est.por_seccion?.forEach((s) => add('Secciones (evaluados / con hallazgo)', s.seccion, `${s.evaluados} / ${s.con_hallazgo}`))
    est.por_mes?.forEach((m) => add('Mes (completadas / con hallazgo)', m.mes, `${m.completadas} / ${m.con_hallazgo}`))
    est.por_instrumento?.forEach((i) => add('Escalas (promedio)', `${i.nombre} · ${i.escala}`, i.promedio))
    exportar('estadistica_psicologia', ['Bloque', 'Concepto', 'Valor'], filas)
  }

  return (
    <div className="space-y-5">
      <Encabezado indice={esPsicologo ? '09 / Estadísticas' : '01 / Estadísticas'} titulo="Estadísticas de salud mental"
        detalle="Evaluaciones realizadas y problemas identificados en el destacamento. Sólo cifras: ningún dato de esta pantalla identifica a una persona."
        folio={est ? `Generado ${fmtFechaHora(est.generado)}` : undefined}
        accion={<><Boton variante="secundario" onClick={csv} disabled={!est}>CSV</Boton><Boton variante="secundario" onClick={() => window.print()}>Imprimir / PDF</Boton></>} />

      <Tarjeta className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Campo etiqueta="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo etiqueta="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Campo etiqueta="Tipo de evaluación">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_EVALUACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Convocatoria">
          <Select value={conv} onChange={(e) => setConv(e.target.value)}>
            <option value="">Todas</option>
            {convs.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Select>
        </Campo>
      </Tarjeta>

      {error && <Alerta>{error}</Alerta>}
      {!t ? <EsqueletoMetricas n={4} /> : (
        <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${cargando ? 'opacity-60' : ''}`}>
          <Metrica titulo="Evaluaciones completadas" numero={t.completadas} detalle={`${t.evaluados} personas evaluadas`} tono="verde" />
          <Metrica titulo="Convocados sin responder" numero={t.pendientes + t.en_curso} proporcion={t.aplicaciones ? t.completadas / t.aplicaciones : 0}
            detalle={t.aplicaciones ? `${Math.round((t.completadas / t.aplicaciones) * 100)} % de respuesta` : undefined} />
          <Metrica titulo="Con problema identificado" numero={t.con_hallazgo} tono={t.con_hallazgo ? 'ambar' : 'neutro'}
            detalle={t.completadas ? `${Math.round((t.con_hallazgo / t.completadas) * 100)} % · nivel moderado o mayor` : undefined}
            proporcion={t.completadas ? t.con_hallazgo / t.completadas : 0} />
          <Metrica titulo="Alertas de riesgo" numero={t.con_alerta} tono={t.con_alerta ? 'rojo' : 'neutro'} detalle="atendidas por Psicología" />
        </div>
      )}

      {est && !est.suficiente && !esPsicologo && (
        <Alerta tono="info">
          Con este filtro hay menos de {est.minimo_grupo} personas evaluadas. Para proteger su identidad sólo se muestran los totales:
          amplíe el período o quite el filtro de convocatoria.
        </Alerta>
      )}

      {est?.por_problema && (
        <div className="grid gap-4 xl:grid-cols-5">
          <Tarjeta className="xl:col-span-2">
            <TituloSeccion>Problemas identificados · personas</TituloSeccion>
            {est.por_problema.length === 0 ? <Vacio texto="Ningún problema identificado en el período." /> : (
              <div className="space-y-1 p-2">
                {est.por_problema.map((p) => (
                  <button key={p.problema} type="button" onClick={() => setFoco(foco === p.problema ? null : p.problema)}
                    className={`pulsable w-full rounded-control px-3 py-2 text-left ${foco === p.problema ? 'bg-superficie-alta' : 'fila-liquida'}`}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.nombre}</span></span>
                      <span className="cifras shrink-0">{p.personas}{t?.evaluados ? <span className="text-tinta-tenue"> · {Math.round((p.personas / t.evaluados) * 100)} %</span> : null}</span>
                    </div>
                    <div className="mt-1.5"><BarraNiveles cuenta={{ leve: p.leve, moderado: p.moderado, severo: p.severo, critico: p.critico }} alto={5} /></div>
                  </button>
                ))}
                <div className="px-3 pt-2"><LeyendaNiveles niveles={['leve', 'moderado', 'severo', 'critico']} /></div>
              </div>
            )}
          </Tarjeta>
          <Tarjeta className="xl:col-span-3">
            <TituloSeccion>Áreas cerebrales involucradas{foco ? ` · ${est.por_problema.find((p) => p.problema === foco)?.nombre ?? ''}` : ''}</TituloSeccion>
            <div className="p-4">
              <Suspense fallback={<Cargando texto="Cargando visor 3D…" />}>
                <Cerebro3D pesos={pesos} resaltar={foco} alto={420}
                  problemas={est.por_problema.map((p) => ({
                    clave: p.problema, nombre: p.nombre, color: p.color, regiones: p.regiones,
                    explicacion: problemas.find((x) => x.clave === p.problema)?.explicacion,
                  }))} />
              </Suspense>
            </div>
          </Tarjeta>
        </div>
      )}

      {est?.por_nivel && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta>
            <TituloSeccion>Resultado global de las evaluaciones</TituloSeccion>
            <div className="space-y-3 p-4">
              <BarraNiveles cuenta={est.por_nivel} alto={14} />
              <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                {ORDEN_NIVEL.map((n) => (
                  <li key={n} className="rounded-control border border-borde p-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-tinta-tenue"><span className="h-2 w-2 rounded-full" style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}</div>
                    <div className="cifras mt-1 text-xl font-semibold">{est.por_nivel?.[n] ?? 0}</div>
                  </li>
                ))}
              </ul>
              {est.por_tipo && Object.keys(est.por_tipo).length > 0 && (
                <p className="text-[12px] text-tinta-tenue">
                  Por tipo: {Object.entries(est.por_tipo).map(([k, v]) => `${TIPOS_EVALUACION[k as TipoEvaluacion]} ${v}`).join(' · ')}
                </p>
              )}
            </div>
          </Tarjeta>
          <Tarjeta>
            <TituloSeccion>Evolución mensual</TituloSeccion>
            <div className="p-4">
              {!est.por_mes?.length ? <Vacio texto="Sin evaluaciones en el período." /> : (
                <>
                  {vidrio.defs}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={est.por_mes.map((m) => ({ ...m, mes: fmtMes(m.mes), sin: m.completadas - m.con_hallazgo }))} margin={{ top: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={c.rejilla} vertical={false} />
                      <XAxis dataKey="mes" stroke={c.eje} fontSize={11} tickLine={false} />
                      <YAxis stroke={c.eje} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: c.rejilla, opacity: 0.4 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sin" name="Sin problema relevante" stackId="a" fill={c.marca} isAnimationActive={vidrio.animar} />
                      <Bar dataKey="con_hallazgo" name="Con problema identificado" stackId="a" fill={c.alerta} isAnimationActive={vidrio.animar} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </Tarjeta>
        </div>
      )}

      {est?.por_seccion && est.por_seccion.length > 0 && (
        <Tarjeta>
          <TituloSeccion>Por sección</TituloSeccion>
          <ul className="divide-y divide-borde">
            {est.por_seccion.map((s) => (
              <li key={s.seccion} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[16rem_1fr_auto]">
                <span className="truncate">{s.seccion}</span>
                <span className="cifras text-right text-tinta-suave sm:order-3">{s.con_hallazgo} / {s.evaluados}</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-pastilla bg-superficie-alta sm:col-span-1">
                  <span className="block h-full" style={{ width: `${s.evaluados ? (s.con_hallazgo / s.evaluados) * 100 : 0}%`, background: COLOR_NIVEL.moderado }} />
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 pb-3 text-[11px] text-tinta-tenue">Con problema moderado o mayor / evaluados. Las secciones con menos de {est.minimo_grupo} evaluados se agrupan en «Otras secciones».</p>
        </Tarjeta>
      )}

      {est?.por_instrumento && est.por_instrumento.length > 0 && (
        <Tarjeta>
          <TituloSeccion>Por instrumento y escala</TituloSeccion>
          <div className="cinta overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-borde text-left text-tinta-tenue">
                <tr>
                  <th className="rotulo px-4 py-2">Instrumento · escala</th>
                  <th className="rotulo px-2 py-2 text-right">Aplicados</th>
                  <th className="rotulo px-2 py-2 text-right">Promedio</th>
                  <th className="rotulo w-1/3 px-4 py-2">Distribución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {est.por_instrumento.map((i) => (
                  <tr key={`${i.instrumento}-${i.escala}`}>
                    <td className="px-4 py-2">{i.nombre} <span className="text-tinta-tenue">· {i.escala}</span></td>
                    <td className="cifras px-2 py-2 text-right">{i.aplicados}</td>
                    <td className="cifras px-2 py-2 text-right">{i.promedio}</td>
                    <td className="px-4 py-2"><BarraNiveles cuenta={{ normal: i.normal, leve: i.leve, moderado: i.moderado, severo: i.severo }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {est?.convocatorias && est.convocatorias.length > 0 && (
        <Tarjeta>
          <TituloSeccion>Convocatorias</TituloSeccion>
          <ul className="divide-y divide-borde">
            {est.convocatorias.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{x.nombre} <span className="text-tinta-tenue">· {TIPOS_EVALUACION[x.tipo]}</span></span>
                <span className="cifras shrink-0 text-tinta-suave">{x.completadas} / {x.asignadas} respondieron</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <p className="text-[11px] leading-relaxed text-tinta-tenue">
        Fuente: evaluaciones psicológicas aplicadas por la Sección de Sanidad. Las cifras de problemas cuentan personas, no evaluaciones.
        Los resultados psicométricos son orientativos y no sustituyen la valoración clínica. Documento de uso interno del mando.
      </p>
    </div>
  )
}
