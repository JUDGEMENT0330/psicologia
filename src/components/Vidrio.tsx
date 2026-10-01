import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Rastro, gomaElastica, proyectar, resorte, type Muelle } from '../lib/resorte'
import { bloquearDesplazamiento } from '../lib/desplazamiento'

/* ============================================================================
   PIEZAS DE VIDRIO
   ----------------------------------------------------------------------------
   Lo que flota sobre el documento. Comparten tres cosas con lo que hace Apple y
   que no son adorno:

     · la realimentación va en el `pointerdown`, no al soltar;
     · lo que se arrastra sigue al dedo 1 a 1, respetando POR DÓNDE se agarró;
     · y todo se puede interrumpir: una hoja que se está cerrando se vuelve a
       agarrar y sube, sin esperar a que termine de cerrarse.

   Esa última es la que obliga a usar muelles (`lib/resorte.ts`) en lugar de
   transiciones de CSS. Una transición no sabe de dónde viene ni a qué velocidad
   iba; un muelle sí, y por eso no da el salto al invertir el gesto.
   ========================================================================== */

/* ------------------------------------------------------------------ hoja -- */

/** A partir de aquí, soltar cierra: 40 % del alto o un impulso claro hacia abajo. */
const FRACCION_CIERRE = 0.4
const VELOCIDAD_CIERRE = 520

export function Hoja({
  titulo,
  detalle,
  children,
  onCerrar,
  accion,
}: {
  titulo: string
  detalle?: string
  children: ReactNode
  onCerrar: () => void
  /** Lo que va arriba a la derecha: guardar, listo, un contador. */
  accion?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const velo = useRef<HTMLDivElement>(null)
  const muelle = useRef<Muelle | null>(null)
  const rastro = useRef(new Rastro())
  const idTitulo = useId()

  // La función de cierre cambia en cada render de quien monta la hoja. Se
  // guarda en una referencia para que el efecto de teclado no se remonte con
  // cada pulsación —el mismo motivo por el que `Modal` lo hace en `ui.tsx`—.
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  /** Pinta un desplazamiento sin pasar por React: esto corre a 60 fps. */
  const pintar = useCallback((y: number) => {
    const p = panel.current
    if (!p) return
    p.style.transform = `translate3d(0, ${y}px, 0)`
    // El velo se aclara conforme la hoja baja: dice que soltar aquí cierra.
    const alto = p.offsetHeight || 1
    if (velo.current) velo.current.style.opacity = String(Math.max(0, 1 - y / alto))
  }, [])

  // Entrada: sube desde abajo con muelle crítico. Sin rebote, porque no vino de
  // ningún gesto; el rebote se gana con impulso.
  useLayoutEffect(() => {
    const p = panel.current
    if (!p) return
    const alto = p.offsetHeight || window.innerHeight
    pintar(alto)
    muelle.current = resorte(alto, 0, { respuesta: 0.42, amortiguacion: 1, alMover: pintar })
    return () => muelle.current?.detener()
  }, [pintar])

  /** Salida: baja con la velocidad que traía y avisa al terminar. */
  const cerrarConMuelle = useCallback(
    (velocidad = 0) => {
      const p = panel.current
      if (!p) return cerrar.current()
      const alto = p.offsetHeight || window.innerHeight
      muelle.current?.detener()
      // Apunta un poco más allá del borde y avisa al cruzarlo: la cola de un
      // muelle crítico tarda ~300 ms en asentarse el último píxel, y mientras
      // tanto una hoja ya invisible seguía tapando la pantalla.
      let hecho = false
      muelle.current = resorte(actual(p), alto + 40, {
        respuesta: 0.34,
        amortiguacion: 1,
        velocidad,
        alMover: (y) => {
          pintar(y)
          if (hecho || y < alto) return
          hecho = true
          muelle.current?.detener()
          cerrar.current()
        },
      })
    },
    [pintar],
  )

  // Escape cierra, y el foco entra en la hoja al abrirse: lo que abre una capa
  // tiene que poder recorrerse y cerrarse sin ratón.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const alPulsar = (e: KeyboardEvent) => {
      // Sólo si es la capa de arriba: con la paleta (Ctrl+K) abierta encima,
      // Escape cerraba las dos de un golpe.
      const capas = document.querySelectorAll('[data-capa]')
      if (capas[capas.length - 1] !== panel.current?.parentElement) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrarConMuelle()
      }
    }
    document.addEventListener('keydown', alPulsar)
    // El documento de detrás no se desplaza mientras hay una hoja encima.
    const liberar = bloquearDesplazamiento()
    return () => {
      document.removeEventListener('keydown', alPulsar)
      liberar()
      previo?.focus?.()
    }
  }, [cerrarConMuelle])

  /* ------------------------------------------------------------- arrastre -- */

  const arrastrando = useRef(false)
  const origen = useRef(0)
  const partida = useRef(0)

  function alBajar(e: React.PointerEvent) {
    // Sólo el tirador y la cabecera arrastran. Si arrastrara todo el panel, no
    // se podría seleccionar texto ni desplazar el contenido de dentro.
    const p = panel.current
    if (!p) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    // Agarrar algo que se mueve lo para EN SECO y en el sitio donde está: es
    // la interrupción, y es lo que hace que la hoja se sienta material.
    muelle.current?.detener()
    arrastrando.current = true
    origen.current = e.clientY
    partida.current = actual(p)
    rastro.current.limpiar()
    rastro.current.anotar(e.clientY)
  }

  function alMover(e: React.PointerEvent) {
    if (!arrastrando.current) return
    const p = panel.current
    if (!p) return
    rastro.current.anotar(e.clientY)
    const bruto = partida.current + (e.clientY - origen.current)
    // Hacia abajo, 1 a 1. Hacia arriba no hay a dónde ir: goma elástica, que
    // frena sola en lugar de topar con un muro.
    pintar(bruto >= 0 ? bruto : -gomaElastica(-bruto, p.offsetHeight || window.innerHeight))
  }

  function alSoltar() {
    if (!arrastrando.current) return
    arrastrando.current = false
    const p = panel.current
    if (!p) return
    const alto = p.offsetHeight || window.innerHeight
    const y = actual(p)
    const v = rastro.current.velocidad()
    // No se mira dónde se soltó el dedo: se mira A DÓNDE IBA. Un golpe corto y
    // rápido cierra aunque la hoja apenas se haya movido.
    const destino = y + proyectar(v)
    if (destino > alto * FRACCION_CIERRE || v > VELOCIDAD_CIERRE) {
      cerrarConMuelle(v)
    } else {
      // Vuelve a su sitio heredando la velocidad del dedo: sin costura entre
      // el arrastre y la animación. Con impulso se permite un rebote corto.
      muelle.current = resorte(y, 0, {
        respuesta: 0.34,
        amortiguacion: Math.abs(v) > 200 ? 0.8 : 1,
        velocidad: v,
        alMover: pintar,
      })
    }
  }

  // Al `body`: un ancestro con `backdrop-filter` o `transform` atraparía la
  // hoja dentro de su caja (ver `Modal`).
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" data-capa="hoja">
      <div
        ref={velo}
        className="velo-vidrio absolute inset-0 bg-velo"
        onClick={() => cerrarConMuelle()}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="vidrio-grueso vidrio-flotante relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-hoja outline-none sm:mb-4 sm:rounded-hoja"
        style={{ willChange: 'transform' }}
      >
        {/* La zona de agarre. `touch-action: none` es obligatorio: sin él, el
            navegador se queda el gesto vertical para desplazar la página y el
            arrastre no llega nunca. */}
        <div
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          className="shrink-0 cursor-grab touch-none select-none px-5 pt-2.5 pb-3 active:cursor-grabbing"
        >
          <div className="mx-auto mb-3 tirador" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={idTitulo} className="sobre-vidrio truncate text-[17px] font-semibold tracking-tight">
                {titulo}
              </h2>
              {detalle && <p className="sobre-vidrio-tenue mt-0.5 truncate text-[13px]">{detalle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {accion}
              <BotonCerrar onPulsar={() => cerrarConMuelle()} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** El desplazamiento pintado ahora mismo, leído del propio elemento. Empezar
 *  una animación desde el valor de destino en vez de desde el valor a la vista
 *  es lo que produce el salto al interrumpir. */
function actual(el: HTMLElement): number {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return m.m42 || 0
}

function BotonCerrar({ onPulsar }: { onPulsar: () => void }) {
  return (
    <button
      type="button"
      onClick={onPulsar}
      aria-label="Cerrar"
      className="pulsable flex h-8 w-8 items-center justify-center rounded-pastilla bg-superficie-alta text-tinta-tenue hover:text-tinta"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  )
}

/* --------------------------------------------------------------- tarjeta -- */

export function TarjetaVidrio({
  children,
  className = '',
  pulsable,
}: {
  children: ReactNode
  className?: string
  pulsable?: boolean
}) {
  return (
    <div
      className={`vidrio vidrio-flotante rounded-tarjeta ${pulsable ? 'pulsable pulsable-amplio' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- botones -- */

type TonoPastilla = 'llena' | 'vidrio' | 'clara' | 'peligro'

const pastillas: Record<TonoPastilla, string> = {
  llena: 'bg-marca text-fondo border-transparent',
  vidrio: 'vidrio vidrio-flotante text-tinta',
  clara: 'bg-superficie-alta text-tinta border-transparent',
  peligro: 'bg-alerta text-fondo border-transparent',
}

/**
 * El botón de la capa de vidrio: cápsula, altura de zona táctil y respuesta al
 * posarse el dedo, no al levantarlo.
 */
export function Pastilla({
  tono = 'clara',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tono?: TonoPastilla }) {
  return (
    <button
      type="button"
      {...props}
      className={`pulsable inline-flex min-h-11 items-center justify-center gap-2 rounded-pastilla border px-4 text-[15px] font-medium disabled:opacity-40 ${pastillas[tono]} ${className}`}
    />
  )
}

/* ----------------------------------------------------------- segmentado -- */

/**
 * El control segmentado de iOS. La pastilla del segmento activo se DESPLAZA de
 * uno a otro en vez de encenderse y apagarse: es lo que deja ver de dónde viene
 * el foco y hacia dónde va, y cuesta lo mismo.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
}: {
  opciones: { v: T; t: string; contador?: number }[]
  valor: T
  onCambiar: (v: T) => void
  etiqueta: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [pildora, setPildora] = useState<{ x: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const c = caja.current
    if (!c) return
    const medir = () => {
      const activo = c.querySelector<HTMLElement>('[data-activo="si"]')
      if (!activo) return
      setPildora({ x: activo.offsetLeft, w: activo.offsetWidth })
    }
    medir()
    // El ancho de los segmentos cambia con el texto y con la ventana; sin esto
    // la pastilla se queda donde estaba al girar el teléfono.
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    return () => ro.disconnect()
  }, [valor, opciones])

  return (
    <div
      ref={caja}
      role="tablist"
      aria-label={etiqueta}
      className="vidrio relative flex gap-1 overflow-x-auto rounded-pastilla p-1"
    >
      {pildora && (
        <span
          aria-hidden
          className="pildora-activa lente absolute inset-y-1 left-0 rounded-pastilla"
          style={{ transform: `translateX(${pildora.x}px)`, width: pildora.w }}
        />
      )}
      {opciones.map((o) => {
        const activo = o.v === valor
        return (
          <button
            key={o.v}
            type="button"
            role="tab"
            aria-selected={activo}
            data-activo={activo ? 'si' : 'no'}
            onClick={() => onCambiar(o.v)}
            className={`pulsable relative z-[1] flex min-h-9 shrink-0 items-center gap-1.5 rounded-pastilla px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
              activo ? 'text-marca' : 'text-tinta-suave hover:text-tinta'
            }`}
          >
            {o.t}
            {o.contador !== undefined && o.contador > 0 && (
              <span
                className={`cifras rounded-pastilla px-1.5 text-[10px] leading-[18px] ${
                  activo ? 'bg-marca text-fondo' : 'bg-superficie-alta text-tinta-tenue'
                }`}
              >
                {o.contador}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ menú -- */

/**
 * Menú desplegable de vidrio líquido.
 *
 * Nace del botón que lo abre —la esquina del disparador es su `transform-origin`—
 * y vuelve a él por el mismo camino al cerrarse: lo que sale de un sitio tiene
 * que volver a ese sitio. Se abre en el `pointerdown`, como los menús del
 * sistema, y se recorre con flechas; Escape y un toque fuera lo cierran y
 * devuelven el foco al botón.
 *
 * Va marcado como capa (`data-capa`) para que los atajos globales —la barra
 * inclinada de los buscadores, ⌘K— no actúen por debajo de él.
 *
 * Se pinta en un portal sobre `body`, con posición fija calculada desde el
 * botón. No es capricho: dentro de otra lámina con `backdrop-filter` —la barra
 * lateral, la cápsula de la cabecera— el navegador sólo deja desenfocar lo que
 * hay DENTRO de esa lámina, y el menú se leía con el texto de detrás nítido.
 */
export function Menu({
  etiqueta,
  boton,
  claseBoton = '',
  lado = 'abajo',
  alinear = 'inicio',
  ancho = 'w-60',
  children,
}: {
  /** Nombre accesible del botón que lo abre. */
  etiqueta: string
  /** Lo que se ve en el botón. Recibe si el menú está abierto. */
  boton: (abierto: boolean) => ReactNode
  claseBoton?: string
  lado?: 'abajo' | 'arriba'
  alinear?: 'inicio' | 'fin'
  /** Clase de ancho, o `'boton'` para medir lo mismo que el disparador. */
  ancho?: string
  /** El contenido; recibe la función de cierre para las filas que navegan. */
  children: (cerrar: () => void) => ReactNode
}) {
  const [estado, setEstado] = useState<'cerrado' | 'abierto' | 'cerrando'>('cerrado')
  const disparador = useRef<HTMLButtonElement>(null)
  const caja = useRef<HTMLDivElement>(null)
  const idMenu = useId()
  const abierto = estado === 'abierto'

  const cerrar = useCallback((devolverFoco = true) => {
    setEstado((e) => (e === 'abierto' ? 'cerrando' : e))
    if (devolverFoco) disparador.current?.focus({ preventScroll: true })
  }, [])

  // Al abrir, el foco entra en la primera fila: el teclado sigue al menú.
  useEffect(() => {
    if (!abierto) return
    const primera = caja.current?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')
    primera?.focus({ preventScroll: true })

    function fuera(e: PointerEvent) {
      const t = e.target as Node
      if (caja.current?.contains(t) || disparador.current?.contains(t)) return
      cerrar(false)
    }
    function alPulsar(e: KeyboardEvent) {
      const capasAbiertas = [...document.querySelectorAll('[data-capa]')]
      if (capasAbiertas[capasAbiertas.length - 1] !== caja.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cerrar()
        return
      }
      if (e.key === 'Tab') {
        cerrar(false)
        return
      }
      const filas = [...(caja.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? [])]
      if (filas.length === 0) return
      const i = filas.indexOf(document.activeElement as HTMLElement)
      let siguiente = -1
      if (e.key === 'ArrowDown') siguiente = (i + 1) % filas.length
      else if (e.key === 'ArrowUp') siguiente = (i - 1 + filas.length) % filas.length
      else if (e.key === 'Home') siguiente = 0
      else if (e.key === 'End') siguiente = filas.length - 1
      if (siguiente >= 0) {
        e.preventDefault()
        filas[siguiente].focus()
      }
    }
    document.addEventListener('pointerdown', fuera, true)
    document.addEventListener('keydown', alPulsar, true)
    return () => {
      document.removeEventListener('pointerdown', fuera, true)
      document.removeEventListener('keydown', alPulsar, true)
    }
  }, [abierto, cerrar])

  // La salida dura lo que su animación; si el navegador no la corre (movimiento
  // reducido, pestaña en segundo plano) el menú se desmonta igual.
  useEffect(() => {
    if (estado !== 'cerrando') return
    const t = setTimeout(() => setEstado('cerrado'), 200)
    return () => clearTimeout(t)
  }, [estado])

  // Dónde va el menú: pegado al botón, por el lado pedido, con 8 px de aire.
  // Se recalcula si la ventana cambia; al desplazarse el menú se cierra, como
  // los del sistema, en vez de quedarse flotando lejos de su botón.
  const [sitio, setSitio] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    if (estado === 'cerrado') return
    const colocar = () => {
      const r = disparador.current?.getBoundingClientRect()
      if (!r) return
      const est: CSSProperties = {}
      if (lado === 'abajo') est.top = r.bottom + 8
      else est.bottom = window.innerHeight - r.top + 8
      if (alinear === 'inicio') est.left = Math.max(8, r.left)
      else est.right = Math.max(8, window.innerWidth - r.right)
      if (ancho === 'boton') est.width = r.width
      setSitio(est)
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [estado, lado, alinear, ancho])

  useEffect(() => {
    if (!abierto) return
    const alDesplazar = (e: Event) => {
      if (caja.current?.contains(e.target as Node)) return
      cerrar(false)
    }
    window.addEventListener('scroll', alDesplazar, true)
    return () => window.removeEventListener('scroll', alDesplazar, true)
  }, [abierto, cerrar])

  const origen = `${lado === 'abajo' ? 'top' : 'bottom'} ${alinear === 'inicio' ? 'left' : 'right'}`

  return (
    <>
      <button
        ref={disparador}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        // Se abre al posar el dedo, no al levantarlo. El teclado entra por
        // `onKeyDown`, que es donde Enter y espacio llegan sin puntero.
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          if (abierto) cerrar(false)
          else setEstado('abierto')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setEstado(abierto ? 'cerrando' : 'abierto')
          }
        }}
        className={`pulsable ${claseBoton}`}
      >
        {boton(abierto)}
      </button>

      {estado !== 'cerrado' &&
        createPortal(
          <div
            ref={caja}
            id={idMenu}
            role="menu"
            aria-label={etiqueta}
            data-capa={estado === 'abierto' ? '' : undefined}
            style={{ ...sitio, transformOrigin: origen }}
            className={`liquido-denso fixed z-[65] max-h-[70dvh] overflow-y-auto rounded-tarjeta p-1.5 print:hidden ${
              ancho === 'boton' ? '' : ancho
            } ${estado === 'abierto' ? 'menu-entra' : 'menu-sale'}`}
          >
            {children(() => cerrar())}
          </div>,
          document.body,
        )}
    </>
  )
}

/** Fila de un menú. Con `peligro` va en rojo: cerrar sesión, borrar. */
export function FilaMenu({
  icono,
  children,
  detalle,
  onPulsar,
  peligro,
  marcada,
}: {
  icono?: ReactNode
  children: ReactNode
  detalle?: ReactNode
  onPulsar: () => void
  peligro?: boolean
  /** Si se pasa, la fila es una opción de un grupo y lleva su marca. */
  marcada?: boolean
}) {
  return (
    <button
      type="button"
      role={marcada === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={marcada}
      tabIndex={-1}
      onClick={onPulsar}
      className={`pulsable fila-liquida fila-menu flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-[14px] ${
        peligro ? 'text-alerta' : 'text-tinta'
      }`}
    >
      {icono && (
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 ${peligro ? 'text-alerta' : 'text-tinta-suave'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          {icono}
        </svg>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detalle && <span className="shrink-0 text-[12px] text-tinta-tenue">{detalle}</span>}
      {marcada && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-marca" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      )}
    </button>
  )
}

/** Separador entre grupos de un menú: una hebra, con aire a los lados. */
export function SeparadorMenu() {
  return <div role="separator" className="mx-3 my-1 h-px bg-borde" />
}
