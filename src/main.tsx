import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registrarServicio } from './lib/pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// El trabajador de servicio: es lo que hace que la aplicación añadida a la
// pantalla de inicio del iPhone abra sin red y pueda levantar avisos. No se
// registra ni en desarrollo ni en la versión de escritorio (ver `lib/pwa.ts`).
// Cuando haya una versión nueva descargada, el armazón lo ofrece (`useVersionNueva`
// en `Layout.tsx`): no se recarga por debajo de nadie, que es como se pierde una
// consulta a medio escribir.
registrarServicio()
