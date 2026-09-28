// ============================================================================
// PALETA DE MANDO
// ----------------------------------------------------------------------------
// Un padrón de 571 efectivos —y creciendo— no se recorre con el ratón. La
// paleta abre con Ctrl/⌘+K desde cualquier pantalla y lleva en tres pulsaciones
// a la ficha de un efectivo por nombre, grado o número, o a cualquier sección.
//
// Es también la respuesta al problema de escala de la navegación: las secciones
// se añaden a una lista, no a una barra lateral que se queda sin sitio.
//
// El padrón se pide una sola vez al abrir y se conserva mientras dure la
// sesión; el filtrado es local, así que escribir no genera una consulta por
// tecla ni contra Supabase ni contra el SQLite del equipo.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { PacienteBreve } from '../lib/tipos'
import { useAuth } from '../lib/auth'

interface Destino {
  clave: string
  titulo: string
  detalle: string
  rotulo: string
  ruta: string
}

const SECCIONES_PSICOLOGIA: Destino[] = [
  { clave: 's-tablero', titulo: 'Tablero', detalle: 'Alertas, pendientes de revisar y panorama de hallazgos', rotulo: '01', ruta: '/' },
  { clave: 's-evaluados', titulo: 'Evaluados', detalle: 'Padrón con sus evaluaciones y problemas identificados', rotulo: '02', ruta: '/evaluados' },
  { clave: 's-aplicaciones', titulo: 'Aplicaciones', detalle: 'Todas las evaluaciones: pendientes, en curso, completadas', rotulo: '03', ruta: '/aplicaciones' },
  { clave: 's-convocatorias', titulo: 'Convocatorias y enlaces', detalle: 'Enlaces por cohorte y tipo de evaluación, impresión con QR', rotulo: '04', ruta: '/convocatorias' },
  { clave: 's-baterias', titulo: 'Baterías', detalle: 'Qué instrumentos se aplican juntos', rotulo: '05', ruta: '/baterias' },
  { clave: 's-instrumentos', titulo: 'Instrumentos', detalle: 'Ítems, puntos de corte, normas y alertas', rotulo: '06', ruta: '/instrumentos' },
  { clave: 's-problemas', titulo: 'Problemas y áreas cerebrales', detalle: 'Catálogo de problemas y su mapa en el cerebro', rotulo: '07', ruta: '/problemas' },
  { clave: 's-estadisticas', titulo: 'Estadísticas', detalle: 'Cifras sin nombres para el mando', rotulo: '08', ruta: '/estadisticas' },
  { clave: 's-perfil', titulo: 'Perfil', detalle: 'Tu cuenta y tu retrato', rotulo: '09', ruta: '/perfil' },
]

const SECCIONES_MANDO: Destino[] = [
  { clave: 's-estadisticas', titulo: 'Estadísticas', detalle: 'Evaluaciones, problemas identificados y mapa cerebral, sin nombres', rotulo: '01', ruta: '/estadisticas' },
  { clave: 's-perfil', titulo: 'Perfil', detalle: 'Tu cuenta y tu retrato', rotulo: '02', ruta: '/perfil' },
]

const MAX_EFECTIVOS = 8

/** Sin tildes y en minúscula: en el padrón se escribe «Ramirez» y «Ramírez». */
function plano(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function Paleta({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const navegar = useNavigate()
  // La S-4 y el Comandante no buscan personas: la paleta sólo les ofrece secciones.
  const { esPsicologo } = useAuth()
  const SECCIONES = esPsicologo ? SECCIONES_PSICOLOGIA : SECCIONES_MANDO
  const [q, setQ] = useState('')
  const [indice, setIndice] = useState(0)
  const [padron, setPadron] = useState<PacienteBreve[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // El padrón se trae al primer uso de la paleta, no al arrancar la aplicación:
  // quien nunca la abre no paga la consulta.
  useEffect(() => {
    if (!abierta || !esPsicologo || padron || fallo) return
    let vivo = true
    supabase
      .from('pacientes')
      .select('id, codigo, grado, nombre_completo, ubicacion, estado')
      .then(({ data, error }) => {
        if (!vivo) return
        if (error || !data) return setFallo(true)
        setPadron(data as PacienteBreve[])
      })
    return () => {
      vivo = false
    }
  }, [abierta, esPsicologo, padron, fallo])

  useEffect(() => {
    if (!abierta) return
    setQ('')
    setIndice(0)
    const previo = document.activeElement as HTMLElement | null
    const t = setTimeout(() => campo.current?.focus(), 0)
    return () => {
      clearTimeout(t)
      previo?.focus?.()
    }
  }, [abierta])

  const resultados = useMemo(() => {
    const t = plano(q.trim())
    const secciones = t
      ? SECCIONES.filter((s) => plano(`${s.titulo} ${s.detalle}`).includes(t))
      : SECCIONES

    if (!t) return { secciones, efectivos: [] as Destino[] }

    const efectivos = (padron ?? [])
      .filter((p) => plano(`${p.codigo ?? ''} ${p.grado ?? ''} ${p.nombre_completo}`).includes(t))
      // El activo va antes que la baja: se busca a quien se va a atender.
      .sort((a, b) => Number(b.estado === 'activo') - Number(a.estado === 'activo'))
      .slice(0, MAX_EFECTIVOS)
      .map<Destino>((p) => ({
        clave: `p-${p.id}`,
        titulo: `${p.grado ? `${p.grado} ` : ''}${p.nombre_completo}`,
        detalle: [p.ubicacion, p.estado !== 'activo' ? p.estado : null].filter(Boolean).join(' · ') || 'Sin ubicación',
        rotulo: p.codigo ?? '—',
        ruta: `/evaluados/${p.id}`,
      }))

    return { secciones, efectivos }
  }, [q, padron, SECCIONES])

  const todos = useMemo(
    () => [...resultados.secciones, ...resultados.efectivos],
    [resultados],
  )

  useEffect(() => {
    setIndice((i) => (i >= todos.length ? 0 : i))
  }, [todos.length])

  const ir = useCallback(
    (d: Destino | undefined) => {
      if (!d) return
      onCerrar()
      navegar(d.ruta)
    },
    [navegar, onCerrar],
  )

  // La fila resaltada se mantiene a la vista al recorrer con las flechas.
  useEffect(() => {
    lista.current?.querySelector('[data-activa="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [indice])

  // Mientras está abierta, la paleta se comporta como lo que es: una capa por
  // encima de todo. Bloquea el desplazamiento del fondo —sin esto la página de
  // detrás se mueve con la rueda mientras se busca— y encierra el tabulador,
  // porque una sola pulsación de Tab dejaba el foco detrás del velo y a partir
  // de ahí ni Escape ni las flechas volvían a responder.
  useEffect(() => {
    if (!abierta) return
    const desbordeOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function atrapar(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panel.current) return
      const focos = [...panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null)
      if (focos.length === 0) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      }
    }

    document.addEventListener('keydown', atrapar, true)
    return () => {
      document.removeEventListener('keydown', atrapar, true)
      document.body.style.overflow = desbordeOriginal
    }
  }, [abierta])

  if (!abierta) return null

  function alPulsar(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setIndice((i) => (todos.length ? (i + 1) % todos.length : 0))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setIndice((i) => (todos.length ? (i - 1 + todos.length) % todos.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      ir(todos[indice])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCerrar()
    }
  }

  let n = -1

  // Al `body`, como los diálogos: la capa de arriba se decide por el orden en
  // el documento, y la paleta se abre siempre ENCIMA de lo que haya.
  return createPortal(
    <div
      className="velo-entra fixed inset-0 z-[70] flex items-start justify-center bg-velo p-4 pt-[10vh] backdrop-blur-[6px] print:hidden"
      onClick={onCerrar}
    >
      <div
        ref={panel}
        data-capa
        role="dialog"
        aria-modal="true"
        aria-label="Ir a"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={alPulsar}
        className="paleta-entra liquido-denso w-full max-w-xl overflow-hidden rounded-hoja"
      >
        <div className="flex items-center gap-3 border-b border-borde/70 px-5">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-tinta-tenue" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={campo}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIndice(0)
            }}
            role="combobox"
            aria-expanded
            aria-controls="paleta-lista"
            aria-autocomplete="list"
            placeholder={esPsicologo ? 'Efectivo por nombre, grado o número — o sección' : 'Sección'}
            // Sin anillo de foco: el diálogo entero es el foco y el campo es su
            // única entrada, así que el anillo sólo dibujaría una caja dentro
            // de otra caja. El cursor ya dice dónde se escribe.
            className="min-h-14 w-full bg-transparent text-base text-tinta outline-none focus-visible:outline-none placeholder:text-tinta-tenue"
          />
          <kbd className="tecla hidden shrink-0 sm:block">ESC</kbd>
        </div>

        <div id="paleta-lista" ref={lista} role="listbox" aria-label="Resultados" className="max-h-[52vh] overflow-y-auto p-2">
          {todos.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-tinta-tenue">
              {fallo
                ? 'No se pudo consultar el padrón. Use el listado de Evaluados.'
                : esPsicologo && padron === null
                  ? 'Consultando el padrón…'
                  : `Sin coincidencias para «${q.trim()}».`}
            </p>
          )}

          {resultados.secciones.length > 0 && <Grupo titulo="Secciones" />}
          {resultados.secciones.map((d) => {
            n++
            return <Fila key={d.clave} d={d} activa={n === indice} onIr={() => ir(d)} alEntrar={((i) => () => setIndice(i))(n)} />
          })}

          {resultados.efectivos.length > 0 && <Grupo titulo="Efectivos" />}
          {resultados.efectivos.map((d) => {
            n++
            return <Fila key={d.clave} d={d} activa={n === indice} onIr={() => ir(d)} alEntrar={((i) => () => setIndice(i))(n)} />
          })}
        </div>

        <div className="folio flex items-center justify-between gap-3 border-t border-borde/70 px-5 py-2.5">
          <span className="flex items-center gap-2">
            <kbd className="tecla">↑↓</kbd> recorrer
            <kbd className="tecla ml-2">↵</kbd> abrir
          </span>
          {padron && <span className="tabular-nums">{padron.length} en padrón</span>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Grupo({ titulo }: { titulo: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-tinta-tenue" role="presentation">
      {titulo}
    </div>
  )
}

function Fila({
  d, activa, onIr, alEntrar,
}: {
  d: Destino
  activa: boolean
  onIr: () => void
  alEntrar: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={activa}
      data-activa={activa ? '1' : '0'}
      onMouseEnter={alEntrar}
      onClick={onIr}
      className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
        activa ? 'lente' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-tinta">{d.titulo}</span>
        <span className="block truncate text-xs text-tinta-tenue">{d.detalle}</span>
      </span>
      <span className="cifras shrink-0 text-[11px] text-tinta-tenue">{d.rotulo}</span>
    </button>
  )
}
