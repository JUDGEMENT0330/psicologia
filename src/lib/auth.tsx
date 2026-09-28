import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil } from './tipos'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  errorPerfil: string | null
  /**
   * La psicóloga: la única que ve resultados con nombre y apellido, configura
   * baterías e instrumentos y prepara los enlaces. Lo impone la base (RLS de
   * las tablas `ps_*`); esta bandera sólo decide qué pantallas se ofrecen.
   */
  esPsicologo: boolean
  /**
   * Quien puede leer las estadísticas anónimas: la psicóloga, el jefe de la
   * S-4 y el Comandante. Los dos últimos sólo ven cifras, nunca nombres.
   */
  veEstadisticas: boolean
  /** Vuelve a leer el perfil. Lo usa quien cambia algo suyo —el retrato— para
      que la barra lateral lo enseñe sin tener que volver a entrar. */
  refrescarPerfil: () => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  perfil: null,
  cargando: true,
  errorPerfil: null,
  esPsicologo: false,
  veEstadisticas: false,
  refrescarPerfil: async () => {},
  salir: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  // Distinguir «no hay perfil» de «no se pudo preguntar» es la diferencia entre
  // un mensaje útil y una pantalla de carga eterna: si el proyecto está pausado
  // o la red se cae, la promesa se rompe y antes nadie la recogía.
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        setPerfil(null)
        setCargando(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let vivo = true
    setCargando(true)
    supabase
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        setPerfil(data as Perfil | null)
        setErrorPerfil(error ? error.message : data ? null : 'Su cuenta existe pero no tiene perfil asignado. Avise a la administración.')
        setCargando(false)
      }, (e: unknown) => {
        if (!vivo) return
        setErrorPerfil(e instanceof Error ? e.message : 'No se pudo leer el perfil.')
        setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [session])

  const rol = perfil?.rol
  const valor: AuthCtx = {
    refrescarPerfil: async () => {
      if (!session) return
      const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
      if (data) setPerfil(data as Perfil)
    },
    session,
    perfil,
    cargando,
    errorPerfil,
    esPsicologo: rol === 'psicologo',
    veEstadisticas: rol === 'psicologo' || rol === 'admin_s4' || rol === 'comandante',
    salir: async () => {
      await supabase.auth.signOut()
    },
  }

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(Ctx)
}
