import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, type LinkProps } from 'react-router-dom'
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from 'react'
import type { Nivel } from '../lib/tipos'
import { NOMBRE_NIVEL } from '../lib/formato'
import { bloquearDesplazamiento } from '../lib/desplazamiento'
import { Rastro, gomaElastica, proyectar, resorte, type Muelle } from '../lib/resorte'

/* ============================================================================
   Componentes base.
   ----------------------------------------------------------------------------
   La retícula y la tipografía siguen siendo las del sistema suizo: la jerarquía
   la dan el peso, la regla y el espacio, no la decoración. Lo que cambió con la
   aplicación de iPhone es el MATERIAL de las piezas —esquina continua, cápsula
   en los botones, superficie sobre la que el dedo se apoya— y la respuesta:
   todo lo que se toca se hunde al posarse el dedo, no al levantarlo.

   Los radios y el material viven en `src/estilos/vidrio.css`; aquí sólo se
   usan. Escala de 4 px.
   ========================================================================== */

export function Tarjeta({
  children, className = '', viva,
}: {
  children: ReactNode
  className?: string
  viva?: boolean
}) {
  return (
    <div className={`lamina rounded-tarjeta border border-borde ${viva ? 'tarjeta-viva' : ''} ${className}`}>{children}</div>
  )
}

export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-borde px-4">
      <h2 className="rotulo text-tinta-suave">{children}</h2>
      {accion}
    </div>
  )
}

/**
 * Encabezado de página. Es la portada del documento: un renglón de folio con
 * la unidad y la fecha —como el encabezado corrido de un expediente impreso—,
 * el número de sección, el título en cuerpo mayor y, cerrando, el filete doble
 * de imprenta que separa el título del contenido.
 */
export function Encabezado({
  indice,
  titulo,
  detalle,
  accion,
  antes,
  folio,
}: {
  indice: string
  titulo: string
  detalle?: ReactNode
  accion?: ReactNode
  /** Rastro de navegación o enlace de vuelta, sobre el índice de sección. */
  antes?: ReactNode
  /** Dato de servicio a la derecha del folio: expediente, recuento, estado. */
  folio?: ReactNode
}) {
  return (
    <header className="aparece relative pb-4">
      <div className="folio mb-3 flex items-center justify-between gap-4 border-b border-borde pb-2">
        {/* En un teléfono el renglón completo se corta a media palabra: allí
            se abrevia la unidad, que es lo que ya sabe quien lo lee. */}
        <span className="hidden truncate sm:inline">Destacamento Militar N° 1 · Sección de Sanidad · Psicología</span>
        <span className="truncate sm:hidden">DM-1 · Psicología</span>
        <span className="shrink-0 tabular-nums">{folio ?? fechaLarga()}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {antes && <div className="mb-3">{antes}</div>}
          <div className="cifras rotulo mb-2 text-marca">{indice}</div>
          <h1 className="titular titular-pagina text-tinta">{titulo}</h1>
          {detalle && <p className="mt-3 max-w-prose text-sm leading-relaxed text-tinta-tenue">{detalle}</p>}
        </div>
        {accion && <div className="flex flex-wrap gap-2">{accion}</div>}
      </div>

      <span aria-hidden className="regla-viva regla-doble absolute inset-x-0 bottom-0" />
    </header>
  )
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Fecha del día en el folio. Se arma a mano para no depender del idioma del
 *  sistema: el equipo de la clínica puede estar en inglés y el documento no. */
function fechaLarga() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const variantes: Record<VarianteBoton, string> = {
  primario: 'bg-marca text-fondo hover:bg-marca-fuerte border-marca',
  secundario: 'bg-superficie-alta text-tinta hover:bg-borde border-borde',
  peligro: 'bg-alerta text-fondo hover:opacity-90 border-alerta',
  fantasma: 'bg-transparent text-tinta-suave hover:bg-superficie-alta hover:text-tinta border-borde',
}

/* La altura mínima de 44 px no es holgura: es la zona táctil que un dedo
   acierta sin ampliar. Vive aquí y en un solo sitio para que un destino que
   por casualidad es un enlace en vez de un botón no la pierda por el camino.
   `pulsable` es la respuesta al tacto: se hunde en el `pointerdown`. */
const baseBoton =
  'pulsable inline-flex min-h-11 items-center justify-center gap-2 rounded-pastilla border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40'

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button type="button" {...props} className={`${baseBoton} ${variantes[variante]} ${className}`} />
  )
}

/**
 * Lo que ES un enlace y PARECE un botón. Navegar y ejecutar no son la misma
 * acción —el enlace se abre en otra pestaña, se copia, lo anuncia el lector de
 * pantalla como destino— y por eso no puede resolverse con un `<button>` que
 * llama al enrutador. Comparte el estilo de `Boton` en vez de copiarlo, que es
 * como estas dos cosas se separan sin que se separen a la vista.
 */
export function BotonEnlace({
  variante = 'secundario',
  className = '',
  ...props
}: LinkProps & { variante?: VarianteBoton }) {
  return <Link {...props} className={`${baseBoton} ${variantes[variante]} ${className}`} />
}

const campoBase =
  'w-full min-h-11 rounded-control border border-borde bg-superficie px-3 text-base text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-marca sm:text-sm'

export function Campo({ etiqueta, children, hint }: { etiqueta: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="rotulo mb-2 block text-tinta-tenue">{etiqueta}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-snug text-tinta-tenue">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${campoBase} py-2 ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${campoBase} campo-select py-2 ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${campoBase} py-2 leading-relaxed ${props.className ?? ''}`} />
}

/**
 * El selector de archivo. El navegador dibuja este control a su manera y con
 * su propio tamaño, que en un teléfono queda por debajo de la zona táctil y en
 * ningún caso se parece al resto de la ficha. Estaba resuelto a mano y con dos
 * alturas distintas en las dos pantallas que importan listados; ahora se
 * resuelve una vez.
 */
export function CampoArchivo({
  etiqueta, hint, className = '', ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; hint?: string }) {
  return (
    <Campo etiqueta={etiqueta} hint={hint}>
      <input
        type="file"
        {...props}
        className={`flex w-full min-h-11 items-center rounded-control border border-borde bg-superficie px-3 text-sm text-tinta file:mr-3 file:min-h-9 file:rounded-pastilla file:border-0 file:bg-superficie-alta file:px-3 file:text-sm file:font-medium file:text-tinta hover:file:bg-borde ${className}`}
      />
    </Campo>
  )
}

export function Checkbox({
  etiqueta, checked, onChange, disabled,
}: {
  etiqueta: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta sm:min-h-0 sm:py-1">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-marca"
      />
      {etiqueta}
    </label>
  )
}

/* --------------------------------------------------------------- señales --- */

const tonos = {
  neutro: 'border-borde bg-superficie-alta text-tinta-suave',
  verde: 'border-exito bg-exito-suave text-exito',
  ambar: 'border-aviso bg-aviso-suave text-aviso',
  rojo: 'border-alerta bg-alerta-suave text-alerta',
  azul: 'border-dato bg-dato-suave text-dato',
} as const

export function Insignia({ children, tono = 'neutro' }: { children: ReactNode; tono?: keyof typeof tonos }) {
  return (
    <span className={`inline-block rounded-chip border px-2 py-0.5 text-[11px] leading-snug font-medium ${tonos[tono]}`}>
      {children}
    </span>
  )
}

/** Nivel de un hallazgo psicológico, con el mismo código de color en todo el
 *  sistema: normal verde, leve azul, moderado ámbar, severo y crítico rojo. */
export const NIVEL_A_TONO: Record<Nivel, keyof typeof tonos> = {
  normal: 'verde', leve: 'azul', moderado: 'ambar', severo: 'rojo', critico: 'rojo',
}

export function EtiquetaNivel({ nivel, texto }: { nivel: Nivel | null | undefined; texto?: string | null }) {
  if (!nivel) return <span className="text-[11px] text-tinta-tenue">sin calificar</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-[11px] leading-snug font-medium ${tonos[NIVEL_A_TONO[nivel]]}`}>
      {nivel === 'critico' && <span className="h-1.5 w-1.5 rounded-pastilla bg-current" aria-hidden />}
      {texto ?? NOMBRE_NIVEL[nivel]}
    </span>
  )
}

/* ------------------------------------------------------------- métricas --- */

/** Cuenta desde cero hasta el valor; respeta prefers-reduced-motion. */
function useConteo(destino: number | undefined) {
  const [v, setV] = useState(destino ?? 0)
  const previo = useRef(destino ?? 0)

  useEffect(() => {
    if (destino === undefined) return
    const desde = previo.current
    previo.current = destino
    if (desde === destino) return setV(destino)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(destino)

    const dur = 700
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(desde + (destino - desde) * e))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [destino])

  return v
}

export function Metrica({
  titulo, valor, numero, sufijo = '', detalle, tono = 'neutro', proporcion,
}: {
  titulo: string
  valor?: ReactNode
  /** Si se indica, la cifra cuenta desde cero al montar. */
  numero?: number
  sufijo?: string
  detalle?: string
  tono?: 'neutro' | 'verde' | 'ambar' | 'rojo'
  /** 0–1. Dibuja el filete de medida bajo la cifra: cuánto de cuánto. */
  proporcion?: number
}) {
  const contado = useConteo(numero)
  const color = {
    neutro: 'text-tinta',
    verde: 'text-exito',
    ambar: 'text-aviso',
    rojo: 'text-alerta',
  }[tono]
  const trazo = {
    neutro: 'bg-tinta',
    verde: 'bg-exito',
    ambar: 'bg-aviso',
    rojo: 'bg-alerta',
  }[tono]
  return (
    <div className="lamina tarjeta-viva relative overflow-hidden rounded-tarjeta border border-borde p-4">
      {/* Filete superior del color de la señal: da el estado del indicador
          antes de leer la cifra, en la línea de barrido de la retícula. */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-px ${trazo} opacity-40`} />
      <div className="rotulo text-tinta-tenue">{titulo}</div>
      <div className={`cifras mt-3 text-4xl leading-none font-semibold tabular-nums ${color}`}>
        {numero !== undefined ? `${contado}${sufijo}` : valor}
      </div>
      {proporcion !== undefined && (
        <div aria-hidden className="mt-3 h-1 w-full overflow-hidden rounded-pastilla bg-superficie-alta">
          <div
            className={`h-full rounded-pastilla ${trazo} transition-[width] duration-700 ease-out`}
            style={{ width: `${Math.max(0, Math.min(1, proporcion)) * 100}%` }}
          />
        </div>
      )}
      {detalle && <div className="mt-2 text-xs leading-snug text-tinta-tenue">{detalle}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- estados --- */

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 p-8" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-1 animate-pulse bg-marca"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: '900ms' }}
          />
        ))}
      </span>
      <span className="rotulo text-tinta-tenue">{texto}</span>
    </div>
  )
}

/**
 * Estado vacío. Un listado sin filas rara vez es un error: casi siempre falta
 * dar el primer paso, así que el hueco lleva la acción que lo llena.
 */
export function Vacio({ texto, detalle, accion }: { texto: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span aria-hidden className="h-px w-10 bg-borde" />
      <div className="text-sm text-tinta-suave">{texto}</div>
      {detalle && <p className="max-w-xs text-xs leading-relaxed text-tinta-tenue">{detalle}</p>}
      {accion}
    </div>
  )
}

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Sólo lo que está a la vista: un control oculto no puede recibir el foco. */
const visible = (el: HTMLElement) => el.offsetParent !== null

/**
 * Las capas superpuestas que hay abiertas ahora mismo, de abajo arriba. Un
 * diálogo, otro diálogo encima, la paleta de mando sobre los dos. La última es
 * la que manda: es la que responde a Escape y la que atrapa el tabulador.
 *
 * Se lee del propio documento en vez de llevar un registro aparte porque el
 * orden del DOM ya es el orden de apilado, y un registro que hay que mantener
 * sincronizado se desincroniza el día que alguien desmonte una capa por otra vía.
 */
const capas = () => [...document.querySelectorAll<HTMLElement>('[data-capa]')]

/**
 * ¿Hay alguna capa superpuesta abierta? Lo consultan los atajos globales de
 * teclado —la barra inclinada de los buscadores, las teclas del visor 3D— para
 * no robarle el foco a un diálogo abierto ni actuar sobre lo que hay detrás.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function hayCapaAbierta(): boolean {
  return capas().length > 0
}

/**
 * ¿Está esta capa encima de todas? Sólo la de arriba atiende el teclado.
 */
const esLaDeArriba = (el: HTMLElement | null) => {
  const abiertas = capas()
  return abiertas.length > 0 && abiertas[abiertas.length - 1] === el
}

/**
 * Diálogo modal.
 *
 * El efecto de foco NO depende de `onCerrar`. Parece un detalle y no lo es: casi
 * todas las llamadas pasan una función en línea, así que `onCerrar` es distinta
 * en cada render del componente que contiene el diálogo. Con esa dependencia, un
 * formulario cuyo estado vive fuera del modal —el de «Nueva referencia»— volvía a
 * montar el efecto EN CADA TECLA: devolvía el foco al elemento previo y lo
 * plantaba otra vez en el primer campo del cuerpo, que allí es un desplegable. El
 * resultado era que escribir una letra abría el selector de especialidad y había
 * que volver a pinchar la caja. La función se guarda en una referencia y el
 * efecto se monta una sola vez.
 */
export function Modal({
  titulo, children, onCerrar, ancho = 'max-w-2xl',
}: {
  titulo: string
  children: ReactNode
  onCerrar: () => void
  ancho?: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const velo = useRef<HTMLDivElement>(null)
  const idTitulo = useId()

  // La última versión de la función de cierre, sin volver a montar el efecto.
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  // En el teléfono el diálogo es una hoja: dibuja el tirador, así que TIENE que
  // arrastrarse, subir desde abajo y salir por donde entró —lo mismo que la
  // `Hoja` de `Vidrio.tsx`, que se ve igual—. En el escritorio es una tarjeta
  // que se materializa en el centro y se cierra al instante.
  const [telefono] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639px)').matches)
  const muelle = useRef<Muelle | null>(null)
  const rastro = useRef(new Rastro())

  /** Pinta el desplazamiento sin pasar por React: corre a 60 fps. */
  const pintar = useCallback((y: number) => {
    const c = caja.current
    if (!c) return
    c.style.transform = `translate3d(0, ${y}px, 0)`
    // El velo se aclara conforme la hoja baja: dice que soltar ahí cierra.
    if (velo.current) velo.current.style.opacity = String(Math.max(0, 1 - y / (c.offsetHeight || 1)))
  }, [])

  // Entrada: sube desde abajo con muelle crítico. Sin rebote: no vino de un gesto.
  useLayoutEffect(() => {
    const c = caja.current
    if (!telefono || !c) return
    const alto = c.offsetHeight || window.innerHeight
    pintar(alto)
    muelle.current = resorte(alto, 0, { respuesta: 0.42, amortiguacion: 1, alMover: pintar })
    return () => muelle.current?.detener()
  }, [telefono, pintar])

  /** Cierra. En el teléfono baja heredando la velocidad que traía y avisa al llegar. */
  const salir = useRef((velocidad = 0) => {
    const c = caja.current
    if (!telefono || !c) return cerrar.current()
    const alto = c.offsetHeight || window.innerHeight
    muelle.current?.detener()
    // Apunta un poco más allá del borde y avisa al cruzarlo: la cola de un
    // muelle crítico tarda ~300 ms en asentarse el último píxel, y mientras
    // tanto una hoja ya invisible seguía tapando la pantalla.
    let hecho = false
    muelle.current = resorte(posicionActual(c), alto + 40, {
      respuesta: 0.34, amortiguacion: 1, velocidad,
      alMover: (y) => {
        pintar(y)
        if (hecho || y < alto) return
        hecho = true
        muelle.current?.detener()
        cerrar.current()
      },
    })
  })

  // Un arrastre para seleccionar texto que empieza dentro del diálogo y termina
  // fuera dispara un `click` en el velo. Sin esto, seleccionar el motivo de una
  // referencia y soltar el ratón un centímetro más allá cerraba el diálogo y
  // tiraba lo escrito. Sólo cierra el velo si el gesto EMPEZÓ en el velo.
  const pulsadoEnVelo = useRef(false)

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const liberar = bloquearDesplazamiento()

    // El foco entra por el primer control del cuerpo, no por el aspa de cerrar:
    // el diálogo se abre para escribir, no para salir de él. Se descartan los
    // controles ocultos —hay formularios con un `input` de archivo invisible
    // detrás de un botón—, porque enfocar uno deja el foco en la nada y el
    // tabulador se escapa por detrás del diálogo.
    const cuerpo = caja.current?.querySelector<HTMLElement>('[data-cuerpo]')
    const candidatos = cuerpo
      ? [...cuerpo.querySelectorAll<HTMLElement>(FOCALIZABLES)].filter(visible)
      : []
    const escribible = candidatos.find(
      (el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement,
    )
    // Sin desplazar: la hoja todavía está subiendo y el navegador movería el
    // documento entero para «mostrar» un campo que viene de camino.
    ;(escribible ?? candidatos[0] ?? caja.current)?.focus({ preventScroll: true })

    function alPulsar(e: KeyboardEvent) {
      // Si hay otra capa por encima —la paleta de mando abierta con Ctrl+K sobre
      // este diálogo— el teclado es suyo. Sin esta comprobación, Escape cerraba
      // el diálogo de debajo y se perdía el formulario a medio llenar.
      if (!esLaDeArriba(caja.current)) return

      if (e.key === 'Escape') {
        e.stopPropagation()
        salir.current()
        return
      }
      if (e.key !== 'Tab' || !caja.current) return
      const focos = [...caja.current.querySelectorAll<HTMLElement>(FOCALIZABLES)].filter(visible)
      if (focos.length === 0) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', alPulsar, true)
    return () => {
      document.removeEventListener('keydown', alPulsar, true)
      liberar()
      previo?.focus?.()
    }
  }, [])

  /* --------------------------------------------- arrastre (sólo teléfono) -- */
  const arrastrando = useRef(false)
  const origen = useRef(0)
  const partida = useRef(0)

  function alBajar(e: React.PointerEvent) {
    const c = caja.current
    // El aspa es un botón, no un asa: tocarla cierra, no arrastra.
    if (!telefono || !c || (e.target as HTMLElement).closest('button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    // Agarrar algo que se mueve lo para EN SECO donde está: es la interrupción.
    muelle.current?.detener()
    arrastrando.current = true
    origen.current = e.clientY
    partida.current = posicionActual(c)
    rastro.current.limpiar()
    rastro.current.anotar(e.clientY)
  }

  function alMover(e: React.PointerEvent) {
    const c = caja.current
    if (!arrastrando.current || !c) return
    rastro.current.anotar(e.clientY)
    const bruto = partida.current + (e.clientY - origen.current)
    // Hacia abajo, 1 a 1; hacia arriba no hay a dónde ir: goma elástica.
    pintar(bruto >= 0 ? bruto : -gomaElastica(-bruto, c.offsetHeight || window.innerHeight))
  }

  function alSoltar() {
    const c = caja.current
    if (!arrastrando.current || !c) return
    arrastrando.current = false
    const alto = c.offsetHeight || window.innerHeight
    const y = posicionActual(c)
    const v = rastro.current.velocidad()
    // Se decide por A DÓNDE IBA, no por dónde se soltó: un golpe corto cierra.
    if (y + proyectar(v) > alto * 0.4 || v > 520) {
      salir.current(v)
    } else {
      muelle.current = resorte(y, 0, {
        respuesta: 0.34, amortiguacion: Math.abs(v) > 200 ? 0.8 : 1, velocidad: v, alMover: pintar,
      })
    }
  }

  // Al `body`, no donde se declara: casi todos los diálogos viven dentro de una
  // tarjeta `.lamina`, y su `backdrop-filter` convierte a la tarjeta en el
  // bloque contenedor de todo lo `fixed` que lleve dentro. El velo dejaba de
  // cubrir la pantalla y el diálogo quedaba recortado a la altura de la tarjeta.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-start sm:p-8 print:hidden">
      {/* El velo va aparte del diálogo: así puede aclararse mientras la hoja
          baja sin que el diálogo se aclare con él. */}
      <div
        ref={velo}
        aria-hidden
        className="velo-entra absolute inset-0 bg-velo backdrop-blur-[6px]"
        onMouseDown={() => { pulsadoEnVelo.current = true }}
        onClick={() => {
          if (pulsadoEnVelo.current) salir.current()
          pulsadoEnVelo.current = false
        }}
      />
      <div
        ref={caja}
        data-capa
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onMouseDown={() => { pulsadoEnVelo.current = false }}
        /* Alto acotado a la pantalla visible (`dvh`: descuenta las barras del
           navegador del teléfono) y desplazamiento DENTRO del cuerpo. Antes
           desplazaba el velo, y con la hoja apoyada abajo un formulario más
           alto que la pantalla —capturar 71 ítems, una convocatoria con su
           lista de personas— crecía hacia arriba por fuera del velo: el título
           y el aspa de cerrar quedaban donde ningún desplazamiento llegaba. */
        className={`${telefono ? '' : 'material-entra'} vidrio-flotante relative flex max-h-[94dvh] w-full ${ancho} flex-col overflow-hidden rounded-t-hoja border border-borde bg-superficie outline-none sm:max-h-[calc(100dvh-4rem)] sm:rounded-hoja`}
        style={telefono ? { willChange: 'transform' } : undefined}
      >
        {/* La cabecera es el asa. `touch-action: none` es obligatorio: sin él,
            el navegador se queda el gesto vertical y el arrastre no llega. */}
        <div
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          className="vidrio shrink-0 touch-none px-4 pt-2 pb-0 select-none sm:touch-auto sm:select-auto"
        >
          {/* El tirador dice «esto se arrastra» en el teléfono; en el
              escritorio sobra y no se dibuja. */}
          <div className="mx-auto mb-2 tirador sm:hidden" aria-hidden />
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-borde">
            <h3 id={idTitulo} className="rotulo text-tinta">{titulo}</h3>
            <button
              type="button"
              onClick={() => salir.current()}
              className="pulsable -mr-1 flex h-9 w-9 items-center justify-center rounded-pastilla bg-superficie-alta text-tinta-tenue hover:text-tinta"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>
        <div data-cuerpo className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** El desplazamiento pintado ahora mismo, leído del elemento: interrumpir desde
 *  el valor de destino en vez del que se ve produce un salto. */
function posicionActual(el: HTMLElement): number {
  return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0
}

/* --------------------------------------------------------------- avisos en línea --- */

const tonosAlerta = {
  error: 'border-l-alerta bg-alerta-suave text-alerta',
  aviso: 'border-l-aviso bg-aviso-suave text-aviso',
  info: 'border-l-dato bg-dato-suave text-dato',
} as const

/** Mensaje persistente dentro de un formulario o panel. */
export function Alerta({
  children, tono = 'error', className = '',
}: {
  children: ReactNode
  tono?: keyof typeof tonosAlerta
  className?: string
}) {
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`border border-borde border-l-2 px-3 py-2 text-sm leading-snug ${tonosAlerta[tono]} ${className}`}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------- esqueletos --- */

export function Esqueleto({ className = 'h-4 w-full' }: { className?: string }) {
  return <span aria-hidden className={`esqueleto block ${className}`} />
}

/** Marco de tabla en carga: conserva la retícula para que nada salte al llegar. */
export function EsqueletoTabla({ filas = 8, columnas = 6 }: { filas?: number; columnas?: number }) {
  return (
    <div className="p-4" role="status" aria-label="Cargando datos">
      <div className="space-y-2.5">
        {Array.from({ length: filas }).map((_, f) => (
          <div key={f} className="flex gap-3" style={{ opacity: 1 - f * 0.08 }}>
            {Array.from({ length: columnas }).map((_, c) => (
              <Esqueleto key={c} className={`h-4 ${c === 1 ? 'flex-[3]' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Marco de métricas en carga. */
export function EsqueletoMetricas({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Cargando indicadores">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="border border-borde bg-superficie p-4">
          <Esqueleto className="h-2.5 w-24" />
          <Esqueleto className="mt-4 h-8 w-16" />
          <Esqueleto className="mt-3 h-2.5 w-32" />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- pestañas --- */

export interface Pestana<T extends string> {
  clave: T
  titulo: string
  cuenta?: number
}

/**
 * Pestañas con semántica ARIA y recorrido por flechas, como espera un lector
 * de pantalla y como se navega una ficha de ocho apartados sin ratón.
 */
export function Pestanas<T extends string>({
  pestanas, activa, onCambio, etiqueta,
}: {
  pestanas: Pestana<T>[]
  activa: T
  onCambio: (c: T) => void
  etiqueta: string
}) {
  function alPulsar(e: React.KeyboardEvent) {
    const i = pestanas.findIndex((p) => p.clave === activa)
    const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (salto === 0) {
      if (e.key === 'Home') onCambio(pestanas[0].clave)
      else if (e.key === 'End') onCambio(pestanas[pestanas.length - 1].clave)
      else return
    } else {
      onCambio(pestanas[(i + salto + pestanas.length) % pestanas.length].clave)
    }
    e.preventDefault()
  }

  // La lente del apartado activo se desliza de uno a otro. Se mide con
  // `offsetLeft` porque vive dentro de la cinta que se desplaza: así viaja con
  // el contenido y no hay que recalcular al desplazarse.
  const cinta = useRef<HTMLDivElement>(null)
  const [lente, setLente] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const c = cinta.current
    if (!c) return
    const medir = () => {
      const sel = c.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!sel) return setLente(null)
      setLente({ x: sel.offsetLeft, w: sel.offsetWidth })
      // El apartado elegido no se queda cortado en el borde de la cinta.
      sel.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    return () => ro.disconnect()
  }, [activa, pestanas])

  return (
    <div
      ref={cinta}
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={alPulsar}
      className="cinta lente-viva relative flex max-w-full gap-0.5 overflow-x-auto rounded-pastilla bg-superficie-alta/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {lente && (
        <span
          aria-hidden
          className="pulgar lente-movil pointer-events-none absolute top-1 bottom-1 left-0 rounded-pastilla"
          style={{ transform: `translateX(${lente.x}px)`, width: lente.w }}
        />
      )}
      {pestanas.map((p) => {
        const sel = p.clave === activa
        return (
          <button
            key={p.clave}
            role="tab"
            id={`pestana-${p.clave}`}
            aria-selected={sel}
            aria-controls={`panel-${p.clave}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => onCambio(p.clave)}
            className={`pulsable relative z-[1] flex min-h-10 shrink-0 items-center gap-2 rounded-pastilla px-3.5 text-[13px] whitespace-nowrap transition-colors ${
              sel ? 'font-semibold text-tinta' : 'font-medium text-tinta-suave hover:text-tinta'
            }`}
          >
            {p.titulo}
            {p.cuenta !== undefined && p.cuenta > 0 && (
              <span
                className={`cifras rounded-pastilla px-1.5 py-0.5 text-[10px] leading-none ${
                  sel ? 'bg-marca text-fondo' : 'bg-borde/70 text-tinta-suave'
                }`}
              >
                {p.cuenta}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- paginación --- */

export function Paginador({
  pagina, paginas, total, onIr,
}: {
  pagina: number
  paginas: number
  total: number
  onIr: (p: number) => void
}) {
  if (paginas <= 1) return null
  return (
    <nav
      aria-label="Paginación del listado"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-4 py-3 text-xs text-tinta-suave"
    >
      <span>
        Página <span className="cifras text-tinta">{pagina + 1}</span> de{' '}
        <span className="cifras">{paginas}</span> · <span className="cifras">{total}</span> registros
      </span>
      <div className="flex gap-2">
        <Boton variante="fantasma" disabled={pagina === 0} onClick={() => onIr(pagina - 1)}>
          Anterior
        </Boton>
        <Boton variante="fantasma" disabled={pagina + 1 >= paginas} onClick={() => onIr(pagina + 1)}>
          Siguiente
        </Boton>
      </div>
    </nav>
  )
}

/* ---------------------------------------------------------------- búsqueda --- */

/** Campo de búsqueda con lupa, botón de borrado y atajo «/». */
export function Buscador({
  valor, onCambio, placeholder = 'Buscar…', atajo = true,
}: {
  valor: string
  onCambio: (v: string) => void
  placeholder?: string
  atajo?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!atajo) return
    function alPulsar(e: KeyboardEvent) {
      // Con un diálogo abierto el buscador está detrás del velo: llevar el foco
      // ahí saca al usuario del formulario sin que se vea a dónde ha ido, y al
      // volver a pinchar es fácil dar en el velo y cerrar el diálogo.
      if (hayCapaAbierta()) return
      const activo = document.activeElement
      const escribiendo =
        activo instanceof HTMLInputElement ||
        activo instanceof HTMLTextAreaElement ||
        activo instanceof HTMLSelectElement
      if (e.key === '/' && !escribiendo) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [atajo])

  return (
    <div className="relative">
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-tinta-tenue"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && valor && onCambio('')}
        className={`${campoBase} py-2 pr-9 pl-9`}
      />
      {valor ? (
        <button
          type="button"
          onClick={() => onCambio('')}
          aria-label="Limpiar la búsqueda"
          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-tinta-tenue transition-colors hover:text-tinta"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 2l12 12M14 2L2 14" />
          </svg>
        </button>
      ) : (
        atajo && (
          <kbd className="cifras pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 border border-borde px-1.5 py-0.5 text-[10px] text-tinta-tenue sm:block">
            /
          </kbd>
        )
      )}
    </div>
  )
}

/** El chevrón de los plegables: gira un cuarto de vuelta al abrirse (`.plegable`). */
export function Chevron({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`chevron shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  )
}
