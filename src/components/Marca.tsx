// ============================================================================
// MARCA
// ----------------------------------------------------------------------------
// Un solo lugar del que sale el logotipo, para que cambiarlo sea cambiar una
// imagen y no rastrear dónde estaba dibujado.
//
// **Para poner el logotipo real: sustituya `src/assets/logo.png`** conservando
// el nombre. Cuadrado, 512 × 512 px o más, con fondo propio y sin márgenes
// transparentes. El detalle completo está en `docs/MARCA.md`.
// ============================================================================

import logo from '../assets/logo.png'

/**
 * Escudo o logotipo, siempre cuadrado. Los tamaños están calibrados para una
 * imagen ilustrativa, no para un monograma: por debajo de 48 px un dibujo con
 * detalle se vuelve una mancha. En la barra lateral ocupa 64 px —el alto de dos
 * líneas de texto, que es lo que hay al lado— y en la pantalla de acceso 88 px,
 * donde tiene sitio de sobra.
 */
export function Logotipo({ px = 64, className = '' }: { px?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt=""
      width={px}
      height={px}
      // `object-contain` para que un archivo que no sea exactamente cuadrado se
      // ajuste dentro de la caja en lugar de estirarse.
      className={`shrink-0 object-contain ${className}`}
      style={{ width: px, height: px }}
    />
  )
}
