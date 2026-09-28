// ============================================================================
// INSTALACIÓN EN EL TELÉFONO
// ----------------------------------------------------------------------------
// Registra el trabajador de servicio y resuelve la pregunta que hace la
// interfaz: «¿se puede instalar esto aquí, y cómo?».
//
// En Android y en el escritorio el navegador ofrece un diálogo nativo y lo
// anuncia con `beforeinstallprompt`; basta guardarlo y dispararlo cuando el
// usuario pulse. En iPhone no existe ese evento y nunca va a existir: allí la
// instalación es Compartir → Añadir a pantalla de inicio, y lo único que puede
// hacer la aplicación es enseñar el camino con claridad.
//
// En la versión de escritorio (Electron) no se registra nada: allí ya hay una
// aplicación instalada y un trabajador de servicio sobre `file://` sólo puede
// dar problemas.
// ============================================================================

import { useEffect, useState } from 'react'
import { EN_ESCRITORIO } from './escritorio/puente'
import { enModoAplicacion, esIOS } from './plataforma'

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let guardado: EventoInstalacion | null = null
const oyentes = new Set<() => void>()

function avisar() {
  for (const o of oyentes) o()
}

if (typeof window !== 'undefined' && !EN_ESCRITORIO) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sin esto el navegador saca su propia barra, que aparece donde quiere y
    // dice lo que quiere. Se guarda para ofrecerla desde la aplicación.
    e.preventDefault()
    guardado = e as EventoInstalacion
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    guardado = null
    avisar()
  })
}

/* --------------------------------------------------------- versión nueva -- */

let hayVersionNueva = false
const oyentesVersion = new Set<() => void>()

/**
 * ¿Hay una versión ya descargada esperando? La aplicación NO se recarga sola:
 * hacerlo por debajo de alguien que está escribiendo una consulta es perder lo
 * escrito. Se ofrece, y entra cuando la persona quiere.
 */
export function useVersionNueva(): boolean {
  const [, refrescar] = useState(0)
  useEffect(() => {
    const o = () => refrescar((n) => n + 1)
    oyentesVersion.add(o)
    return () => {
      oyentesVersion.delete(o)
    }
  }, [])
  return hayVersionNueva
}

/** Registra el trabajador de servicio. Se llama una vez, al arrancar. */
export function registrarServicio() {
  if (EN_ESCRITORIO) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // En desarrollo estorba: deja servido el paquete anterior y hace perder
  // media hora buscando un cambio que sí estaba.
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing
          if (!nuevo) return
          nuevo.addEventListener('statechange', () => {
            // `controller` existe sólo si ya había una versión sirviendo: sin
            // él, esto es la primera instalación y no hay nada que anunciar.
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              hayVersionNueva = true
              for (const o of oyentesVersion) o()
            }
          })
        })
      })
      .catch(() => {
        // Sin trabajador de servicio la aplicación funciona igual; lo que se
        // pierde es abrir sin red. No es motivo para molestar a nadie.
      })
  })

  // Sólo se recarga cuando una versión NUEVA releva a la que estaba sirviendo,
  // que es lo que pasa al pulsar «Actualizar». En la primera visita no hay
  // controlador: el `clients.claim()` del trabajador también dispara este
  // evento, y sin esta guarda la aplicación se recargaba sola nada más abrirse.
  const controladaAlInicio = !!navigator.serviceWorker.controller
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controladaAlInicio || recargando) return
    recargando = true
    window.location.reload()
  })
}

/** Aplica la versión nueva ya descargada. */
export async function aplicarVersionNueva() {
  const reg = await navigator.serviceWorker?.getRegistration()
  reg?.waiting?.postMessage('activar-ya')
}

export type ViaInstalacion = 'nativa' | 'ios-manual' | 'ya-instalada' | 'no-disponible'

export interface Instalacion {
  via: ViaInstalacion
  /** Abre el diálogo del navegador. Sólo cuando la vía es 'nativa'. */
  instalar: () => Promise<boolean>
}

export function useInstalacion(): Instalacion {
  const [, refrescar] = useState(0)

  useEffect(() => {
    const o = () => refrescar((n) => n + 1)
    oyentes.add(o)
    return () => {
      oyentes.delete(o)
    }
  }, [])

  const via: ViaInstalacion = EN_ESCRITORIO
    ? 'no-disponible'
    : enModoAplicacion()
      ? 'ya-instalada'
      : guardado
        ? 'nativa'
        : esIOS()
          ? 'ios-manual'
          : 'no-disponible'

  return {
    via,
    async instalar() {
      if (!guardado) return false
      await guardado.prompt()
      const { outcome } = await guardado.userChoice
      guardado = null
      avisar()
      return outcome === 'accepted'
    },
  }
}

/* ------------------------------------------------------- la invitación --- */

const LLAVE_DESCARTADA = 'dm1-instalacion-descartada'

/**
 * La invitación a instalar se ofrece UNA VEZ y sólo donde tiene sentido. Quien
 * dice que no, no vuelve a verla: el enlace se queda en la pantalla de Perfil
 * para cuando cambie de idea.
 */
export function useInvitacionInstalacion(): [boolean, () => void] {
  const { via } = useInstalacion()
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    if (via === 'ya-instalada' || via === 'no-disponible') return
    let descartada = false
    try {
      descartada = localStorage.getItem(LLAVE_DESCARTADA) === 'si'
    } catch {
      /* sin almacenamiento se ofrece cada vez, que es mejor que no ofrecerla */
    }
    if (descartada) return
    // Un cuarto de minuto después de entrar: lo justo para que quien abrió la
    // aplicación a hacer algo concreto lo empiece antes de que le interrumpan.
    const t = setTimeout(() => setAbierta(true), 15_000)
    return () => clearTimeout(t)
  }, [via])

  return [
    abierta,
    () => {
      setAbierta(false)
      try {
        localStorage.setItem(LLAVE_DESCARTADA, 'si')
      } catch {
        /* lo peor que pasa es que vuelva a ofrecerse */
      }
    },
  ]
}
