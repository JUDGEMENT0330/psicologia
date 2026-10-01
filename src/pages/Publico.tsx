// ============================================================================
// ENLACE DE EVALUACIÓN — lo que abre el evaluado, sin cuenta
// ----------------------------------------------------------------------------
// Se abre en el teléfono del efectivo desde WhatsApp o un código QR. Todo pasa
// por tres funciones de la base (`ps_publico_*`): el navegador nunca recibe
// claves de corrección ni puntos de corte, y nunca calcula el puntaje —lo
// calcula la base al enviar—, así que no hay forma de «arreglar» un resultado
// desde aquí.
//
// Las respuestas se guardan en la base al pasar de página y, por si se cae la
// red, también en el propio teléfono: cerrar el enlace a medias y volver a
// abrirlo retoma donde se quedó.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ESCOLARIDAD, ESTADO_CIVIL } from '../lib/formato'
import type { Item, Opcion } from '../lib/tipos'
import { Alerta, Boton, Campo, Cargando, Checkbox, Input, Select, Tarjeta } from '../components/ui'
import { Logotipo } from '../components/Marca'

interface InstrumentoPublico {
  clave: string
  nombre: string
  sigla: string | null
  instrucciones: string | null
  opciones: Opcion[] | null
  items: Item[]
}

type Apertura =
  | { modo: 'invalido' | 'vencida' | 'completada' }
  | { modo: 'identificar'; convocatoria: string }
  | {
      modo: 'aplicacion'
      estado: string
      saludo: string
      bateria: { nombre: string; instrucciones: string | null; consentimiento: string | null; pedir_contexto: boolean }
      instrumentos: InstrumentoPublico[]
      respuestas: Record<string, Record<string, number>>
      contexto: { escolaridad?: string; estado_civil?: string; edad?: number; consentimiento?: string }
    }

type Respuestas = Record<string, Record<string, number>>

const POR_PAGINA = 7

export default function Publico() {
  const { token = '' } = useParams()
  const [ap, setAp] = useState<Apertura | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setAp(null)
    supabase.rpc('ps_publico_abrir', { p_token: token }).then(({ data, error }) => {
      if (!vivo) return
      if (error) setError('No hay respuesta del servidor. Revise su conexión e inténtelo otra vez.')
      else setAp(data as Apertura)
    })
    return () => { vivo = false }
  }, [token])

  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-borde bg-superficie/80 px-4 py-3" style={{ paddingTop: 'max(0.75rem, var(--seguro-arriba))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Logotipo px={36} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold text-tinta">Psicología · Sección de Sanidad</div>
            <div className="truncate text-[11px] text-tinta-tenue">Destacamento Militar N° 1</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6" style={{ paddingBottom: 'max(2rem, var(--seguro-abajo))' }}>
        {error ? <Alerta>{error}</Alerta>
          : !ap ? <Cargando texto="Abriendo la evaluación…" />
            : ap.modo === 'aplicacion' ? <Aplicar token={token} ap={ap} />
              : ap.modo === 'identificar' ? <Identificar token={token} convocatoria={ap.convocatoria} />
                : <Mensaje modo={ap.modo} />}
      </main>
    </div>
  )
}

function Mensaje({ modo }: { modo: 'invalido' | 'vencida' | 'completada' }) {
  const t = {
    invalido: ['Enlace no válido', 'Este enlace no existe o fue anulado. Pida uno nuevo a Psicología.'],
    vencida: ['Enlace vencido', 'La evaluación ya cerró. Si todavía debe responderla, pida un enlace nuevo a Psicología.'],
    completada: ['Evaluación ya respondida', 'Esta evaluación ya fue enviada. Gracias por su tiempo.'],
  }[modo]
  return (
    <Tarjeta className="p-6">
      <div className="cifras rotulo mb-2 text-marca">Evaluación psicológica</div>
      <h1 className="titular text-2xl text-tinta">{t[0]}</h1>
      <p className="mt-3 text-sm leading-relaxed text-tinta-suave">{t[1]}</p>
    </Tarjeta>
  )
}

/* ------------------------------------------------------ enlace de cohorte -- */

function Identificar({ token, convocatoria }: { token: string; convocatoria: string }) {
  const navegar = useNavigate()
  const [codigo, setCodigo] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('ps_publico_identificar', { p_token: token, p_codigo: codigo.trim(), p_pin: pin.trim() })
    setEnviando(false)
    if (error) return setError('No hay respuesta del servidor. Inténtelo otra vez.')
    const r = data as { ok: boolean; token?: string; motivo?: string }
    if (!r.ok) return setError(r.motivo ?? 'No se pudo identificar.')
    navegar(`/e/${r.token}`, { replace: true })
  }

  return (
    <Tarjeta className="p-6">
      <div className="cifras rotulo mb-2 text-marca">Evaluación psicológica</div>
      <h1 className="titular text-2xl text-tinta">{convocatoria}</h1>
      <p className="mt-3 text-sm leading-relaxed text-tinta-suave">
        Escriba su número de padrón y el PIN que le dio Psicología. Con eso se abre su evaluación personal.
      </p>
      <form onSubmit={entrar} className="mt-6 space-y-4">
        <Campo etiqueta="Número de padrón">
          <Input inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoComplete="off" />
        </Campo>
        <Campo etiqueta="PIN de la convocatoria">
          <Input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required autoComplete="off" maxLength={6} />
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <Boton type="submit" disabled={enviando} className="w-full">{enviando ? 'Verificando…' : 'Continuar'}</Boton>
      </form>
    </Tarjeta>
  )
}

/* ------------------------------------------------------------ aplicación -- */

interface Pagina {
  instrumento: InstrumentoPublico
  items: Item[]
  primera: boolean
}

function Aplicar({ token, ap }: { token: string; ap: Extract<Apertura, { modo: 'aplicacion' }> }) {
  const llave = `ps-borrador-${token}`
  const [resp, setResp] = useState<Respuestas>(() => {
    let local: Respuestas = {}
    try { local = JSON.parse(localStorage.getItem(llave) ?? '{}') } catch { /* sin almacenamiento local */ }
    // Lo guardado en la base manda; lo del teléfono completa lo que no llegó a subir.
    const out: Respuestas = {}
    for (const i of ap.instrumentos) out[i.clave] = { ...(local[i.clave] ?? {}), ...(ap.respuestas[i.clave] ?? {}) }
    return out
  })
  const [ctx, setCtx] = useState({
    escolaridad: ap.contexto.escolaridad ?? '',
    estado_civil: ap.contexto.estado_civil ?? '',
    edad: ap.contexto.edad ? String(ap.contexto.edad) : '',
    consentimiento: !!ap.contexto.consentimiento,
  })
  const [paso, setPaso] = useState(-1) // -1 portada · 0..n-1 páginas · n revisión
  const [enviando, setEnviando] = useState(false)
  const [final, setFinal] = useState<null | { resumen?: { instrumento: string; escalas: { nombre: string; etiqueta: string | null }[] }[] }>(null)
  const [error, setError] = useState<string | null>(null)
  const arriba = useRef<HTMLDivElement>(null)

  const paginas = useMemo<Pagina[]>(() => {
    const out: Pagina[] = []
    for (const ins of ap.instrumentos) {
      // Los ítems con alternativas propias ocupan más: menos por página. Las
      // del BDI-II son frases largas (3 por página); las de la ADS, cortas (5).
      const propias = ins.items.flatMap((i) => i.opciones ?? [])
      const largo = propias.length ? propias.reduce((s, o) => s + o.texto.length, 0) / propias.length : 0
      const tam = !propias.length ? POR_PAGINA : largo > 30 ? 3 : 5
      for (let i = 0; i < ins.items.length; i += tam) out.push({ instrumento: ins, items: ins.items.slice(i, i + tam), primera: i === 0 })
    }
    return out
  }, [ap.instrumentos])

  const total = ap.instrumentos.reduce((s, i) => s + i.items.length, 0)
  const hechas = ap.instrumentos.reduce((s, i) => s + Object.keys(resp[i.clave] ?? {}).length, 0)

  useEffect(() => {
    try { localStorage.setItem(llave, JSON.stringify(resp)) } catch { /* sin almacenamiento local */ }
  }, [resp, llave])

  const guardar = useCallback(async (finalizar: boolean) => {
    const { data, error } = await supabase.rpc('ps_publico_guardar', {
      p_token: token,
      p_respuestas: resp,
      // Lo vacío va como nulo: la base lo descarta en vez de guardar cadenas vacías.
      p_contexto: {
        escolaridad: ctx.escolaridad || null,
        estado_civil: ctx.estado_civil || null,
        edad: ctx.edad || null,
        consentimiento: ctx.consentimiento ? 'true' : null,
      },
      p_finalizar: finalizar,
    })
    if (error) throw new Error('No hay conexión con el servidor. Sus respuestas siguen guardadas en este teléfono; vuelva a intentarlo.')
    return data as { ok: boolean; motivo?: string; faltan?: number; resumen?: never }
  }, [token, resp, ctx])

  /** Cambia de página. Con `foco`, lleva a ese ítem (el primero que falta). */
  async function ir(n: number, foco?: string) {
    setError(null)
    if (paso >= 0 && n > paso) {
      // Guardado silencioso al avanzar: si falla, se sigue; el envío final reintenta.
      guardar(false).catch(() => {})
    }
    setPaso(n)
    requestAnimationFrame(() => {
      const item = foco ? document.getElementById(foco) : null
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      const r = await guardar(true)
      if (!r.ok) setError(r.motivo ?? 'No se pudo enviar.')
      else {
        try { localStorage.removeItem(llave) } catch { /* nada */ }
        setFinal(r as { resumen?: never })
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setEnviando(false)
  }

  function marcar(ins: string, n: number, idx: number) {
    setResp((r) => ({ ...r, [ins]: { ...(r[ins] ?? {}), [n]: idx } }))
  }

  if (final) {
    return (
      <Tarjeta className="p-6">
        <div className="cifras rotulo mb-2 text-marca">Enviada</div>
        <h1 className="titular text-2xl text-tinta">Gracias, {ap.saludo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-tinta-suave">
          Su evaluación quedó registrada. Si hace falta, Psicología le buscará para conversar los resultados.
          Si en algún momento necesita apoyo, acérquese a la Sección de Sanidad: no necesita esperar a que le llamen.
        </p>
        {final.resumen && final.resumen.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-borde pt-4">
            {final.resumen.map((i) => (
              <div key={i.instrumento}>
                <div className="rotulo text-tinta-tenue">{i.instrumento}</div>
                <ul className="mt-1 text-sm text-tinta">
                  {(i.escalas ?? []).map((e) => <li key={e.nombre}>{e.nombre}: {e.etiqueta ?? '—'}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    )
  }

  const pct = total ? hechas / total : 0

  return (
    <div ref={arriba} className="space-y-4 scroll-mt-4">
      {/* progreso */}
      {paso >= 0 && (
        <div className="sticky top-0 z-10 -mx-4 bg-fondo/90 px-4 py-2 backdrop-blur">
          <div className="flex items-center justify-between text-[12px] text-tinta-tenue">
            <span className="truncate">{paso < paginas.length ? paginas[paso].instrumento.nombre : 'Revisión final'}</span>
            <span className="cifras shrink-0">{hechas} / {total}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-pastilla bg-superficie-alta">
            <div className="h-full rounded-pastilla bg-marca transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      )}

      {paso === -1 && (
        <Tarjeta className="space-y-5 p-6">
          <div>
            <div className="cifras rotulo mb-2 text-marca">Evaluación psicológica</div>
            <h1 className="titular text-2xl text-tinta">{ap.saludo ? `Buen día, ${ap.saludo}` : 'Buen día'}</h1>
            <p className="mt-1 text-sm text-tinta-tenue">{ap.bateria.nombre} · {total} preguntas</p>
          </div>
          {ap.bateria.instrucciones && <p className="text-sm leading-relaxed text-tinta-suave">{ap.bateria.instrucciones}</p>}
          <ul className="space-y-1 text-sm text-tinta-suave">
            {ap.instrumentos.map((i) => <li key={i.clave}>· {i.nombre} <span className="text-tinta-tenue">({i.items.length})</span></li>)}
          </ul>
          {ap.bateria.pedir_contexto && (
            <div className="grid gap-4 border-t border-borde pt-4 sm:grid-cols-3">
              <Campo etiqueta="Escolaridad">
                <Select value={ctx.escolaridad} onChange={(e) => setCtx({ ...ctx, escolaridad: e.target.value })}>
                  <option value="">—</option>
                  {ESCOLARIDAD.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Campo>
              <Campo etiqueta="Estado civil">
                <Select value={ctx.estado_civil} onChange={(e) => setCtx({ ...ctx, estado_civil: e.target.value })}>
                  <option value="">—</option>
                  {ESTADO_CIVIL.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Campo>
              <Campo etiqueta="Edad">
                <Input inputMode="numeric" maxLength={2} value={ctx.edad} onChange={(e) => setCtx({ ...ctx, edad: e.target.value.replace(/\D/g, '') })} />
              </Campo>
            </div>
          )}
          {ap.bateria.consentimiento && (
            <div className="rounded-control border border-borde bg-superficie-alta/50 p-4">
              <p className="text-[13px] leading-relaxed text-tinta-suave">{ap.bateria.consentimiento}</p>
              <div className="mt-2">
                <Checkbox etiqueta="Estoy de acuerdo" checked={ctx.consentimiento} onChange={(v) => setCtx({ ...ctx, consentimiento: v })} />
              </div>
            </div>
          )}
          <Boton className="w-full" disabled={!!ap.bateria.consentimiento && !ctx.consentimiento} onClick={() => ir(0)}>
            {hechas > 0 ? 'Continuar donde me quedé' : 'Comenzar'}
          </Boton>
        </Tarjeta>
      )}

      {paso >= 0 && paso < paginas.length && (
        <PaginaItems
          pagina={paginas[paso]}
          resp={resp[paginas[paso].instrumento.clave] ?? {}}
          marcar={(n, idx) => marcar(paginas[paso].instrumento.clave, n, idx)}
        />
      )}

      {paso === paginas.length && (
        <Tarjeta className="space-y-4 p-6">
          <h2 className="titular text-xl text-tinta">Revise antes de enviar</h2>
          {ap.instrumentos.map((i) => {
            const faltan = i.items.filter((it) => resp[i.clave]?.[it.n] === undefined)
            return (
              <div key={i.clave} className="flex items-start justify-between gap-3 border-b border-borde pb-3 text-sm">
                <span className="text-tinta">{i.nombre}</span>
                {faltan.length === 0 ? <span className="text-exito">Completo</span> : (
                  <button type="button" className="text-right text-alerta underline"
                    onClick={() => ir(paginas.findIndex((p) => p.instrumento.clave === i.clave && p.items.some((x) => x.n === faltan[0].n)), `item-${i.clave}-${faltan[0].n}`)}>
                    Faltan {faltan.length}: {faltan.slice(0, 6).map((x) => x.n).join(', ')}{faltan.length > 6 ? '…' : ''}
                  </button>
                )}
              </div>
            )
          })}
          <p className="text-[12px] leading-relaxed text-tinta-tenue">Al enviar ya no podrá cambiar las respuestas.</p>
          {error && <Alerta>{error}</Alerta>}
          <Boton className="w-full" disabled={enviando || hechas < total} onClick={enviar}>
            {enviando ? 'Enviando…' : hechas < total ? `Faltan ${total - hechas} respuestas` : 'Enviar evaluación'}
          </Boton>
        </Tarjeta>
      )}

      {paso >= 0 && (
        <div className="flex gap-3">
          <Boton variante="secundario" className="flex-1" onClick={() => ir(paso - 1)}>Anterior</Boton>
          {paso < paginas.length && (
            <Boton className="flex-1" onClick={() => ir(paso + 1)}>
              {paso === paginas.length - 1 ? 'Revisar' : 'Siguiente'}
            </Boton>
          )}
        </div>
      )}
      {paso >= 0 && paso < paginas.length && error && <Alerta>{error}</Alerta>}
    </div>
  )
}

function PaginaItems({ pagina, resp, marcar }: { pagina: Pagina; resp: Record<string, number>; marcar: (n: number, idx: number) => void }) {
  const ins = pagina.instrumento
  return (
    <div className="space-y-3">
      {pagina.primera && ins.instrucciones && (
        <Tarjeta className="p-4">
          <div className="rotulo mb-1 text-marca">{ins.nombre}</div>
          <p className="text-sm leading-relaxed text-tinta-suave">{ins.instrucciones}</p>
        </Tarjeta>
      )}
      {pagina.items.map((it) => {
        const ops = it.opciones ?? ins.opciones ?? []
        const propias = !!it.opciones
        return (
          <Tarjeta key={it.n} className="p-4">
            <fieldset id={`item-${ins.clave}-${it.n}`} className="scroll-mt-24">
              <legend className="mb-3 flex gap-2 text-[15px] leading-snug text-tinta">
                <span className="cifras shrink-0 text-tinta-tenue">{it.n}.</span>
                <span className={propias ? 'font-semibold' : ''}>{it.texto}</span>
              </legend>
              {/* Seis alternativas (Ryff) van en filas de tres: en cuatro
                  columnas la última fila quedaba con dos sueltas. */}
              <div className={propias ? 'space-y-2' : ops.length <= 2 ? 'grid grid-cols-2 gap-2' : ops.length % 3 === 0 ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
                {ops.map((o, idx) => {
                  const sel = resp[it.n] === idx
                  return (
                    <label key={idx}
                      className={`pulsable flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-[14px] leading-snug transition-colors ${
                        sel ? 'border-marca bg-marca text-fondo' : 'border-borde bg-superficie text-tinta hover:border-marca'
                      }`}>
                      <input type="radio" className="sr-only" name={`${ins.clave}-${it.n}`} checked={sel} onChange={() => marcar(it.n, idx)} />
                      {propias && <span className={`cifras w-6 shrink-0 text-[12px] ${sel ? '' : 'text-tinta-tenue'}`}>{o.rotulo ?? o.valor}</span>}
                      <span className={propias ? '' : 'w-full text-center'}>{o.texto}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </Tarjeta>
        )
      })}
    </div>
  )
}
