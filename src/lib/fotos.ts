// ============================================================================
// RETRATOS DE PERFIL
// ----------------------------------------------------------------------------
// El retrato de cada cuenta vive AHORA EN LA BASE, en `perfiles.foto`, como
// imagen incrustada. Antes viajaba dentro del programa —una imagen en el código
// por persona, puesta a mano—, y eso servía para una cuenta y no para una
// unidad: quien entraba no podía ponerse su foto sin que alguien recompilara la
// aplicación. Las que ya venían dentro siguen funcionando como respaldo, para
// que nadie pierda su retrato mientras no vuelva a subirlo.
//
// POR QUÉ INCRUSTADA Y NO EN UN ALMACÉN DE ARCHIVOS: la versión de escritorio
// trabaja sin red y tiene que enseñar el mismo retrato, y así la foto viaja en
// el mismo paquete de datos que ya se exporta e importa entre las dos
// versiones. El precio es el tamaño, y por eso la imagen se REDUCE aquí antes
// de guardarla: lo que se manda a la base es una cara de 512 píxeles, no la
// fotografía de 4 megapíxeles que sale del teléfono.
// ============================================================================

/** Nombre sin acentos, sin puntos y en minúsculas, para comparar sin sorpresas. */
function clave(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Retratos que vienen dentro del programa. Sólo se usan cuando la cuenta no
// tiene foto guardada. Psicología no trae ninguno: cada quien sube el suyo.
const RETRATOS: { senas: string; foto: string }[] = []

/**
 * El retrato que hay que enseñar: primero el guardado en el perfil, y si no lo
 * hay, el que viniera dentro del programa para ese nombre.
 */
export function fotoDePerfil(nombre?: string | null, guardada?: string | null): string | undefined {
  if (guardada) return guardada
  if (!nombre) return undefined
  const k = clave(nombre)
  return RETRATOS.find((r) => k.includes(r.senas))?.foto
}

/** Iniciales para cuando no hay retrato. Nunca más de dos. */
export function iniciales(nombre?: string | null): string {
  if (!nombre) return '—'
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// ------------------------------------------------------------- la imagen ---

/** Lado máximo del retrato guardado, en píxeles. Una cara no necesita más. */
export const LADO_RETRATO = 512
/** Tope de lo que se acepta guardar, en caracteres del texto incrustado. */
export const LIMITE_RETRATO = 1_000_000
/** Lo que se admite subir. El resto ni se intenta abrir. */
export const TIPOS_RETRATO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export class ErrorRetrato extends Error {}

/**
 * Lee la imagen que eligió la persona y devuelve el retrato ya reducido, listo
 * para guardar. Recorta al CUADRADO por el centro horizontal y por la parte
 * ALTA en vertical, que es donde está la cara en una foto de cuerpo.
 *
 * Se hace en la pantalla y no en el servidor a propósito: así la fotografía
 * original no llega a salir del equipo, y lo que viaja por la red es la imagen
 * pequeña.
 */
export async function retratoDesdeArchivo(archivo: File): Promise<string> {
  if (archivo.size > 25 * 1024 * 1024) {
    throw new ErrorRetrato('La imagen pesa demasiado. Use una foto normal de cámara o teléfono.')
  }
  const url = URL.createObjectURL(archivo)
  try {
    const img = await cargarImagen(url)
    const lado = Math.min(img.naturalWidth, img.naturalHeight, LADO_RETRATO)
    const lienzo = document.createElement('canvas')
    lienzo.width = lado
    lienzo.height = lado
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new ErrorRetrato('El navegador no pudo procesar la imagen.')

    // El recorte cuadrado: centrado a lo ancho, pegado arriba a lo alto.
    const corte = Math.min(img.naturalWidth, img.naturalHeight)
    const x = (img.naturalWidth - corte) / 2
    const y = Math.min((img.naturalHeight - corte) / 2, corte * 0.08)
    ctx.drawImage(img, x, Math.max(0, y), corte, corte, 0, 0, lado, lado)

    // Se baja la calidad hasta que quepa: una cara aguanta bien la compresión y
    // es preferible a rechazar la foto de alguien por unos kilobytes.
    for (const calidad of [0.82, 0.7, 0.6, 0.5]) {
      const dato = lienzo.toDataURL('image/jpeg', calidad)
      if (dato.length <= LIMITE_RETRATO) return dato
    }
    throw new ErrorRetrato('No se pudo reducir la imagen lo suficiente. Pruebe con otra.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => rechazar(new ErrorRetrato('No se pudo abrir el archivo como imagen.'))
    img.src = url
  })
}
