import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Alerta, Boton, Campo, Input } from '../components/ui'
import { Logotipo } from '../components/Marca'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  /**
   * Un mensaje que sirva para actuar. Cuando el proyecto de la nube está
   * pausado o la red no llega, no hay contraseña que funcione, y quien está
   * delante necesita saber que el problema no es su contraseña.
   */
  function motivo(e: { message: string }): string {
    const m = e.message ?? ''
    if (/fetch|network|load failed|timeout|ECONNREFUSED/i.test(m)) {
      return 'No hay respuesta del servidor. Suele ser que el proyecto de Supabase esté pausado (se reactiva desde su panel) o que no haya conexión.'
    }
    if (/Invalid login|invalid_credentials/i.test(m)) return 'Correo o contraseña incorrectos.'
    if (/Email not confirmed/i.test(m)) return 'La cuenta existe pero no está confirmada. Avise a la administración.'
    if (/rate|too many/i.test(m)) return 'Demasiados intentos seguidos. Espere un minuto y vuelva a probar.'
    return m || 'No se pudo entrar.'
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    if (error) setError(motivo(error))
    setEnviando(false)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------------------------------------- panel editorial ---- */}
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-borde bg-portada px-6 py-10 text-portada-tinta sm:px-10 lg:border-r lg:border-b-0 lg:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {['left-5 top-5', 'right-5 top-5', 'left-5 bottom-5', 'right-5 bottom-5'].map((pos) => (
          <svg key={pos} aria-hidden viewBox="0 0 24 24" className={`pointer-events-none absolute ${pos} h-4 w-4 opacity-40`}
            fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M12 0v9M12 15v9M0 12h9M15 12h9" />
            <circle cx="12" cy="12" r="4.5" />
          </svg>
        ))}

        <div className="relative flex items-center gap-3">
          <Logotipo px={88} />
          <div className="rotulo leading-relaxed opacity-80">
            Fuerza Armada de El Salvador
            <br />
            Destacamento Militar N° 1
          </div>
        </div>

        <div className="relative my-12 lg:my-0">
          <div className="cifras rotulo mb-4 opacity-70">Sistema 03 / Psicología</div>
          <h1 className="titular titular-mayor">
            Psicología
            <br />
            clínica
          </h1>
          <div className="mt-6 w-28 border-t-2 border-b border-portada-filete pb-1" />
          <p className="mt-6 max-w-sm text-sm leading-relaxed opacity-80">
            Baterías de evaluación configurables, aplicación por enlace, calificación automática,
            seguimiento de cada efectivo y estadística anónima para el mando.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-px border border-portada-caja bg-portada-caja">
          {[
            ['4', 'Instrumentos'],
            ['116', 'Áreas en 3D'],
            ['0', 'Nombres al mando'],
          ].map(([n, t]) => (
            <div key={t} className="bg-portada px-3 py-4">
              <dd className="cifras text-2xl leading-none font-semibold tabular-nums">{n}</dd>
              <dt className="rotulo mt-2 text-[9px] opacity-70">{t}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------- formulario ---- */}
      <Columna>
        <div className="w-full max-w-sm">
          <div className="cifras rotulo mb-2 text-marca">Acceso</div>
          <h2 className="titular mb-2 text-2xl text-tinta">Identifíquese</h2>
          <p className="mb-8 text-sm text-tinta-tenue">
            Información psicológica reservada. El acceso queda registrado.
          </p>

          <form onSubmit={entrar} className="space-y-5">
            <Campo etiqueta="Correo institucional">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="username" required placeholder="usuario@dm1.sv" />
            </Campo>
            <Campo etiqueta="Contraseña">
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password" required />
            </Campo>

            {error && <Alerta>{error}</Alerta>}

            <Boton type="submit" disabled={enviando} aria-busy={enviando} className="w-full">
              {enviando ? 'Verificando…' : 'Ingresar'}
            </Boton>
          </form>

          <p className="mt-10 border-t border-borde pt-4 text-[11px] leading-relaxed text-tinta-tenue">
            Es la misma cuenta de la consulta médica y la clínica odontológica. Si no recuerda su
            contraseña, solicítela a la administración médica del destacamento.
            <br />
            ¿Le enviaron un enlace de evaluación? Ábralo directamente: no necesita cuenta.
          </p>
        </div>
      </Columna>
    </div>
  )
}

function Columna({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col bg-fondo px-6 py-6 sm:px-10 lg:py-10">
      <div className="folio flex items-center justify-between gap-3 border-b border-borde pb-3">
        <span>Psicología · expediente reservado</span>
        <span>Acceso restringido</span>
      </div>
      <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      <div className="folio flex items-center justify-between gap-3 border-t border-borde pt-3">
        <span>v{__VERSION_APP__}</span>
        <span>Acceso web</span>
      </div>
    </section>
  )
}
