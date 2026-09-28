// ============================================================================
// PLATAFORMA — en qué dispositivo y en qué modo se está ejecutando.
// ============================================================================

/** ¿Se está ejecutando como aplicación instalada y no dentro del navegador? */
export function enModoAplicacion(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari de iOS no implementa `display-mode: standalone` en versiones
    // antiguas; sí pone esta propiedad, que es la única señal fiable allí.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS se anuncia como Mac desde la versión 13; el táctil lo delata.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}
