import { useEffect } from 'react'
import { EN_ESCRITORIO, puente } from './puente'

/** Se avisa como mucho una vez por minuto: es un latido, no un rastreo. */
const CADENCIA_MS = 60_000

/**
 * El proceso principal cierra la sesión tras un rato sin actividad —un equipo
 * de clínica se queda solo con frecuencia—. Para saber si sigue habiendo
 * alguien delante hace falta que la interfaz lo diga, porque desde fuera una
 * ficha abierta y leída durante veinte minutos es indistinguible de una ficha
 * abandonada en pantalla.
 */
export function useLatido(activo: boolean) {
  useEffect(() => {
    if (!EN_ESCRITORIO || !activo) return
    let ultimo = 0
    const avisar = () => {
      const t = Date.now()
      if (t - ultimo < CADENCIA_MS) return
      ultimo = t
      puente().latido()
    }
    avisar()
    const eventos = ['pointerdown', 'keydown', 'wheel', 'focus'] as const
    for (const e of eventos) window.addEventListener(e, avisar, { passive: true, capture: true })
    return () => {
      for (const e of eventos) window.removeEventListener(e, avisar, { capture: true })
    }
  }, [activo])
}
