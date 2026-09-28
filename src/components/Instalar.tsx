import { useState } from 'react'
import { Hoja, Pastilla, TarjetaVidrio } from './Vidrio'
import { useInstalacion, useInvitacionInstalacion } from '../lib/pwa'
import { esIOS } from '../lib/plataforma'

/* ============================================================================
   INSTALAR EN EL IPHONE
   ----------------------------------------------------------------------------
   En Android el navegador ofrece un diálogo y basta con pulsarlo. En iPhone no
   hay diálogo ni lo habrá: la instalación es Compartir → Añadir a pantalla de
   inicio, tres toques que casi nadie encuentra si no se le enseñan.
   Esta hoja los enseña, con el icono que se ve en la barra de Safari y no con
   la palabra «compartir», que en la barra no está escrita en ninguna parte.

   La invitación se ofrece UNA VEZ. Quien dice que no, no vuelve a verla: la
   pantalla de Perfil guarda el enlace para cuando cambie de idea.
   ========================================================================== */

/* Los dos iconos de la barra de Safari, dibujados para que se reconozcan a la
   primera: el cuadrado con la flecha que sale, y el cuadrado con el más. */
const IcoCompartir = (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M10 2.5v9M10 2.5L7 5.5M10 2.5l3 3" strokeLinecap="round" />
    <path d="M5.5 8.5h-1v9h11v-9h-1" strokeLinecap="round" />
  </svg>
)

const IcoAnadir = (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <rect x="3" y="3" width="14" height="14" rx="3.5" />
    <path d="M10 6.5v7M6.5 10h7" strokeLinecap="round" />
  </svg>
)

/** La hoja completa. Se usa desde el aviso automático y desde Perfil. */
export function HojaInstalacion({ onCerrar }: { onCerrar: () => void }) {
  const { via, instalar } = useInstalacion()
  const [instalando, setInstalando] = useState(false)

  return (
    <Hoja
      titulo="Instalar en el teléfono"
      detalle="La clínica en la pantalla de inicio, a pantalla completa"
      onCerrar={onCerrar}
    >
      <div className="space-y-4 pt-2">
        <TarjetaVidrio className="p-4">
          <p className="text-[15px] leading-relaxed text-tinta-suave">
            Instalada, la aplicación abre sin la barra del navegador, arranca aunque la
            cobertura falle y es la única forma de que el teléfono pueda avisar de los
            citas y recalls de los pacientes.
          </p>
        </TarjetaVidrio>

        {via === 'nativa' ? (
          <Pastilla
            tono="llena"
            className="w-full"
            disabled={instalando}
            onClick={async () => {
              setInstalando(true)
              const ok = await instalar()
              setInstalando(false)
              if (ok) onCerrar()
            }}
          >
            {instalando ? 'Instalando…' : 'Instalar ahora'}
          </Pastilla>
        ) : (
          <ol className="space-y-2">
            <Paso n={1} icono={esIOS() ? IcoCompartir : undefined}>
              Abra el menú <strong className="font-semibold text-tinta">Compartir</strong> en la barra
              de Safari. Es el cuadrado con la flecha hacia arriba, abajo en el centro.
            </Paso>
            <Paso n={2} icono={IcoAnadir}>
              Deslice la lista y toque{' '}
              <strong className="font-semibold text-tinta">Añadir a pantalla de inicio</strong>.
            </Paso>
            <Paso n={3}>
              Confirme con <strong className="font-semibold text-tinta">Añadir</strong>. El escudo de
              la unidad queda en la pantalla de inicio como cualquier otra aplicación.
            </Paso>
          </ol>
        )}

        {via !== 'nativa' && esIOS() && (
          <p className="text-[13px] leading-relaxed text-tinta-tenue">
            Tiene que hacerse desde <strong className="text-tinta-suave">Safari</strong>: Chrome y
            Firefox en iPhone no pueden añadir aplicaciones a la pantalla de inicio.
          </p>
        )}

        <Pastilla tono="vidrio" className="w-full" onClick={onCerrar}>
          Ahora no
        </Pastilla>
      </div>
    </Hoja>
  )
}

function Paso({ n, icono, children }: { n: number; icono?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-tarjeta bg-superficie p-3.5">
      <span className="cifras flex h-7 w-7 shrink-0 items-center justify-center rounded-pastilla bg-marca text-[12px] font-semibold text-fondo">
        {n}
      </span>
      <span className="flex-1 text-[14px] leading-relaxed text-tinta-suave">{children}</span>
      {icono && <span className="shrink-0 pt-0.5 text-marca">{icono}</span>}
    </li>
  )
}

/** El aviso que se ofrece solo, una vez. */
export default function AvisoInstalacion() {
  const [abierta, cerrar] = useInvitacionInstalacion()
  if (!abierta) return null
  return <HojaInstalacion onCerrar={cerrar} />
}
