import { useEffect, useId, useMemo, useState } from 'react'
import { Sector } from 'recharts'
import type { BarShapeProps, PieSectorShapeProps } from 'recharts'

/* ============================================================================
   GRÁFICOS DE VIDRIO
   ----------------------------------------------------------------------------
   Las gráficas dejan de ser rectángulos planos y pasan a ser piezas del mismo
   material que la barra lateral y las hojas: vidrio entintado con volumen.

     · Cada barra es un PRISMA. La cara de frente lleva el tinte de su serie con
       un degradado cilíndrico —más denso en el centro, más fino en los cantos,
       como un bloque de vidrio de verdad—; el techo recibe la luz y la cara
       lateral queda en sombra. La luz viene siempre de arriba a la izquierda,
       la misma que da el filo especular a las láminas de `vidrio.css`.
     · Encima va un brillo: un reflejo alto y una franja especular fina.
     · La dona tiene grosor: se apila una pared oscurecida por debajo del
       anillo y el anillo se pinta con el mismo vidrio que las barras.
     · Los puntos de una línea son cuentas de vidrio y la línea proyecta un
       resplandor de su propio color.

   Los degradados usan `objectBoundingBox`: uno por color sirve para todas las
   barras de ese color, sea cual sea su tamaño. Viven en un <svg> oculto que se
   monta al lado de la gráfica; `url(#…)` los alcanza desde cualquier <svg>
   del documento. No se usa `display: none` para esconderlo porque algunos
   motores dejan de pintar los degradados de un <svg> que no se muestra.

   Qué NO cambia: los valores, las escalas y los ejes. El volumen es de la
   marca, no del dato: el valor se lee en el canto superior de la cara de
   frente, que es donde lo pone el eje; el techo queda detrás, en perspectiva.
   ========================================================================== */

/** Mezcla un color hexadecimal con otro. Fuera de hexadecimal, lo deja como está. */
function mezclar(hex: string, con: string, t: number): string {
  const a = aRgb(hex)
  const b = aRgb(con)
  if (!a || !b) return hex
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${m[0]} ${m[1]} ${m[2]})`
}

function aRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace('#', '')
  const largo = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(largo)) return null
  return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16)) as [number, number, number]
}

/** `prefers-reduced-motion`: sin el crecimiento de las barras, que es movimiento de fondo. */
export function useMovimientoReducido() {
  const [reducido, setReducido] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const cambio = () => setReducido(mq.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return !!reducido
}

type Orientacion = 'vertical' | 'horizontal'

/**
 * Prepara el vidrio de una gráfica.
 *
 * `colores` son los tintes que va a usar (los de sus series o celdas). Devuelve
 * las definiciones para montar al lado de la gráfica y las formas para pasar a
 * `<Bar shape>`, `<Pie shape>` y `<Line dot>`.
 */
export function useVidrio(colores: string[]) {
  const crudo = useId()
  const p = useMemo(() => 'v' + crudo.replace(/[^a-zA-Z0-9_-]/g, ''), [crudo])
  const lista = useMemo(() => Array.from(new Set(colores)), [colores.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const animar = !useMovimientoReducido()

  return useMemo(() => {
    const indice = (color: string) => Math.max(0, lista.indexOf(color))
    const id = (que: string, color?: string) => (color === undefined ? `${p}-${que}` : `${p}-${que}-${indice(color)}`)

    const defs = (
      <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {lista.map((c, i) => (
            <g key={c}>
              {/* Frente de una barra que crece hacia arriba: el cilindro va de izquierda a derecha. */}
              <linearGradient id={`${p}-fv-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={c} stopOpacity="0.58" />
                <stop offset="0.34" stopColor={c} stopOpacity="0.92" />
                <stop offset="0.72" stopColor={c} stopOpacity="0.78" />
                <stop offset="1" stopColor={mezclar(c, '#000000', 0.18)} stopOpacity="0.7" />
              </linearGradient>
              {/* Frente de una barra que crece hacia la derecha: el cilindro va de arriba abajo. */}
              <linearGradient id={`${p}-fh-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c} stopOpacity="0.62" />
                <stop offset="0.36" stopColor={c} stopOpacity="0.92" />
                <stop offset="0.74" stopColor={c} stopOpacity="0.8" />
                <stop offset="1" stopColor={mezclar(c, '#000000', 0.2)} stopOpacity="0.72" />
              </linearGradient>
              {/* Anillo: más denso abajo, donde el vidrio es más grueso a la vista. */}
              <linearGradient id={`${p}-s-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={mezclar(c, '#ffffff', 0.12)} stopOpacity="0.72" />
                <stop offset="1" stopColor={c} stopOpacity="0.95" />
              </linearGradient>
              {/* Área bajo una línea: tinte que se disuelve hacia el eje. */}
              <linearGradient id={`${p}-a-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c} stopOpacity="0.34" />
                <stop offset="0.7" stopColor={c} stopOpacity="0.08" />
                <stop offset="1" stopColor={c} stopOpacity="0" />
              </linearGradient>
              {/* Cuenta de vidrio: núcleo claro desplazado hacia la luz. */}
              <radialGradient id={`${p}-p-${i}`} cx="0.36" cy="0.32" r="0.75">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="0.35" stopColor={mezclar(c, '#ffffff', 0.25)} stopOpacity="0.95" />
                <stop offset="1" stopColor={mezclar(c, '#000000', 0.15)} stopOpacity="1" />
              </radialGradient>
            </g>
          ))}
          {/* Reflejo alto, común a todas: la luz cae de arriba. */}
          <linearGradient id={`${p}-brillo`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}-brillo-h`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          {/* Franja especular: un canto fino de luz a un quinto del borde. */}
          <linearGradient id={`${p}-franja`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.14" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="0.3" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    )

    /** Barra de vidrio con volumen. `orientacion` es hacia dónde crece el valor. */
    const barra = (orientacion: Orientacion) =>
      function BarraVidrio(props: BarShapeProps) {
        const { x, y, width: w0, height: h0, fill } = props
        if (!Number.isFinite(x) || !Number.isFinite(y)) return <g />
        // Recharts puede entregar alto negativo en valores bajo cero: se normaliza.
        const X = w0 < 0 ? x + w0 : x
        const Y = h0 < 0 ? y + h0 : y
        const w = Math.abs(w0)
        const h = Math.abs(h0)
        if (w < 0.5 || h < 0.5) return <g />
        const color = typeof fill === 'string' ? fill : '#888888'
        // Profundidad del prisma: proporcional al grosor de la barra, con tope
        // para que una barra ancha no se convierta en un bloque.
        const grosor = orientacion === 'vertical' ? w : h
        const d = Math.max(2, Math.min(8, grosor * 0.3))
        const dx = d
        const dy = -d * 0.62
        const techo = `${X},${Y} ${X + dx},${Y + dy} ${X + w + dx},${Y + dy} ${X + w},${Y}`
        const lado = `${X + w},${Y} ${X + w + dx},${Y + dy} ${X + w + dx},${Y + h + dy} ${X + w},${Y + h}`
        const frente = orientacion === 'vertical' ? id('fv', color) : id('fh', color)
        return (
          <g className="barra-vidrio">
            <polygon points={lado} fill={mezclar(color, '#000000', 0.34)} fillOpacity={0.82} />
            <polygon points={techo} fill={mezclar(color, '#ffffff', 0.38)} fillOpacity={0.9} />
            <rect x={X} y={Y} width={w} height={h} fill={`url(#${frente})`} />
            <rect
              x={X} y={Y} width={w} height={h}
              fill={`url(#${orientacion === 'vertical' ? id('brillo') : id('brillo-h')})`}
            />
            {orientacion === 'vertical' && w > 6 && <rect x={X} y={Y} width={w} height={h} fill={`url(#${id('franja')})`} />}
            {/* El filo: donde la luz toca el canto. Más claro arriba que en el resto. */}
            <rect x={X + 0.4} y={Y + 0.4} width={Math.max(0, w - 0.8)} height={Math.max(0, h - 0.8)} fill="none" className="barra-vidrio-filo" />
            <line x1={X} y1={Y} x2={X + dx} y2={Y + dy} className="barra-vidrio-arista" />
            <line x1={X + dx} y1={Y + dy} x2={X + w + dx} y2={Y + dy} className="barra-vidrio-arista" />
          </g>
        )
      }

    /**
     * Grosor del anillo. Va en un `<Pie>` propio, montado ANTES del anillo de
     * vidrio y con los mismos datos: así ninguna pared tapa la cara de otra
     * porción.
     */
    const paredAnillo = (profundidad = 9) =>
      function ParedAnillo(props: PieSectorShapeProps) {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
        const color = typeof fill === 'string' ? fill : '#888888'
        const capas = []
        for (let k = profundidad; k >= 1; k--) {
          capas.push(
            <Sector
              key={k}
              cx={cx} cy={cy + k}
              innerRadius={innerRadius} outerRadius={outerRadius}
              startAngle={startAngle} endAngle={endAngle}
              fill={mezclar(color, '#000000', 0.28 + (k / profundidad) * 0.18)}
              stroke="none"
            />,
          )
        }
        return <g className="anillo-vidrio-pared">{capas}</g>
      }

    const anillo = () =>
      function AnilloVidrio(props: PieSectorShapeProps) {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
        const color = typeof fill === 'string' ? fill : '#888888'
        const geo = { cx, cy, innerRadius, outerRadius, startAngle, endAngle }
        return (
          <g className="anillo-vidrio">
            <Sector {...geo} fill={`url(#${id('s', color)})`} stroke="none" />
            <Sector {...geo} fill={`url(#${id('brillo')})`} stroke="none" />
            <Sector {...geo} fill="none" className="barra-vidrio-filo" />
          </g>
        )
      }

    /** Cuenta de vidrio para los puntos de una línea. */
    const punto = (color: string, r = 3.5) =>
      function PuntoVidrio(props: { cx?: number; cy?: number; index?: number }) {
        const { cx, cy } = props
        if (cx == null || cy == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return <g key={props.index} />
        return (
          <g key={props.index} className="punto-vidrio">
            <circle cx={cx} cy={cy} r={r} fill={`url(#${id('p', color)})`} />
            <circle cx={cx} cy={cy} r={r - 0.4} fill="none" className="barra-vidrio-filo" />
          </g>
        )
      }

    return {
      defs,
      animar,
      barra,
      paredAnillo,
      anillo,
      punto,
      /** Relleno del área bajo una línea. */
      area: (color: string) => `url(#${id('a', color)})`,
    }
  }, [p, lista, animar])
}
