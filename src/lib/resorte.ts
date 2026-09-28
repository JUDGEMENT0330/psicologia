/* ============================================================================
   RESORTE — el movimiento de lo que se toca
   ----------------------------------------------------------------------------
   Una transición de CSS no se puede agarrar a media carrera: si el dedo vuelve
   mientras la hoja se cierra, hay que esperar a que termine de cerrarse para
   que vuelva a abrirse. Un muelle sí: cambiar el destino no reinicia nada,
   sólo cambia hacia dónde tira, y la velocidad que llevaba se conserva. Por eso
   TODO lo que responde a un gesto en esta aplicación pasa por aquí y no por
   `transition`.

   Los dos parámetros son los de Apple, no los del libro de física:

     amortiguación  1 = llega y se para. Por debajo de 1 se pasa y vuelve.
     respuesta      cuánto tarda en llegar, en segundos. No es «duración»:
                    un muelle no tiene duración, se para cuando se para.

   Por omisión, amortiguación 1: el rebote sólo se gana cuando el gesto traía
   impulso. Una hoja que aparece sola y rebota parece un juguete.
   ========================================================================== */

export interface OpcionesResorte {
  /** 1 = crítico, sin rebote. 0.8 = el rebote corto de una tarjeta lanzada. */
  amortiguacion?: number
  /** Tiempo de respuesta en segundos. 0.3–0.4 en casi todo. */
  respuesta?: number
  /** Velocidad inicial en px/s: la que traía el dedo al soltar. */
  velocidad?: number
  /** Se llama en cada fotograma con el valor actual. */
  alMover: (valor: number) => void
  /** Se llama una vez cuando el muelle se detiene. No se llama si se cancela. */
  alParar?: () => void
}

export interface Muelle {
  /** Cambia el destino SIN cortar el movimiento: la velocidad actual sigue. */
  a(destino: number, opciones?: { amortiguacion?: number; respuesta?: number }): void
  /** Corta el movimiento donde esté. Lo que hace un dedo al posarse encima. */
  detener(): void
  /** El valor que está pintado ahora mismo, no el de destino. */
  valor(): number
  velocidadActual(): number
  activo(): boolean
}

/** Por debajo de estos dos umbrales, el ojo ya no distingue el movimiento. */
const UMBRAL_DISTANCIA = 0.4
const UMBRAL_VELOCIDAD = 0.4

/**
 * Arranca un muelle desde `desde` hacia `hasta`. Devuelve el mando: se le puede
 * cambiar el destino a media carrera, o pararlo en seco cuando el dedo vuelve.
 */
export function resorte(desde: number, hasta: number, op: OpcionesResorte): Muelle {
  const reducido =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  let x = desde
  let v = op.velocidad ?? 0
  let destino = hasta
  let amortiguacion = op.amortiguacion ?? 1
  let respuesta = op.respuesta ?? 0.4
  let raf = 0
  let previo = 0
  let vivo = true

  // Movimiento reducido: se salta el recorrido, no la información. El valor
  // llega a su sitio en el fotograma siguiente y el resto de la interfaz se
  // entera igual.
  if (reducido) {
    x = destino
    op.alMover(x)
    op.alParar?.()
    vivo = false
    return mando()
  }

  const paso = (t: number) => {
    if (!vivo) return
    // Un paso largo —la pestaña estuvo en segundo plano— desintegra cualquier
    // integrador. Se recorta a 64 ms: más vale un salto que una explosión.
    const dt = Math.min(0.064, previo ? (t - previo) / 1000 : 1 / 60)
    previo = t

    // Traducción de los dos parámetros de diseño a los de la ecuación.
    const w = (2 * Math.PI) / respuesta
    const k = w * w
    const c = 2 * amortiguacion * w

    // Integración semi-implícita: estable con muelles rígidos, a diferencia del
    // Euler explícito, que a respuesta 0.2 se va a infinito.
    const a = -k * (x - destino) - c * v
    v += a * dt
    x += v * dt

    if (Math.abs(x - destino) < UMBRAL_DISTANCIA && Math.abs(v) < UMBRAL_VELOCIDAD) {
      x = destino
      v = 0
      vivo = false
      op.alMover(x)
      op.alParar?.()
      return
    }

    op.alMover(x)
    raf = requestAnimationFrame(paso)
  }

  raf = requestAnimationFrame(paso)

  function mando(): Muelle {
    return {
      a(nuevo, opciones) {
        destino = nuevo
        if (opciones?.amortiguacion !== undefined) amortiguacion = opciones.amortiguacion
        if (opciones?.respuesta !== undefined) respuesta = opciones.respuesta
        // Si ya se había parado, vuelve a arrancar DESDE DONDE ESTÁ y con la
        // velocidad que tenga: es lo que evita el salto al invertir un gesto.
        if (!vivo) {
          if (reducido) {
            x = destino
            op.alMover(x)
            op.alParar?.()
            return
          }
          vivo = true
          previo = 0
          raf = requestAnimationFrame(paso)
        }
      },
      detener() {
        vivo = false
        cancelAnimationFrame(raf)
      },
      valor: () => x,
      velocidadActual: () => v,
      activo: () => vivo,
    }
  }

  return mando()
}

/**
 * Dónde se pararía algo lanzado a esta velocidad. Es la deceleración del
 * desplazamiento del sistema, y sirve para decidir el destino de un gesto: no
 * se mira dónde se soltó el dedo sino a dónde iba.
 *
 * La fórmula es la exponencial del desplazamiento —no la de v²/2a del libro—,
 * porque es la que se corresponde con lo que hace la lista de un teléfono.
 *
 * @param velocidad px/s al soltar
 * @param deceleracion 0.998 el tacto normal; 0.99 uno más seco
 */
export function proyectar(velocidad: number, deceleracion = 0.998): number {
  return (velocidad / 1000) * (deceleracion / (1 - deceleracion))
}

/**
 * Resistencia elástica en el borde. Pasado el límite el dedo sigue mandando,
 * pero cada píxel cuesta más que el anterior: el recorrido se frena solo en
 * lugar de topar con un muro, que es lo que se lee como «se ha colgado».
 *
 * @param exceso cuánto se ha pasado del límite, en px
 * @param medida la dimensión contra la que se compara (alto de la hoja, ancho
 *        de la fila): la misma goma tiene que ceder distinto en cada una
 */
export function gomaElastica(exceso: number, medida: number, constante = 0.55): number {
  return (exceso * medida * constante) / (medida + constante * Math.abs(exceso))
}

/**
 * Historial corto de posiciones para sacar la velocidad al soltar. Con el
 * último `pointermove` solo no basta: un dedo que se detiene un instante antes
 * de levantarse daría velocidad cero y el gesto moriría en el sitio.
 */
export class Rastro {
  private puntos: { v: number; t: number }[] = []

  anotar(valor: number) {
    const t = performance.now()
    this.puntos.push({ v: valor, t })
    // 100 ms de ventana: lo que dura la intención, no el gesto entero.
    while (this.puntos.length > 2 && t - this.puntos[0].t > 100) this.puntos.shift()
  }

  /** px por segundo. Cero si no hay con qué compararla. */
  velocidad(): number {
    if (this.puntos.length < 2) return 0
    const a = this.puntos[0]
    const b = this.puntos[this.puntos.length - 1]
    const dt = (b.t - a.t) / 1000
    if (dt <= 0) return 0
    return (b.v - a.v) / dt
  }

  limpiar() {
    this.puntos = []
  }
}
