import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Preferencia = 'claro' | 'oscuro' | 'sistema'
export type TemaResuelto = 'claro' | 'oscuro'

interface Ctx {
  preferencia: Preferencia
  tema: TemaResuelto
  setPreferencia: (p: Preferencia) => void
}

const CtxTema = createContext<Ctx>({ preferencia: 'sistema', tema: 'oscuro', setPreferencia: () => {} })

const CLAVE = 'dm1-tema'

function delSistema(): TemaResuelto {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro'
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPref] = useState<Preferencia>(
    () => (localStorage.getItem(CLAVE) as Preferencia | null) ?? 'sistema',
  )
  const [tema, setTema] = useState<TemaResuelto>(() =>
    preferencia === 'sistema' ? delSistema() : preferencia,
  )

  useEffect(() => {
    const aplicar = () => setTema(preferencia === 'sistema' ? delSistema() : preferencia)
    aplicar()
    if (preferencia !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [preferencia])

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark'
  }, [tema])

  function setPreferencia(p: Preferencia) {
    localStorage.setItem(CLAVE, p)
    setPref(p)
  }

  return <CtxTema.Provider value={{ preferencia, tema, setPreferencia }}>{children}</CtxTema.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema() {
  return useContext(CtxTema)
}

/** Paleta para las gráficas, que Recharts necesita como valores literales. */
// eslint-disable-next-line react-refresh/only-export-components
export function useColoresGrafico() {
  const { tema } = useTema()
  return tema === 'claro'
    ? {
        rejilla: '#dcdcd8',
        eje: '#6f6f69',
        marca: '#1f5c3d',
        marcaSuave: '#9dbfae',
        alerta: '#c3281c',
        aviso: '#a86b00',
        neutro: '#c9c9c4',
        panel: '#ffffff',
        borde: '#d8d8d4',
        tinta: '#111111',
      }
    : {
        rejilla: '#2a2f2c',
        eje: '#7b7f79',
        marca: '#58a97c',
        marcaSuave: '#2f5c45',
        alerta: '#ef6a5c',
        aviso: '#e0a53a',
        neutro: '#3a403c',
        panel: '#141715',
        borde: '#2a2f2c',
        tinta: '#e8e8e3',
      }
}
