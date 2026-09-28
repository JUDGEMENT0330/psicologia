/* ============================================================================
   TRABAJADOR DE SERVICIO — la aplicación instalada en el teléfono
   ----------------------------------------------------------------------------
   Hace tres cosas y ninguna más:

     1. Guarda el armazón —la página, los tipos, los iconos, el paquete de
        JavaScript— para que la aplicación ABRA sin red. En el destacamento la
        cobertura entra y sale; una pantalla en blanco por un segundo sin señal
        es lo que hace que alguien vuelva al papel.

     2. Sirve los archivos con huella (`/assets/nombre-abc123.js`) desde la
        caché sin preguntar: llevan su versión en el nombre, así que si el
        nombre coincide, el contenido coincide. Lo demás va a la red primero.

     3. Abre la aplicación en el sitio que toca cuando se toca una notificación.

   LO QUE NO HACE, a propósito: guardar respuestas de Supabase. El expediente
   clínico no se queda en la caché del teléfono. Si no hay red, no hay datos de
   pacientes —hay un armazón que lo dice—, y eso es deliberado: un teléfono que
   se pierde no puede llevar encima el padrón de la unidad.
   ============================================================================ */

// Al cambiar este número, el navegador tira la caché anterior entera. Se sube
// cuando cambia la estrategia, no en cada despliegue: los archivos llevan
// huella en el nombre y se renuevan solos.
const VERSION = 'psi-v1'
const CACHE_ARMAZON = `${VERSION}-armazon`
const CACHE_RECURSOS = `${VERSION}-recursos`
// La malla del cerebro —2 MB— va en una caché APARTE y sin versión: su
// contenido no cambia entre despliegues. Se limpia sola sólo si el navegador aprieta.
const CACHE_MALLAS = 'psi-malla-cerebro'

// Lo mínimo para que la aplicación pinte algo con el avión puesto.
const ARMAZON = [
  '/',
  '/manifest.webmanifest',
  '/icono-192.png',
  '/icono-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_ARMAZON)
      // `addAll` falla entero si un solo archivo falla. Se piden de uno en uno
      // para que la falta de un icono no deje la aplicación sin instalar.
      .then((c) => Promise.all(ARMAZON.map((u) => c.add(u).catch(() => undefined)))),
  )
  // OJO: aquí NO se llama a `skipWaiting()`. Con él, la versión nueva entraba
  // en cuanto terminaba de descargarse, reclamaba las pestañas abiertas y la
  // aplicación se recargaba por debajo de quien estuviera escribiendo una
  // consulta. La versión nueva se queda esperando y entra cuando la persona
  // pulsa «Actualizar», que es lo que manda el mensaje `activar-ya`.
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((llaves) =>
        Promise.all(
          llaves
            .filter((k) => !k.startsWith(VERSION) && k !== CACHE_MALLAS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (e) => {
  // La pantalla avisa de que hay versión nueva y el usuario decide cuándo
  // entra. Recargar por debajo de alguien que está escribiendo una consulta es
  // perder lo escrito.
  if (e.data === 'activar-ya') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase y demás: sin tocar

  // Navegación: red primero, y el armazón guardado como red de seguridad. Así
  // un despliegue nuevo se ve al instante y un túnel sin cobertura no deja la
  // pantalla en blanco.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          // Sólo se guarda una respuesta buena: un 404 o un 502 del alojamiento
          // también llegan como página, y guardarlo dejaba el armazón sin red
          // sirviendo para siempre la pantalla de error.
          if (r.ok) {
            const copia = r.clone()
            caches.open(CACHE_ARMAZON).then((c) => c.put('/', copia))
          }
          return r
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }

  // La malla del cerebro: guardada primero y para siempre. No cambia.
  if (url.pathname.startsWith('/cerebro/')) {
    e.respondWith(
      caches.match(req).then(
        (guardado) =>
          guardado ??
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone()
              caches.open(CACHE_MALLAS).then((c) => c.put(req, copia))
            }
            return r
          }),
      ),
    )
    return
  }

  // Archivo con huella en el nombre: si está, está bien.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (guardado) =>
          guardado ??
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone()
              caches.open(CACHE_RECURSOS).then((c) => c.put(req, copia))
            }
            return r
          }),
      ),
    )
    return
  }

  // Iconos, manifiesto, tarjeta social: lo guardado primero y la red por
  // detrás, para que la próxima visita ya lo tenga fresco.
  if (/\.(png|ico|webmanifest|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((guardado) => {
        const red = fetch(req)
          .then((r) => {
            if (r.ok) {
              const copia = r.clone()
              caches.open(CACHE_RECURSOS).then((c) => c.put(req, copia))
            }
            return r
          })
          .catch(() => guardado ?? Response.error())
        return guardado ?? red
      }),
    )
  }
})

/* ----------------------------------------------------------- avisos ------ */

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const ruta = (e.notification.data && e.notification.data.ruta) || '/recordatorios'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      // Si ya hay una ventana abierta, se la lleva al sitio en vez de abrir
      // una segunda copia de la aplicación.
      for (const c of lista) {
        if ('focus' in c) {
          c.navigate(ruta).catch(() => undefined)
          return c.focus()
        }
      }
      return self.clients.openWindow(ruta)
    }),
  )
})
