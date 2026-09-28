import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Retrato, VisorRetrato } from './Retrato'
import { useTema, type Preferencia } from '../lib/tema'
import { EN_ESCRITORIO } from '../lib/escritorio/puente'
import { Logotipo } from './Marca'
import Paleta from './Paleta'
import { FilaMenu, Hoja, Menu, Segmentado, SeparadorMenu } from './Vidrio'
import AvisoInstalacion from './Instalar'
import { aplicarVersionNueva, useVersionNueva } from '../lib/pwa'
import { NOMBRES_ROL } from '../lib/formato'

/* ============================================================================
   EL ARMAZÓN
   ----------------------------------------------------------------------------
   Dos formas del mismo sistema, no dos diseños:

     · En el teléfono manda el pulgar. Barra de pestañas FLOTANTE de vidrio con
       los cuatro destinos de la jornada y una hoja para el resto; el contenido
       pasa por DEBAJO de ella y de la cabecera, que es lo que da la sensación
       de profundidad. El título grande se encoge hasta el renglón de la barra
       al desplazarse, como en cualquier aplicación del sistema.
     · En el escritorio manda la vista de conjunto: una barra lateral que FLOTA
       separada del borde, de vidrio líquido, con las secciones agrupadas por
       lo que se hace con ellas y una lente que se desliza hasta la activa.

   La cuenta —perfil, usuarios, tema, cerrar sesión— ya no ocupa renglones de
   navegación: vive en un menú que nace de la ficha del usuario, como en
   cualquier programa del sistema. Lo que no cambia entre las dos formas: la
   paleta de mando (⌘K), el tema, la sesión y el pie de imprenta.
   ========================================================================== */

/* Iconos funcionales, trazados sobre una retícula de 16 px. Sin emojis. */
const Ico = {
  tablero: <path d="M2 2h5v5H2zM9 2h5v3H9zM9 7h5v7H9zM2 9h5v5H2z" />,
  evaluados: <><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13.5c0-2.3 1.9-3.7 4.2-3.7s4.2 1.4 4.2 3.7" /><path d="M10.5 3.5a2.2 2.2 0 010 4.2M12 9.9c1.3.4 2.2 1.6 2.2 3.6" /></>,
  aplicaciones: <><path d="M3.5 1.5h6l3 3v10h-9z" /><path d="M9.5 1.5v3h3M5.5 8.5l1.5 1.5 3-3M5.5 12.5h5" /></>,
  convocatorias: <><path d="M6.5 9.5l3-3" /><path d="M7.5 4.5l1.3-1.3a2.5 2.5 0 013.5 3.5L11 8M8.5 11.5l-1.3 1.3a2.5 2.5 0 01-3.5-3.5L5 8" /></>,
  baterias: <><rect x="2" y="2.5" width="12" height="3" /><rect x="2" y="6.5" width="12" height="3" /><rect x="2" y="10.5" width="12" height="3" /></>,
  instrumentos: <><path d="M3 2.5h10v11H3z" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" /></>,
  // Un cerebro esquemático: los dos hemisferios y la cisura.
  problemas: <><path d="M8 3c-1-1.2-3.4-1-4 .6-1.6.2-2.3 2.2-1.3 3.4-.9 1.3-.2 3.2 1.4 3.3.3 1.6 2.4 2.3 3.9 1.2V3z" /><path d="M8 3c1-1.2 3.4-1 4 .6 1.6.2 2.3 2.2 1.3 3.4.9 1.3.2 3.2-1.4 3.3-.3 1.6-2.4 2.3-3.9 1.2" /><path d="M8 11.5v2.5" /></>,
  estadisticas: <path d="M2.5 13.5V6M6.5 13.5V2.5M10.5 13.5V8.5M14 13.5h-13" />,
  perfil: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" /></>,
  mas: <><circle cx="3" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="13" cy="8" r="1.3" /></>,
}

const IcoTema = {
  claro: <><circle cx="8" cy="8" r="3.2" /><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" /></>,
  oscuro: <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.6 5.6 0 106.8 6.8z" />,
  sistema: <><rect x="1.5" y="2.5" width="13" height="9" /><path d="M5.5 13.5h5" /></>,
}

interface Destino {
  a: string
  t: string
  corto: string
  i: ReactNode
  grupo?: string
}

/*
 * Las secciones, agrupadas por lo que se hace con ellas:
 *
 *   Consulta     el día de la psicóloga: tablero, evaluados, aplicaciones.
 *   Evaluación   preparar y repartir: convocatorias por cohorte, baterías,
 *                instrumentos y el catálogo de problemas con sus áreas.
 *   Mando        la estadística sin nombres, la única sección que ven la
 *                S-4 y el Comandante.
 */
const enlacesPsicologia: Destino[] = [
  { a: '/', t: 'Tablero', corto: 'Tablero', i: Ico.tablero, grupo: 'Consulta' },
  { a: '/evaluados', t: 'Evaluados', corto: 'Evaluados', i: Ico.evaluados },
  { a: '/aplicaciones', t: 'Aplicaciones', corto: 'Aplic.', i: Ico.aplicaciones },
  { a: '/convocatorias', t: 'Convocatorias y enlaces', corto: 'Enlaces', i: Ico.convocatorias, grupo: 'Evaluación' },
  { a: '/baterias', t: 'Baterías', corto: 'Baterías', i: Ico.baterias },
  { a: '/instrumentos', t: 'Instrumentos', corto: 'Instrum.', i: Ico.instrumentos },
  { a: '/problemas', t: 'Problemas y áreas', corto: 'Áreas', i: Ico.problemas },
  { a: '/estadisticas', t: 'Estadísticas', corto: 'Estad.', i: Ico.estadisticas, grupo: 'Mando' },
]

const enlacesMando: Destino[] = [
  { a: '/estadisticas', t: 'Estadísticas', corto: 'Estad.', i: Ico.estadisticas, grupo: 'Mando' },
]

const enlacesCuenta: Destino[] = [
  { a: '/perfil', t: 'Perfil', corto: 'Perfil', i: Ico.perfil, grupo: 'Cuenta' },
]

/** Las secciones que ve cada rol. La S-4 y el Comandante, sólo estadística. */
function useEnlaces() {
  const { esPsicologo } = useAuth()
  const enlaces = esPsicologo ? enlacesPsicologia : enlacesMando
  const pestanas = esPsicologo ? ['/', '/evaluados', '/aplicaciones', '/convocatorias'] : ['/estadisticas', '/perfil']
  return { enlaces, todos: [...enlaces, ...enlacesCuenta], pestanas }
}

const nombresRol = NOMBRES_ROL

/** El título que va en la cabecera compacta del teléfono. */
function tituloDe(pathname: string, todos: Destino[]): string {
  if (pathname.startsWith('/evaluados/')) return 'Ficha psicológica'
  const d = todos.find((e) => (e.a === '/' ? pathname === '/' : pathname.startsWith(e.a)))
  return d?.t ?? 'Psicología'
}

export default function Layout() {
  const { perfil, salir } = useAuth()
  const { enlaces, todos, pestanas: PESTANAS } = useEnlaces()
  const { pathname } = useLocation()
  const [paleta, setPaleta] = useState(false)
  const [mas, setMas] = useState(false)

  // Al cambiar de sección, el documento vuelve arriba: de otro modo se entra
  // a una vista nueva por la mitad, con el listado anterior aún desplazado.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    setMas(false)
  }, [pathname])

  // Ctrl+K (⌘K en Mac) abre la paleta desde cualquier pantalla, incluso con el
  // foco dentro de un campo: es el atajo que ya esperan quienes usan cualquier
  // programa moderno, y el único modo razonable de recorrer 571 expedientes.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaleta((v) => !v)
      }
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [])

  const cerrarPaleta = useCallback(() => setPaleta(false), [])
  const desplazado = useDesplazado()

  // La lente de la barra lateral y la de la barra de pestañas se miden sobre
  // el destino activo. Cuando la sección no está en la barra de pestañas, la
  // lente se posa en «Más», que es donde está.
  const lateral = useRef<HTMLElement>(null)
  const pestanas = useRef<HTMLDivElement>(null)
  const lenteLateral = useLente(lateral, pathname)
  const lentePestanas = useLente(pestanas, pathname)
  const enPestana = PESTANAS.some((r) => (r === '/' ? pathname === '/' : pathname.startsWith(r)))

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#principal" className="salto">Ir al contenido</a>

      <Paleta abierta={paleta} onCerrar={cerrarPaleta} />

      {/* ------------------------------------------------ barra lateral ----
          Flota separada del borde, como la de iPadOS: el documento corre por
          detrás y el vidrio lo deja ver. Va en un contenedor pegajoso de alto
          fijo y la lista es lo único que se desplaza; la marca arriba y la
          cuenta abajo no se mueven. */}
      <div className="hidden w-[17rem] shrink-0 p-3 pr-0 lg:sticky lg:top-0 lg:block lg:h-screen print:hidden">
        <aside className="liquido flex h-full flex-col rounded-hoja">
          <Marca />

          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => setPaleta(true)}
              className="pulsable fila-liquida flex min-h-10 w-full items-center gap-2.5 rounded-pastilla bg-superficie-alta/60 px-3.5 text-left text-[13px] text-tinta-tenue hover:text-tinta"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <span className="flex-1">Buscar</span>
              <kbd className="tecla rounded-[5px]">⌘K</kbd>
            </button>
          </div>

          <nav
            ref={lateral}
            aria-label="Secciones"
            className="lente-viva relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
          >
            {lenteLateral && (
              <span
                aria-hidden
                className="lente lente-movil pointer-events-none absolute left-3 right-3 top-0 rounded-control"
                style={{ transform: `translateY(${lenteLateral.y}px)`, height: lenteLateral.h }}
              />
            )}
            {agrupar(enlaces).map(([grupo, destinos]) => (
              <div key={grupo ?? 'principal'} role="group" aria-label={grupo ?? undefined}>
                {grupo && (
                  <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.02em] text-tinta-tenue">
                    {grupo}
                  </div>
                )}
                {destinos.map((e) => (
                  <NavLink
                    key={e.a}
                    to={e.a}
                    end={e.a === '/'}
                    className={({ isActive }) =>
                      `pulsable relative z-[1] mb-px flex min-h-10 items-center gap-3 rounded-control px-3 text-[14px] transition-colors ${
                        isActive ? 'font-semibold text-tinta' : 'fila-liquida text-tinta-suave hover:text-tinta'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <svg
                          viewBox="0 0 16 16"
                          className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? 'text-marca' : 'text-tinta-tenue'}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden
                        >
                          {e.i}
                        </svg>
                        <span className="flex-1 truncate">{e.t}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="p-2 pt-0">
            <div className="mx-2 mb-2 h-px bg-borde/70" />
            <MenuCuenta perfil={perfil} salir={salir} lado="arriba" />
            {/* Pie de imprenta: qué programa, qué versión y sobre qué datos está
                trabajando. En un destacamento con equipos instalados en fechas
                distintas, saberlo de un vistazo evita diagnosticar a ciegas. */}
            <div className="folio flex items-center justify-between gap-2 px-3 pt-2 pb-1">
              <span>v{__VERSION_APP__}</span>
              <span>{EN_ESCRITORIO ? 'Local · sin red' : 'Web · nube'}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ------------------------------------------- cabecera del móvil ----
            Flota sobre el contenido. Al desplazarse aparece el material y el
            título de la sección: en lo alto de la página la barra es invisible
            y el título grande es el de la propia pantalla. */}
        <header
          /* Al desplazarse, la barra se materializa. Va con el material
             GRUESO y no con el regular: es la única lámina que tiene texto
             corriendo justo por debajo, y con el regular se leían las dos
             cosas a la vez. */
          className={`sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 lg:hidden print:hidden ${
            desplazado ? 'vidrio-grueso orilla-superior' : ''
          }`}
          style={{ paddingTop: 'var(--seguro-arriba)' }}
        >
          <div className="flex min-h-12 items-center justify-between gap-3 px-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logotipo px={28} />
              <span
                className={`truncate text-[17px] font-semibold tracking-[-0.01em] text-tinta transition-[opacity,transform] duration-300 ${
                  desplazado ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                }`}
              >
                {tituloDe(pathname, todos)}
              </span>
            </div>
            {/* Las acciones de la barra van juntas en una sola cápsula de
                vidrio, como los botones de una barra de iOS: dos círculos
                sueltos se leían como dos adornos. */}
            <div className="liquido flex items-center rounded-pastilla p-0.5">
              <BotonBarra etiqueta="Buscar un efectivo o una sección" onPulsar={() => setPaleta(true)}>
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </BotonBarra>
              <MenuCuenta perfil={perfil} salir={salir} compacto />
            </div>
          </div>
        </header>

        <main
          id="principal"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-2 outline-none sm:px-8 lg:pt-6 lg:pb-10"
          style={{ paddingBottom: 'calc(var(--alto-pestanas) + 1.5rem)' }}
        >
          <Outlet />
        </main>
      </div>

      {/* ------------------------------------- barra de pestañas flotante ----
          La lente se DESLIZA de un destino al otro; no se apaga en uno y se
          enciende en el siguiente. Así se ve de dónde viene el foco. */}
      <nav
        aria-label="Secciones"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 lg:hidden print:hidden"
        style={{ paddingBottom: 'max(0.5rem, var(--seguro-abajo))' }}
      >
        <div
          ref={pestanas}
          className="liquido pestanas lente-viva pointer-events-auto relative flex w-full max-w-md items-stretch gap-0.5 p-1"
        >
          {lentePestanas && (
            <span
              aria-hidden
              className="lente lente-movil pointer-events-none absolute top-1 bottom-1 left-0 rounded-pastilla"
              style={{ transform: `translateX(${lentePestanas.x}px)`, width: lentePestanas.w }}
            />
          )}
          {PESTANAS.map((ruta) => {
            const d = todos.find((e) => e.a === ruta)!
            return (
              <NavLink
                key={d.a}
                to={d.a}
                end={d.a === '/'}
                className={({ isActive }) =>
                  `pulsable relative z-[1] flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-pastilla transition-colors duration-200 ${
                    isActive ? 'text-marca' : 'text-tinta-suave'
                  }`
                }
              >
                <svg viewBox="0 0 16 16" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  {d.i}
                </svg>
                <span className="text-[10px] leading-none font-semibold tracking-[0.01em]">{d.corto}</span>
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => setMas(true)}
            aria-label="Más secciones"
            data-lente={enPestana ? undefined : 'si'}
            className={`pulsable relative z-[1] flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-pastilla transition-colors duration-200 ${
              enPestana ? 'text-tinta-suave' : 'text-marca'
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden>
              {Ico.mas}
            </svg>
            <span className="text-[10px] leading-none font-semibold tracking-[0.01em]">Más</span>
          </button>
        </div>
      </nav>

      {mas && <HojaSecciones onCerrar={() => setMas(false)} />}

      <AvisoVersion />

      {/* La invitación a instalar: una vez, y sólo donde se puede instalar. */}
      <AvisoInstalacion />
    </div>
  )
}

/* --------------------------------------------------------------- lente --- */

/**
 * Dónde está el destino activo dentro de un contenedor, para posar ahí la
 * lente. Se mide antes de pintar (sin un fotograma con la lente en el sitio
 * viejo) y otra vez si el contenedor cambia de tamaño: al girar el teléfono o
 * al abrirse la barra de desplazamiento de la lateral.
 */
function useLente(contenedor: React.RefObject<HTMLElement | null>, clave: string) {
  const [caja, setCaja] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const c = contenedor.current
    if (!c) return
    const medir = () => {
      const activo = c.querySelector<HTMLElement>('[aria-current="page"], [data-lente="si"]')
      if (!activo || activo.offsetParent === null) {
        setCaja(null)
        return
      }
      const rc = c.getBoundingClientRect()
      const ra = activo.getBoundingClientRect()
      setCaja({
        x: ra.left - rc.left + c.scrollLeft,
        y: ra.top - rc.top + c.scrollTop,
        w: ra.width,
        h: ra.height,
      })
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    return () => ro.disconnect()
  }, [contenedor, clave])

  return caja
}

/**
 * Hay versión nueva descargada. Se ofrece en una pastilla sobre la barra de
 * pestañas —donde cae el pulgar— y no se aplica sola: recargar por debajo de
 * quien está escribiendo una consulta es perder lo escrito.
 */
function AvisoVersion() {
  const hay = useVersionNueva()
  const [oculto, setOculto] = useState(false)
  if (!hay || oculto) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--alto-pestanas)+0.75rem)] z-50 flex justify-center px-4 lg:bottom-6 print:hidden">
      <div className="vidrio-grueso vidrio-flotante material-entra flex items-center gap-3 rounded-pastilla py-2 pr-2 pl-4">
        <span className="text-[13px] font-medium text-tinta">Hay una versión nueva</span>
        <button
          type="button"
          onClick={aplicarVersionNueva}
          className="pulsable min-h-9 rounded-pastilla bg-marca px-3.5 text-[13px] font-semibold text-fondo"
        >
          Actualizar
        </button>
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label="Ahora no"
          className="pulsable flex h-9 w-9 items-center justify-center rounded-pastilla text-tinta-tenue"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- desplazado --- */

/**
 * ¿Se ha bajado de lo alto de la página? Lo lee la cabecera para materializarse.
 * Se mide en el fotograma, no en cada evento de desplazamiento: en un listado
 * de 571 filas, un `setState` por evento es lo que hace que el desplazamiento
 * se note a tirones.
 */
function useDesplazado(umbral = 8): boolean {
  const [si, setSi] = useState(false)
  const pedido = useRef(false)

  useEffect(() => {
    const alDesplazar = () => {
      if (pedido.current) return
      pedido.current = true
      requestAnimationFrame(() => {
        pedido.current = false
        setSi(window.scrollY > umbral)
      })
    }
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [umbral])

  return si
}

function BotonBarra({
  etiqueta, onPulsar, children,
}: {
  etiqueta: string
  onPulsar: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onPulsar}
      aria-label={etiqueta}
      className="pulsable flex h-10 w-10 items-center justify-center rounded-pastilla text-tinta-suave"
    >
      <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/* ------------------------------------------------------- hoja de «Más» --- */

function HojaSecciones({ onCerrar }: { onCerrar: () => void }) {
  const { pathname } = useLocation()
  const { perfil, salir } = useAuth()
  const { todos, pestanas: PESTANAS } = useEnlaces()
  const restantes = todos.filter((e) => !PESTANAS.includes(e.a))

  return (
    <Hoja titulo="Secciones" detalle="Todo lo que no cabe en la barra" onCerrar={onCerrar}>
      <div className="space-y-5 pt-1">
        {/* Los grupos encabezan su tramo, como en la barra lateral. Colgados a
            la derecha del primer destino parecían una etiqueta de ese destino. */}
        {agrupar(restantes).map(([grupo, destinos]) => (
          <div key={grupo ?? 'principal'}>
            {grupo && <div className="mb-1.5 px-4 text-[13px] font-medium text-tinta-tenue">{grupo}</div>}
            <div className="lista-agrupada overflow-hidden rounded-tarjeta bg-superficie">
              {destinos.map((e) => {
                const activo = e.a === '/' ? pathname === '/' : pathname.startsWith(e.a)
                return (
                  <NavLink
                    key={e.a}
                    to={e.a}
                    onClick={onCerrar}
                    className="pulsable fila-liquida flex min-h-12 items-center gap-3 px-4"
                  >
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${
                        activo ? 'bg-marca text-fondo' : 'bg-superficie-alta text-tinta-suave'
                      }`}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                        {e.i}
                      </svg>
                    </span>
                    <span className={`flex-1 text-[16px] text-tinta ${activo ? 'font-semibold' : ''}`}>
                      {e.t}
                    </span>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-tinta-tenue" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}

        <TemaSegmentado />

        <div className="lista-agrupada overflow-hidden rounded-tarjeta bg-superficie">
          <div className="flex items-center gap-3 px-4 py-3">
            <Retrato nombre={perfil?.nombre_completo} foto={perfil?.foto} px={40} className="overflow-hidden rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium text-tinta">
                {perfil?.nombre_completo ?? '—'}
              </div>
              <div className="truncate text-[13px] text-tinta-tenue">
                {perfil?.rol ? nombresRol[perfil.rol] : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={salir}
            className="pulsable fila-liquida flex min-h-12 w-full items-center justify-center text-[16px] font-medium text-alerta"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="folio flex items-center justify-between gap-2 px-4">
          <span>v{__VERSION_APP__}</span>
          <span>{EN_ESCRITORIO ? 'Local · sin red' : 'Web · nube'}</span>
        </div>
      </div>
    </Hoja>
  )
}

/** Parte la lista en tramos, cada uno con el rótulo de grupo que lo abre. */
function agrupar(destinos: Destino[]): [string | null, Destino[]][] {
  const tramos: [string | null, Destino[]][] = []
  for (const d of destinos) {
    if (d.grupo || tramos.length === 0) tramos.push([d.grupo ?? null, []])
    tramos[tramos.length - 1][1].push(d)
  }
  return tramos
}

function Marca() {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <Logotipo px={44} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-tinta">Psicología</div>
        <div className="truncate text-[12px] text-tinta-tenue">Sanidad · DM-1</div>
      </div>
    </div>
  )
}

const opcionesTema: { v: Preferencia; t: string; i: ReactNode }[] = [
  { v: 'claro', t: 'Claro', i: IcoTema.claro },
  { v: 'oscuro', t: 'Oscuro', i: IcoTema.oscuro },
  { v: 'sistema', t: 'Automático', i: IcoTema.sistema },
]

/** El tema, en la hoja del teléfono: un segmentado como el del sistema. */
function TemaSegmentado() {
  const { preferencia, setPreferencia } = useTema()
  return (
    <div>
      <div className="mb-1.5 px-4 text-[13px] font-medium text-tinta-tenue">Apariencia</div>
      <Segmentado
        etiqueta="Tema de la interfaz"
        valor={preferencia}
        onCambiar={setPreferencia}
        opciones={opcionesTema.map((o) => ({ v: o.v, t: o.t }))}
      />
    </div>
  )
}

/**
 * La cuenta en un solo sitio: la ficha del usuario abre un menú con el perfil,
 * la administración de cuentas, la apariencia y la salida. En la barra lateral
 * es la ficha entera y el menú sube; en la cabecera del teléfono es el retrato
 * y el menú baja.
 *
 * Cerrar sesión está dos toques más allá —abrir el menú y elegirlo—, que es lo
 * que antes resolvía la segunda pulsación de confirmación: salir por accidente
 * en medio de una consulta, con guantes, cuesta volver a entrar.
 */
function MenuCuenta({
  perfil, salir, lado = 'abajo', compacto,
}: {
  perfil: { nombre_completo?: string; rol?: string; foto?: string | null } | null | undefined
  salir: () => void
  lado?: 'abajo' | 'arriba'
  compacto?: boolean
}) {
  const navegar = useNavigate()
  const { preferencia, setPreferencia } = useTema()
  const [viendoRetrato, setViendoRetrato] = useState(false)
  const nombre = perfil?.nombre_completo
  const rol = perfil?.rol ? nombresRol[perfil.rol] : ''

  return (
    <>
      <Menu
        etiqueta={compacto ? `Cuenta de ${nombre ?? 'usuario'}` : 'Cuenta y ajustes'}
        lado={lado}
        alinear={compacto ? 'fin' : 'inicio'}
        ancho={compacto ? 'w-64' : 'boton'}
        claseBoton={
          compacto
            ? 'flex h-10 w-10 items-center justify-center rounded-pastilla'
            : 'fila-liquida flex w-full items-center gap-2.5 rounded-control p-2 text-left'
        }
        boton={(abierto) =>
          compacto ? (
            <Retrato nombre={nombre} foto={perfil?.foto} px={30} className="pointer-events-none overflow-hidden rounded-full" />
          ) : (
            <>
              <Retrato nombre={nombre} foto={perfil?.foto} px={34} className="pointer-events-none overflow-hidden rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-tinta">{nombre ?? '—'}</span>
                <span className="block truncate text-[12px] text-tinta-tenue">{rol}</span>
              </span>
              <svg
                viewBox="0 0 16 16"
                className={`h-3.5 w-3.5 shrink-0 text-tinta-tenue transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M4.5 10l3.5-3.5 3.5 3.5" />
              </svg>
            </>
          )
        }
      >
        {(cerrar) => (
          <>
            {/* En el teléfono el botón es sólo el retrato: el menú dice de
                quién es la sesión antes que nada. */}
            {compacto && (
              <>
                <div className="px-3 pt-2 pb-2">
                  <div className="truncate text-[14px] font-semibold text-tinta">{nombre ?? '—'}</div>
                  <div className="truncate text-[12px] text-tinta-tenue">{rol}</div>
                </div>
                <SeparadorMenu />
              </>
            )}
            {enlacesCuenta.map((e) => (
              <FilaMenu
                key={e.a}
                icono={e.i}
                onPulsar={() => {
                  cerrar()
                  navegar(e.a)
                }}
              >
                {e.t}
              </FilaMenu>
            ))}
            <FilaMenu
              icono={<><circle cx="8" cy="6" r="2.6" /><path d="M2.5 13.5c.8-2.4 2.9-3.6 5.5-3.6s4.7 1.2 5.5 3.6" /></>}
              onPulsar={() => {
                cerrar()
                setViendoRetrato(true)
              }}
            >
              Ver retrato
            </FilaMenu>
            <SeparadorMenu />
            <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-tinta-tenue">Apariencia</div>
            {opcionesTema.map((o) => (
              <FilaMenu
                key={o.v}
                icono={o.i}
                marcada={preferencia === o.v}
                onPulsar={() => setPreferencia(o.v)}
              >
                {o.t}
              </FilaMenu>
            ))}
            <SeparadorMenu />
            <FilaMenu
              peligro
              icono={<><path d="M6 2.5H3.5v11H6" /><path d="M10 5l3 3-3 3M13 8H6.5" /></>}
              onPulsar={() => {
                cerrar()
                salir()
              }}
            >
              Cerrar sesión
            </FilaMenu>
          </>
        )}
      </Menu>

      {viendoRetrato && (
        <VisorRetrato
          nombre={nombre}
          foto={perfil?.foto}
          detalle={rol || null}
          onCerrar={() => setViendoRetrato(false)}
        />
      )}
    </>
  )
}
