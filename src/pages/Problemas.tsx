// ============================================================================
// 08 · PROBLEMAS Y ÁREAS CEREBRALES
// ----------------------------------------------------------------------------
// El catálogo de problemas que pueden identificar las escalas (depresión,
// ansiedad, ideación suicida…) y, para cada uno, las áreas del atlas AAL que
// la literatura asocia con él. De aquí sale el mapa cerebral de la ficha, del
// tablero y de las estadísticas del mando.
// ============================================================================

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAvisos } from '../lib/avisos'
import { cargarProblemas, invalidar } from '../lib/datos'
import { GRUPOS_REGIONES } from '../lib/cerebro'
import type { Problema } from '../lib/tipos'
import { Alerta, Boton, Campo, Cargando, Checkbox, Encabezado, Input, Tarjeta, Textarea, TituloSeccion } from '../components/ui'

const Cerebro3D = lazy(() => import('../components/Cerebro3D'))

const VACIO: Problema = { clave: '', nombre: '', descripcion: '', regiones: [], explicacion: '', color: '#1a44b8', orden: 200, activo: true }

export default function Problemas() {
  const avisos = useAvisos()
  const [lista, setLista] = useState<Problema[] | null>(null)
  const [sel, setSel] = useState<Problema | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar(clave?: string) {
    invalidar('problemas')
    const l = await cargarProblemas()
    setLista(l)
    setSel(structuredClone(l.find((p) => p.clave === (clave ?? sel?.clave)) ?? l[0] ?? null))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [])

  const pesos = useMemo(() => Object.fromEntries((sel?.regiones ?? []).map((r) => [r, 1])), [sel])

  async function guardar() {
    if (!sel) return
    setError(null)
    if (esNuevo && !/^[a-z0-9_]{2,40}$/.test(sel.clave)) return setError('La clave va en minúsculas, sin espacios ni tildes.')
    const fila = { nombre: sel.nombre, descripcion: sel.descripcion || null, explicacion: sel.explicacion || null, regiones: sel.regiones, color: sel.color, orden: sel.orden, activo: sel.activo }
    const { error } = esNuevo
      ? await supabase.from('ps_problemas').insert({ ...fila, clave: sel.clave })
      : await supabase.from('ps_problemas').update(fila).eq('clave', sel.clave)
    if (error) return setError(error.message)
    avisos.exito('Guardado.')
    setEsNuevo(false)
    cargar(sel.clave)
  }

  if (!lista) return <Cargando />

  return (
    <div className="space-y-4">
      <Encabezado indice="08 / Problemas" titulo="Problemas y áreas cerebrales"
        detalle="Qué problema identifica cada escala y qué áreas del cerebro se asocian con él. La asociación es orientativa, para explicar los resultados; no es neuroimagen."
        accion={<Boton onClick={() => { setSel(structuredClone(VACIO)); setEsNuevo(true) }}>Nuevo problema</Boton>} />

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Tarjeta className="h-fit">
          <ul className="divide-y divide-borde">
            {lista.map((p) => (
              <li key={p.clave}>
                <button type="button" onClick={() => { setSel(structuredClone(p)); setEsNuevo(false) }}
                  className={`pulsable flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${sel?.clave === p.clave && !esNuevo ? 'bg-superficie-alta font-semibold' : 'fila-liquida'} ${p.activo ? '' : 'opacity-50'}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.nombre}</span>
                  <span className="cifras text-[11px] text-tinta-tenue">{p.regiones.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>

        {sel && (
          <div className="space-y-4">
            <Tarjeta className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_6rem_6rem]">
              {esNuevo && <Campo etiqueta="Clave"><Input value={sel.clave} onChange={(e) => setSel({ ...sel, clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></Campo>}
              <Campo etiqueta="Nombre"><Input value={sel.nombre} onChange={(e) => setSel({ ...sel, nombre: e.target.value })} /></Campo>
              <Campo etiqueta="Color"><Input type="color" value={sel.color} onChange={(e) => setSel({ ...sel, color: e.target.value })} className="p-1" /></Campo>
              <Campo etiqueta="Orden"><Input type="number" value={sel.orden} onChange={(e) => setSel({ ...sel, orden: Number(e.target.value) })} /></Campo>
              <div className="sm:col-span-4"><Campo etiqueta="Descripción"><Input value={sel.descripcion ?? ''} onChange={(e) => setSel({ ...sel, descripcion: e.target.value })} /></Campo></div>
              <div className="sm:col-span-4"><Campo etiqueta="Explicación neuropsicológica" hint="Aparece en la ficha junto al mapa, para explicar el resultado.">
                <Textarea rows={3} value={sel.explicacion ?? ''} onChange={(e) => setSel({ ...sel, explicacion: e.target.value })} /></Campo></div>
              <Checkbox etiqueta="Activo" checked={sel.activo} onChange={(v) => setSel({ ...sel, activo: v })} />
            </Tarjeta>

            <div className="grid gap-4 2xl:grid-cols-2">
              <Tarjeta>
                <TituloSeccion>Áreas asociadas</TituloSeccion>
                <div className="grid max-h-[28rem] gap-x-4 overflow-y-auto p-4 sm:grid-cols-2">
                  {GRUPOS_REGIONES.map((g) => {
                    const todas = g.regiones.every((r) => sel.regiones.includes(r))
                    return (
                      <Checkbox key={g.nombre} etiqueta={g.nombre} checked={todas} onChange={(v) => setSel({
                        ...sel, regiones: v ? [...new Set([...sel.regiones, ...g.regiones])] : sel.regiones.filter((r) => !g.regiones.includes(r)),
                      })} />
                    )
                  })}
                </div>
              </Tarjeta>
              <Tarjeta>
                <TituloSeccion>Vista previa</TituloSeccion>
                <div className="p-4">
                  <Suspense fallback={<Cargando texto="Cargando visor 3D…" />}>
                    <Cerebro3D pesos={pesos} alto={360} resaltar={sel.clave || 'nuevo'}
                      problemas={[{ clave: sel.clave || 'nuevo', nombre: sel.nombre, color: sel.color, regiones: sel.regiones, explicacion: sel.explicacion }]} />
                  </Suspense>
                </div>
              </Tarjeta>
            </div>
            {error && <Alerta>{error}</Alerta>}
            <div className="flex justify-end"><Boton onClick={guardar} disabled={!sel.nombre.trim()}>Guardar</Boton></div>
          </div>
        )}
      </div>
    </div>
  )
}
