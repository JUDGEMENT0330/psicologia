// ============================================================================
// BLOQUEO DEL DESPLAZAMIENTO — una sola cuenta para todas las capas
// ----------------------------------------------------------------------------
// Diálogos, hojas y la paleta bloquean el desplazamiento del documento mientras
// están abiertos. Antes cada uno guardaba el `overflow` que encontraba y lo
// devolvía al cerrarse; con dos capas a la vez, cerrar la de abajo primero
// (una hoja que abre un diálogo y navega) devolvía `hidden` al final y la
// página quedaba sin poder desplazarse hasta recargar. Con una cuenta, el
// documento se libera cuando se cierra la última capa, en el orden que sea.
// ============================================================================

let abiertas = 0
let original = ''

/** Bloquea el desplazamiento del documento. Devuelve la función que lo libera. */
export function bloquearDesplazamiento(): () => void {
  if (abiertas++ === 0) {
    original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  let liberado = false
  return () => {
    if (liberado) return
    liberado = true
    if (--abiertas === 0) document.body.style.overflow = original
  }
}
