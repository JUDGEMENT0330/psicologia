import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { TemaProvider } from './lib/tema'
import { AvisosProvider } from './lib/avisos'
import Layout from './components/Layout'
import Limite from './components/Limite'
import Login from './pages/Login'
import { Alerta, Boton, Cargando } from './components/ui'

// Cada sección se descarga cuando se entra en ella. Quien abre un enlace de
// evaluación sólo descarga el formulario público: ni el visor 3D, ni las
// gráficas, ni la pantalla de acceso.
const Publico = lazy(() => import('./pages/Publico'))
const Tablero = lazy(() => import('./pages/Tablero'))
const Evaluados = lazy(() => import('./pages/Evaluados'))
const Ficha = lazy(() => import('./pages/Ficha'))
const Aplicaciones = lazy(() => import('./pages/Aplicaciones'))
const Convocatorias = lazy(() => import('./pages/Convocatorias'))
const Convocatoria = lazy(() => import('./pages/Convocatoria'))
const Baterias = lazy(() => import('./pages/Baterias'))
const Instrumentos = lazy(() => import('./pages/Instrumentos'))
const Instrumento = lazy(() => import('./pages/Instrumento'))
const Problemas = lazy(() => import('./pages/Problemas'))
const Estadisticas = lazy(() => import('./pages/Estadisticas'))
const Perfil = lazy(() => import('./pages/Perfil'))
const CambioObligatorio = lazy(() => import('./pages/CambioObligatorio'))

/**
 * El límite de error se rearma al cambiar de ruta: si una ficha concreta trae
 * un dato que rompe la pantalla, se sale de ella navegando y no reiniciando.
 */
function Seccion({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return (
    <Limite llave={pathname}>
      <Suspense fallback={<Cargando texto="Abriendo sección…" />}>{children}</Suspense>
    </Limite>
  )
}

function Rutas() {
  const { session, perfil, cargando, errorPerfil, esPsicologo, veEstadisticas, salir } = useAuth()
  const { pathname } = useLocation()

  // El enlace de evaluación es público: no pide cuenta ni la mira.
  if (pathname.startsWith('/e/')) {
    return (
      <Routes>
        <Route path="/e/:token" element={<Seccion><Publico /></Seccion>} />
      </Routes>
    )
  }

  if (cargando && !session) {
    return <div className="flex min-h-screen items-center justify-center"><Cargando texto="Iniciando…" /></div>
  }
  if (!session) return <Login />
  if (cargando) return <div className="flex min-h-screen items-center justify-center"><Cargando texto="Leyendo su perfil…" /></div>

  if (!perfil || !perfil.activo || (!esPsicologo && !veEstadisticas)) {
    return <SinAcceso motivo={errorPerfil} salir={salir} />
  }

  // Una contraseña provisional no da acceso a nada hasta que se cambia.
  if (perfil.debe_cambiar_clave) {
    return <Suspense fallback={<Cargando texto="Abriendo…" />}><CambioObligatorio /></Suspense>
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {esPsicologo ? (
          <>
            <Route index element={<Seccion><Tablero /></Seccion>} />
            <Route path="evaluados" element={<Seccion><Evaluados /></Seccion>} />
            <Route path="evaluados/:id" element={<Seccion><Ficha /></Seccion>} />
            <Route path="aplicaciones" element={<Seccion><Aplicaciones /></Seccion>} />
            <Route path="convocatorias" element={<Seccion><Convocatorias /></Seccion>} />
            <Route path="convocatorias/:id" element={<Seccion><Convocatoria /></Seccion>} />
            <Route path="baterias" element={<Seccion><Baterias /></Seccion>} />
            <Route path="instrumentos" element={<Seccion><Instrumentos /></Seccion>} />
            <Route path="instrumentos/:clave" element={<Seccion><Instrumento /></Seccion>} />
            <Route path="problemas" element={<Seccion><Problemas /></Seccion>} />
          </>
        ) : (
          // S-4 y Comandante: su inicio son las estadísticas. Ninguna otra ruta existe para ellos.
          <Route index element={<Navigate to="/estadisticas" replace />} />
        )}
        <Route path="estadisticas" element={<Seccion><Estadisticas /></Seccion>} />
        <Route path="perfil" element={<Seccion><Perfil /></Seccion>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SinAcceso({ motivo, salir }: { motivo: string | null; salir: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo px-6">
      <div className="w-full max-w-md space-y-4">
        <div className="cifras rotulo text-marca">Psicología · acceso</div>
        <h1 className="titular text-2xl text-tinta">Su cuenta no tiene acceso a este módulo</h1>
        <p className="text-sm leading-relaxed text-tinta-tenue">
          Psicología sólo la usan la psicóloga del destacamento y, para ver estadísticas sin nombres,
          el jefe de la S-4 y el Comandante. Su cuenta sigue funcionando en la consulta médica y en la
          clínica odontológica.
        </p>
        {motivo && <Alerta tono="aviso">{motivo}</Alerta>}
        <Boton variante="secundario" onClick={salir}>Cerrar sesión</Boton>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Limite>
      <TemaProvider>
        <AvisosProvider>
          <AuthProvider>
            <BrowserRouter>
              <Rutas />
            </BrowserRouter>
          </AuthProvider>
        </AvisosProvider>
      </TemaProvider>
    </Limite>
  )
}
