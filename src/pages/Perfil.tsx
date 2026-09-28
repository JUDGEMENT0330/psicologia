// ============================================================================
// PERFIL — la cuenta, el retrato y la contraseña
// ============================================================================

import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useAvisos } from '../lib/avisos'
import { cuentas } from '../lib/cuentas'
import { NOMBRES_ROL } from '../lib/formato'
import { Alerta, Boton, Campo, Encabezado, Input, Tarjeta, TituloSeccion } from '../components/ui'
import { Retrato, SelectorRetrato, VisorRetrato } from '../components/Retrato'

export default function Perfil() {
  const { perfil, refrescarPerfil, esPsicologo } = useAuth()
  const avisos = useAvisos()
  const [viendo, setViendo] = useState(false)
  const [f, setF] = useState({ actual: '', nueva: '', repetida: '' })
  const [error, setError] = useState<string | null>(null)

  async function cambiar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (f.nueva !== f.repetida) return setError('Las contraseñas no coinciden.')
    if (f.nueva.length < 12 || !/[a-z]/.test(f.nueva) || !/[A-Z]/.test(f.nueva) || !/\d/.test(f.nueva)) {
      return setError('Mínimo 12 caracteres, con mayúscula, minúscula y cifra.')
    }
    const r = await cuentas.cambiarMiContrasena(f.actual, f.nueva)
    if (r.error) return setError(r.error.message)
    setF({ actual: '', nueva: '', repetida: '' })
    avisos.exito('Contraseña cambiada. Vale para medicina general, odontología y psicología.')
  }

  return (
    <div className="space-y-5">
      <Encabezado indice="Perfil" titulo={perfil?.nombre_completo ?? 'Mi perfil'}
        detalle={[perfil?.grado, perfil?.cargo, perfil?.rol ? NOMBRES_ROL[perfil.rol] : null].filter(Boolean).join(' · ')} />
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <Retrato nombre={perfil?.nombre_completo} foto={perfil?.foto} px={88} onPulsar={() => setViendo(true)} />
          <div className="min-w-0 flex-1">
            <div className="rotulo text-tinta-tenue">Mi retrato</div>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-tinta-suave">Se guarda con la cuenta y lo ven los tres sistemas de la Sección de Sanidad.</p>
            <div className="mt-3"><SelectorRetrato tieneFoto={!!perfil?.foto} onGuardado={() => refrescarPerfil()} /></div>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Lo que esta cuenta ve en psicología</TituloSeccion>
        <p className="p-4 text-sm leading-relaxed text-tinta-suave">
          {esPsicologo
            ? 'Todo lo psicológico con nombre y apellido: baterías, instrumentos, convocatorias, aplicaciones, resultados y notas. Es la única cuenta con ese acceso; la base de datos lo impone, no sólo la pantalla.'
            : 'Sólo estadísticas agregadas: cuántas evaluaciones, qué problemas y en qué proporción, por sección y por mes. Ninguna cifra identifica a una persona, y la base de datos no le entrega resultados individuales aunque se consulten directamente.'}
        </p>
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Cambiar contraseña</TituloSeccion>
        <form onSubmit={cambiar} className="grid gap-4 p-4 sm:grid-cols-3">
          <Campo etiqueta="Actual"><Input type="password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} autoComplete="current-password" required /></Campo>
          <Campo etiqueta="Nueva"><Input type="password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} autoComplete="new-password" required /></Campo>
          <Campo etiqueta="Repita la nueva"><Input type="password" value={f.repetida} onChange={(e) => setF({ ...f, repetida: e.target.value })} autoComplete="new-password" required /></Campo>
          {error && <div className="sm:col-span-3"><Alerta>{error}</Alerta></div>}
          <div className="sm:col-span-3"><Boton type="submit">Cambiar contraseña</Boton></div>
        </form>
      </Tarjeta>

      {viendo && (
        <VisorRetrato nombre={perfil?.nombre_completo} foto={perfil?.foto} detalle={[perfil?.grado, perfil?.cargo].filter(Boolean).join(' · ') || null}
          onCerrar={() => setViendo(false)} pie={<SelectorRetrato tieneFoto={!!perfil?.foto} compacto onGuardado={() => refrescarPerfil()} />} />
      )}
    </div>
  )
}
