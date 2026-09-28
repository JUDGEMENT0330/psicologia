// ============================================================================
// 01 · TABLERO DE PSICOLOGÍA
// ----------------------------------------------------------------------------
// Lo primero es lo que no puede esperar: alertas de riesgo sin revisar. Luego
// lo que hay que leer —completadas sin revisar—, lo que está en la calle —
// convocatorias abiertas— y el panorama: problemas identificados y su mapa.
// ============================================================================

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cargarProblemas, nombreDe, pacientesPorId } from '../lib/datos'
import { TIPOS_EVALUACION, fmtFechaHora } from '../lib/formato'
import type { Aplicacion, Estadisticas, PacienteBreve, Problema } from '../lib/tipos'
import { Alerta, BotonEnlace, Cargando, Encabezado, EsqueletoMetricas, EtiquetaNivel, Metrica, Tarjeta, TituloSeccion, Vacio } from '../components/ui'
import { BarraNiveles, EstadoAplicacion } from '../components/psico'

const Cerebro3D = lazy(() => import('../components/Cerebro3D'))

type Fila = Pick<Aplicacion, 'id' | 'paciente_id' | 'estado' | 'completada_en' | 'nivel_max' | 'alerta' | 'revisada' | 'tipo' | 'identidad_confirmada' | 'resultados'>

export default function Tablero() {
  const [est, setEst] = useState<Estadisticas | null>(null)
  const [alertas, setAlertas] = useState<Fila[]>([])
  const [porRevisar, setPorRevisar] = useState<Fila[]>([])
  const [pac, setPac] = useState<Record<string, PacienteBreve>>({})
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [error, setError] = useState<string | null>(null)
  const [foco, setFoco] = useState<string | null>(null)

  useEffect(() => {
    const campos = 'id, paciente_id, estado, completada_en, nivel_max, alerta, revisada, tipo, identidad_confirmada, resultados'
    Promise.all([
      supabase.rpc('ps_estadisticas', {}),
      supabase.from('ps_aplicaciones').select(campos).eq('alerta', true).eq('revisada', false).eq('estado', 'completada').order('completada_en', { ascending: false }).limit(20),
      supabase.from('ps_aplicaciones').select(campos).eq('estado', 'completada').eq('revisada', false).order('completada_en', { ascending: false }).limit(12),
      cargarProblemas(),
    ]).then(async ([e, a, r, p]) => {
      const falla = [e, a, r].find((x) => x.error)
      if (falla?.error) setError(falla.error.message)
      setEst(e.data as Estadisticas)
      const al = (a.data ?? []) as Fila[]
      const pr = (r.data ?? []) as Fila[]
      setAlertas(al)
      setPorRevisar(pr)
      setProblemas(p)
      setPac(await pacientesPorId([...al, ...pr].map((x) => x.paciente_id)))
    }).catch((e) => setError(e.message))
  }, [])

  const pesos = useMemo(() => Object.fromEntries(Object.entries(est?.regiones ?? {}).map(([k, v]) => [Number(k), v])), [est])
  const t = est?.totales

  return (
    <div className="space-y-5">
      <Encabezado
        indice="01 / Tablero"
        titulo="Psicología"
        detalle="Alertas de riesgo, evaluaciones por revisar, convocatorias abiertas y el panorama de problemas identificados."
        accion={<><BotonEnlace to="/convocatorias" variante="secundario">Preparar enlaces</BotonEnlace><BotonEnlace to="/evaluados" variante="primario">Buscar evaluado</BotonEnlace></>}
      />
      {error && <Alerta>Parte del tablero no se pudo leer: {error}</Alerta>}

      {!t ? <EsqueletoMetricas n={4} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica titulo="Evaluaciones completadas" numero={t.completadas} detalle={`${t.evaluados} personas evaluadas`} tono="verde" />
          <Metrica titulo="Pendientes y en curso" numero={t.pendientes + t.en_curso} detalle={`${t.en_curso} ya empezaron a responder`}
            proporcion={t.aplicaciones ? t.completadas / t.aplicaciones : 0} />
          <Metrica titulo="Alertas sin revisar" numero={alertas.length} tono={alertas.length ? 'rojo' : 'neutro'}
            detalle={`${t.con_alerta} alertas en total`} />
          <Metrica titulo="Con problema identificado" numero={t.con_hallazgo} tono={t.con_hallazgo ? 'ambar' : 'neutro'}
            detalle={`moderado o mayor · ${t.sin_revisar} sin revisar`} proporcion={t.completadas ? t.con_hallazgo / t.completadas : 0} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Tarjeta>
          <TituloSeccion>Alertas de riesgo sin revisar</TituloSeccion>
          {!est ? null : alertas.length === 0 ? <Vacio texto="No hay alertas pendientes." detalle="Una alerta nace, por ejemplo, del ítem 9 del BDI-II (ideación suicida)." /> : (
            <ul className="divide-y divide-borde">
              {alertas.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/evaluados/${a.paciente_id}?ap=${a.id}`} className="truncate font-medium hover:text-marca">{nombreDe(pac[a.paciente_id])}</Link>
                    <EtiquetaNivel nivel="critico" texto="Alerta" />
                  </div>
                  <div className="text-[12px] text-alerta">
                    {(a.resultados?.instrumentos ?? []).flatMap((i) => i.alertas.map((x) => x.mensaje)).join(' · ')}
                  </div>
                  <div className="text-[11px] text-tinta-tenue">{fmtFechaHora(a.completada_en)}</div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <TituloSeccion accion={<BotonEnlace to="/aplicaciones" variante="fantasma">Ver todas</BotonEnlace>}>Completadas por revisar</TituloSeccion>
          {!est ? null : porRevisar.length === 0 ? <Vacio texto="Todo revisado." /> : (
            <ul className="divide-y divide-borde">
              {porRevisar.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link to={`/evaluados/${a.paciente_id}?ap=${a.id}`} className="block truncate hover:text-marca">{nombreDe(pac[a.paciente_id])}</Link>
                    <div className="text-[11px] text-tinta-tenue">{TIPOS_EVALUACION[a.tipo]} · {fmtFechaHora(a.completada_en)}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {!a.identidad_confirmada && <EstadoAplicacion ap={a} />}
                    <EtiquetaNivel nivel={a.nivel_max} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Tarjeta className="xl:col-span-2">
          <TituloSeccion accion={<BotonEnlace to="/estadisticas" variante="fantasma">Estadísticas</BotonEnlace>}>Problemas identificados</TituloSeccion>
          {!est ? null : !est.por_problema?.length ? <Vacio texto="Sin problemas identificados todavía." detalle="Se llenan solos al calificarse las evaluaciones." /> : (
            <ul className="divide-y divide-borde">
              {est.por_problema.map((p) => (
                <li key={p.problema}>
                  <button type="button" onClick={() => setFoco(foco === p.problema ? null : p.problema)}
                    className={`pulsable w-full px-4 py-2.5 text-left text-sm ${foco === p.problema ? 'bg-superficie-alta' : 'fila-liquida'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.nombre}</span></span>
                      <span className="cifras shrink-0 text-tinta-suave">{p.personas}</span>
                    </div>
                    <div className="mt-1.5"><BarraNiveles cuenta={{ leve: p.leve, moderado: p.moderado, severo: p.severo, critico: p.critico }} alto={5} /></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta className="xl:col-span-3">
          <TituloSeccion>Mapa cerebral del destacamento{foco ? ` · ${problemas.find((p) => p.clave === foco)?.nombre ?? ''}` : ''}</TituloSeccion>
          <div className="p-4">
            <Suspense fallback={<Cargando texto="Cargando visor 3D…" />}>
              <Cerebro3D pesos={pesos} problemas={problemas} resaltar={foco} alto={380} />
            </Suspense>
          </div>
        </Tarjeta>
      </div>

      {est?.convocatorias && est.convocatorias.some((c) => c.estado === 'abierta') && (
        <Tarjeta>
          <TituloSeccion accion={<BotonEnlace to="/convocatorias" variante="fantasma">Convocatorias</BotonEnlace>}>Convocatorias abiertas</TituloSeccion>
          <ul className="divide-y divide-borde">
            {est.convocatorias.filter((c) => c.estado === 'abierta').map((c) => (
              <li key={c.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/convocatorias/${c.id}`} className="truncate hover:text-marca">{c.nombre}</Link>
                  <span className="cifras shrink-0 text-tinta-suave">{c.completadas} / {c.asignadas}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-pastilla bg-superficie-alta">
                  <div className="h-full bg-marca" style={{ width: `${c.asignadas ? (c.completadas / c.asignadas) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
