// ============================================================================
// RETRATO — el avatar, el visor y el cambio de foto
// ----------------------------------------------------------------------------
// Tres piezas que van juntas porque son la misma cosa vista de cerca y de
// lejos:
//
//  · `Retrato` es la cara pequeña que sale en la barra lateral y en la lista de
//    cuentas. Cuando no hay foto NO deja un hueco: enseña las iniciales, del
//    mismo tamaño, para que la fila no cambie de alto según quién sea.
//  · `VisorRetrato` es lo que se abre al pulsarla: la foto en grande, con el
//    nombre y el cargo debajo. Sirve para reconocer a alguien, que es para lo
//    que se guarda un retrato en un sistema con turnos y personal que rota.
//  · `SelectorRetrato` es el botón de subir o quitar la foto. Reduce la imagen
//    en la propia pantalla —una cara de 512 píxeles— antes de guardarla, así
//    que la fotografía original nunca sale del equipo.
//
// El retrato es un dato de la cuenta, no del expediente: no lleva información
// clínica y por eso puede verlo cualquiera que ya tenga acceso al sistema.
// ============================================================================

import { useRef, useState, type ReactNode } from 'react'
import { cuentas } from '../lib/cuentas'
import { useAvisos } from '../lib/avisos'
import {
  ErrorRetrato, LADO_RETRATO, TIPOS_RETRATO, fotoDePerfil, iniciales, retratoDesdeArchivo,
} from '../lib/fotos'
import { Boton, Modal } from './ui'

interface RetratoProps {
  nombre?: string | null
  /** Lo guardado en el perfil. Manda sobre el que venga dentro del programa. */
  foto?: string | null
  /** Lado de la caja en píxeles. La misma con foto y sin ella. */
  px?: number
  /** Qué pasa al pulsarlo. Sin esto, el retrato no es un botón. */
  onPulsar?: () => void
  className?: string
}

export function Retrato({ nombre, foto, px = 28, onPulsar, className = '' }: RetratoProps) {
  const src = fotoDePerfil(nombre, foto)
  const caja = `shrink-0 border border-borde bg-superficie-alta ${className}`
  const estilo = { width: px, height: px }

  const contenido = src ? (
    <img
      src={src}
      alt={nombre ? `Retrato de ${nombre}` : ''}
      // `object-top` porque los retratos son verticales y el recorte cuadrado
      // debe quedarse con la cara, no con el torso.
      className="h-full w-full object-cover object-top"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-full w-full items-center justify-center font-semibold text-tinta-suave"
      style={{ fontSize: Math.max(10, Math.round(px * 0.38)) }}
    >
      {iniciales(nombre)}
    </span>
  )

  if (!onPulsar) {
    return <div className={caja} style={estilo}>{contenido}</div>
  }
  return (
    <button
      type="button"
      onClick={onPulsar}
      title={src ? 'Ver el retrato en grande' : 'Sin retrato'}
      aria-label={src ? `Ver el retrato de ${nombre ?? 'la cuenta'} en grande` : 'Sin retrato'}
      className={`${caja} overflow-hidden transition-opacity hover:opacity-80`}
      style={estilo}
    >
      {contenido}
    </button>
  )
}

/** La foto en grande, con quién es debajo. */
export function VisorRetrato({
  nombre, foto, detalle, onCerrar, pie,
}: {
  nombre?: string | null
  foto?: string | null
  detalle?: string | null
  onCerrar: () => void
  /** Acciones que se ofrecen bajo la foto: cambiarla, quitarla. */
  pie?: ReactNode
}) {
  const src = fotoDePerfil(nombre, foto)
  return (
    <Modal titulo={nombre ?? 'Retrato'} onCerrar={onCerrar} ancho="max-w-lg">
      <div className="space-y-4">
        {src ? (
          <img
            src={src}
            alt={`Retrato de ${nombre ?? 'la cuenta'}`}
            className="mx-auto max-h-[60dvh] w-auto border border-borde bg-superficie-alta object-contain"
          />
        ) : (
          <div className="flex h-56 items-center justify-center border border-borde bg-superficie-alta text-4xl font-semibold text-tinta-tenue">
            {iniciales(nombre)}
          </div>
        )}
        <div className="border-t border-borde pt-3 text-center">
          <div className="text-sm font-medium text-tinta">{nombre ?? '—'}</div>
          {detalle && <div className="text-[11px] text-tinta-tenue">{detalle}</div>}
        </div>
        {pie && <div className="flex flex-wrap justify-center gap-2 border-t border-borde pt-3">{pie}</div>}
      </div>
    </Modal>
  )
}

/**
 * Subir o quitar el retrato de una cuenta. `perfilId` nulo es «la mía»; el de
 * otra persona sólo lo admite el servidor a la administración, y por eso el
 * permiso no se decide aquí: aquí sólo se ofrece el botón.
 */
export function SelectorRetrato({
  perfilId = null, tieneFoto, onGuardado, compacto,
}: {
  perfilId?: string | null
  tieneFoto: boolean
  onGuardado: (foto: string | null) => void
  compacto?: boolean
}) {
  const avisos = useAvisos()
  const entrada = useRef<HTMLInputElement>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)

  async function elegido(archivo: File | undefined) {
    if (!archivo) return
    setTrabajando(true)
    try {
      const foto = await retratoDesdeArchivo(archivo)
      const r = await cuentas.guardarFoto(perfilId, foto)
      if (r.error) throw new ErrorRetrato(r.error.message)
      avisos.exito('Retrato guardado.')
      onGuardado(foto)
    } catch (e) {
      avisos.error(e instanceof Error ? e.message : 'No se pudo guardar el retrato.')
    } finally {
      setTrabajando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function quitar() {
    setTrabajando(true)
    const r = await cuentas.guardarFoto(perfilId, null)
    setTrabajando(false)
    setConfirmandoQuitar(false)
    if (r.error) {
      avisos.error(r.error.message)
      return
    }
    avisos.exito('Retrato quitado.')
    onGuardado(null)
  }

  const clase = compacto ? 'min-h-8 px-2 text-[11px]' : ''

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_RETRATO.join(',')}
        className="hidden"
        onChange={(e) => elegido(e.target.files?.[0])}
      />
      <Boton
        variante="secundario"
        className={clase}
        disabled={trabajando}
        aria-busy={trabajando}
        onClick={() => entrada.current?.click()}
      >
        {trabajando ? 'Guardando…' : tieneFoto ? 'Cambiar retrato' : 'Subir retrato'}
      </Boton>
      {tieneFoto && (
        <Boton
          variante="fantasma"
          className={clase}
          disabled={trabajando}
          onClick={() => (confirmandoQuitar ? quitar() : setConfirmandoQuitar(true))}
        >
          {confirmandoQuitar ? 'Pulse otra vez para quitarlo' : 'Quitar'}
        </Boton>
      )}
      {!compacto && (
        <p className="w-full text-[11px] leading-relaxed text-tinta-tenue">
          La imagen se reduce a {LADO_RETRATO} píxeles y se recorta cuadrada por la parte alta antes
          de guardarse: mande una foto de frente y con la cara arriba. La original no sale de este
          equipo.
        </p>
      )}
    </>
  )
}
