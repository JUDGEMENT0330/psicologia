import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/* ============================================================================
   AVISOS
   Confirmación breve de lo que el sistema acaba de hacer. En una clínica se
   registra a dos manos y con el paciente en el sillón: el usuario necesita
   saber si el dato quedó guardado sin tener que releer la pantalla.
   Se apilan abajo a la derecha, no bloquean, y se anuncian por aria-live.
   ========================================================================== */

export type TonoAviso = 'exito' | 'error' | 'info'

interface Aviso {
  id: number
  tono: TonoAviso
  texto: string
}

interface Ctx {
  exito: (texto: string) => void
  error: (texto: string) => void
  info: (texto: string) => void
}

const CtxAvisos = createContext<Ctx>({ exito: () => {}, error: () => {}, info: () => {} })

const DURACION: Record<TonoAviso, number> = { exito: 3200, info: 4000, error: 6500 }

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const siguiente = useRef(1)
  const relojes = useRef<number[]>([])

  const cerrar = useCallback((id: number) => {
    setAvisos((l) => l.filter((a) => a.id !== id))
  }, [])

  const emitir = useCallback(
    (tono: TonoAviso, texto: string) => {
      const id = siguiente.current++
      setAvisos((l) => [...l.slice(-3), { id, tono, texto }])
      relojes.current.push(window.setTimeout(() => cerrar(id), DURACION[tono]))
    },
    [cerrar],
  )

  useEffect(() => () => relojes.current.forEach(clearTimeout), [])

  const api = useMemo<Ctx>(
    () => ({
      exito: (t) => emitir('exito', t),
      error: (t) => emitir('error', t),
      info: (t) => emitir('info', t),
    }),
    [emitir],
  )

  return (
    <CtxAvisos.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end print:hidden"
        role="region"
        aria-label="Avisos del sistema"
      >
        <div aria-live="polite" aria-atomic="false" className="contents">
          {avisos.map((a) => (
            <Tarjeta key={a.id} aviso={a} onCerrar={() => cerrar(a.id)} />
          ))}
        </div>
      </div>
    </CtxAvisos.Provider>
  )
}

const estiloTono: Record<TonoAviso, string> = {
  exito: 'border-l-exito',
  error: 'border-l-alerta',
  info: 'border-l-dato',
}

const rotuloTono: Record<TonoAviso, string> = {
  exito: 'Hecho',
  error: 'Error',
  info: 'Aviso',
}

function Tarjeta({ aviso, onCerrar }: { aviso: Aviso; onCerrar: () => void }) {
  return (
    <div
      className={`aviso-entra pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-borde border-l-2 bg-superficie px-3 py-2.5 ${estiloTono[aviso.tono]}`}
    >
      <div className="min-w-0 flex-1">
        <div className="rotulo mb-0.5 text-tinta-tenue">{rotuloTono[aviso.tono]}</div>
        <div className="text-sm leading-snug text-tinta">{aviso.texto}</div>
      </div>
      <button
        onClick={onCerrar}
        aria-label="Descartar aviso"
        className="-mt-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center text-tinta-tenue transition-colors hover:text-tinta"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 2l12 12M14 2L2 14" />
        </svg>
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvisos() {
  return useContext(CtxAvisos)
}
