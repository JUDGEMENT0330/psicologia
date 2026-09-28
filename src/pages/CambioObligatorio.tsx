// ============================================================================
// CAMBIO DE CONTRASEÑA OBLIGATORIO
// ----------------------------------------------------------------------------
// Se interpone entre el ingreso y el sistema cuando la contraseña es
// provisional: la que se entrega en persona al crear la cuenta o al
// restablecerla. En psicología no es opcional: la contraseña provisional la
// conoce quien creó la cuenta, y detrás hay resultados con nombre.
// ============================================================================

import { useState, type FormEvent } from 'react'
import { cuentas } from '../lib/cuentas'
import { Alerta, Boton, Campo, Input } from '../components/ui'
import { Logotipo } from '../components/Marca'
import { useAuth } from '../lib/auth'

export default function CambioObligatorio() {
  const { perfil, salir, refrescarPerfil } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (nueva !== repetida) return setError('Las contraseñas no coinciden.')
    if (nueva === actual) return setError('La contraseña nueva debe ser distinta de la provisional.')
    if (nueva.length < 12 || !/[a-z]/.test(nueva) || !/[A-Z]/.test(nueva) || !/\d/.test(nueva)) {
      return setError('Mínimo 12 caracteres, con mayúscula, minúscula y cifra.')
    }
    setGuardando(true)
    setError(null)
    const r = await cuentas.cambiarMiContrasena(actual, nueva)
    setGuardando(false)
    if (r.error) return setError(r.error.message)
    await refrescarPerfil()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logotipo px={64} />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-tinta">Psicología</div>
            <div className="rotulo text-[9px] text-tinta-tenue">Destacamento Militar N° 1</div>
          </div>
        </div>

        <div className="cifras rotulo mb-2 text-marca">Primer ingreso</div>
        <h1 className="titular mb-2 text-2xl text-tinta">Cambie su contraseña</h1>
        <p className="mb-6 text-sm leading-relaxed text-tinta-tenue">
          {perfil?.nombre_completo ? `${perfil.nombre_completo}, la ` : 'La '}
          contraseña con la que acaba de entrar es provisional y la conoce quien creó la cuenta.
          Ponga una propia antes de continuar.
        </p>

        <form onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="Contraseña provisional">
            <Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} required autoComplete="current-password" />
          </Campo>
          <Campo etiqueta="Contraseña nueva" hint="Mínimo 12 caracteres, con mayúscula, minúscula y cifra.">
            <Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} required autoComplete="new-password" />
          </Campo>
          <Campo etiqueta="Repita la contraseña nueva">
            <Input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required autoComplete="new-password" />
          </Campo>
          {error && <Alerta>{error}</Alerta>}
          <Boton type="submit" disabled={guardando} aria-busy={guardando} className="w-full">
            {guardando ? 'Guardando…' : 'Guardar y continuar'}
          </Boton>
        </form>

        <button type="button" onClick={salir}
          className="rotulo mt-8 w-full border-t border-borde pt-4 text-tinta-tenue transition-colors hover:text-tinta">
          Salir sin cambiarla
        </button>
      </div>
    </div>
  )
}
