// ============================================================================
// CAPTURA — transcribir una hoja de respuestas en papel
// ----------------------------------------------------------------------------
// Para quien respondió sin teléfono. La psicóloga marca ítem por ítem con el
// teclado (1, 2, 3… = alternativa; V/F en el Mini-Mult) o con el ratón, y al
// terminar la base califica exactamente igual que si hubiera llegado por
// enlace: la misma función, el mismo resultado.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cargarInstrumentos } from '../lib/datos'
import { useAvisos } from '../lib/avisos'
import type { Aplicacion, Bateria, Instrumento } from '../lib/tipos'
import { Alerta, Boton, Cargando, Modal } from './ui'

export default function Captura({ ap, bateria, onCerrar, onGuardado }: {
  ap: Aplicacion
  bateria: Bateria
  onCerrar: () => void
  onGuardado: () => void
}) {
  const avisos = useAvisos()
  const [ins, setIns] = useState<Instrumento[] | null>(null)
  const [resp, setResp] = useState<Record<string, Record<string, number>>>(() => structuredClone(ap.respuestas ?? {}))
  const [cursor, setCursor] = useState<{ i: number; n: number }>({ i: 0, n: 0 })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    cargarInstrumentos().then((todos) => setIns(bateria.instrumentos.map((c) => todos.find((x) => x.clave === c)).filter(Boolean) as Instrumento[]))
  }, [bateria])

  const total = useMemo(() => (ins ?? []).reduce((s, i) => s + i.definicion.items.length, 0), [ins])
  const hechas = useMemo(() => (ins ?? []).reduce((s, i) => s + Object.keys(resp[i.clave] ?? {}).length, 0), [ins, resp])

  function marcar(clave: string, n: number, idx: number) {
    setResp((r) => ({ ...r, [clave]: { ...(r[clave] ?? {}), [n]: idx } }))
  }

  // Teclado: dígito = alternativa (1 es la primera), V/F para verdadero/falso,
  // S/N para sí/no, flechas para moverse. Avanza solo al marcar. En las hojas
  // con puntaje impreso por alternativa (BDI-II, ADS) el dígito es ese
  // puntaje —el número que la persona marcó en el papel—, empezando en 0.
  function alTeclear(e: React.KeyboardEvent) {
    if (!ins) return
    const actual = ins[cursor.i]
    if (!actual) return
    const it = actual.definicion.items[cursor.n]
    const ops = it.opciones ?? actual.definicion.opciones ?? []
    let idx = -1
    if (/^[0-9]$/.test(e.key) && it.opciones) {
      idx = ops.findIndex((o) => String(o.rotulo ?? o.valor) === e.key)
      if (idx < 0) idx = ops.findIndex((o) => String(o.rotulo ?? o.valor).startsWith(e.key))
    } else if (/^[1-9]$/.test(e.key)) idx = Number(e.key) - 1
    else if (/^[vV]$/.test(e.key)) idx = ops.findIndex((o) => /^verdad/i.test(o.texto))
    else if (/^[fF]$/.test(e.key)) idx = ops.findIndex((o) => /^fals/i.test(o.texto))
    else if (/^[sS]$/.test(e.key)) idx = ops.findIndex((o) => /^(s[ií](?![a-záéíóúñ])|verdad)/i.test(o.texto))
    else if (/^[nN]$/.test(e.key)) idx = ops.findIndex((o) => /^(no\b|fals)/i.test(o.texto))
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') return mover(1, e)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') return mover(-1, e)
    else return
    e.preventDefault()
    if (idx < 0 || idx >= ops.length) return
    marcar(actual.clave, it.n, idx)
    mover(1)
  }

  function mover(d: number, e?: React.KeyboardEvent) {
    e?.preventDefault()
    if (!ins) return
    let { i, n } = cursor
    n += d
    if (n >= ins[i].definicion.items.length) { if (i < ins.length - 1) { i++; n = 0 } else n-- }
    if (n < 0) { if (i > 0) { i--; n = ins[i].definicion.items.length - 1 } else n = 0 }
    setCursor({ i, n })
    refs.current[`${i}-${n}`]?.scrollIntoView({ block: 'nearest' })
  }

  async function guardar(finalizar: boolean) {
    setGuardando(true)
    setError(null)
    // Se marca como presencial antes de enviar: así queda constancia de cómo se aplicó.
    await supabase.from('ps_aplicaciones').update({ origen: 'presencial' }).eq('id', ap.id)
    const { data, error } = await supabase.rpc('ps_publico_guardar', {
      p_token: ap.token, p_respuestas: resp, p_contexto: {}, p_finalizar: finalizar,
    })
    setGuardando(false)
    if (error) return setError(error.message)
    const r = data as { ok: boolean; motivo?: string }
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.')
    avisos.exito(finalizar ? 'Evaluación calificada.' : 'Avance guardado.')
    onGuardado()
  }

  return (
    <Modal titulo={`Capturar respuestas · ${bateria.nombre}`} onCerrar={onCerrar} ancho="max-w-4xl">
      {!ins ? <Cargando /> : (
        <div className="space-y-4" onKeyDown={alTeclear} tabIndex={0}>
          <p className="text-[12px] leading-relaxed text-tinta-tenue">
            Teclado: <kbd className="tecla">1</kbd>–<kbd className="tecla">7</kbd> elige la alternativa (en BDI-II y ADS, el puntaje impreso: <kbd className="tecla">0</kbd>–<kbd className="tecla">3</kbd>),
            <kbd className="tecla">V</kbd>/<kbd className="tecla">F</kbd> verdadero o falso, <kbd className="tecla">S</kbd>/<kbd className="tecla">N</kbd> sí o no, flechas para moverse. Avanza solo. <span className="cifras">{hechas} / {total}</span>
          </p>
          <div className="max-h-[48dvh] space-y-5 overflow-y-auto overscroll-contain pr-1 sm:max-h-[60dvh]">
            {ins.map((x, i) => (
              <section key={x.clave}>
                <h3 className="rotulo mb-2 text-marca">{x.nombre}</h3>
                <div className="grid gap-1">
                  {x.definicion.items.map((it, n) => {
                    const ops = it.opciones ?? x.definicion.opciones ?? []
                    const activo = cursor.i === i && cursor.n === n
                    const sel = resp[x.clave]?.[it.n]
                    return (
                      <div key={it.n} ref={(el) => { refs.current[`${i}-${n}`] = el }}
                        onClick={() => setCursor({ i, n })}
                        className={`grid grid-cols-[2rem_1fr] items-start gap-2 rounded-control px-2 py-1.5 sm:grid-cols-[2rem_1fr_auto] ${activo ? 'bg-marca-suave ring-1 ring-marca' : ''}`}>
                        <span className="cifras pt-1 text-[12px] text-tinta-tenue">{it.n}</span>
                        <span className="pt-0.5 text-[13px] text-tinta">{it.texto}</span>
                        <div className="col-span-2 flex flex-wrap gap-1 sm:col-span-1 sm:justify-end">
                          {ops.map((o, k) => (
                            <button key={k} type="button" title={o.texto}
                              onClick={(e) => { e.stopPropagation(); marcar(x.clave, it.n, k); setCursor({ i, n }) }}
                              className={`pulsable min-h-8 min-w-8 rounded-control border px-2 text-[12px] ${sel === k ? 'border-marca bg-marca text-fondo' : 'border-borde bg-superficie text-tinta-suave'}`}>
                              {it.opciones ? (o.rotulo ?? o.valor) : ops.length === 2 ? o.texto[0] : `${k + 1}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
          {error && <Alerta>{error}</Alerta>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-borde pt-4">
            <Boton variante="secundario" onClick={() => guardar(false)} disabled={guardando}>Guardar avance</Boton>
            <Boton onClick={() => guardar(true)} disabled={guardando || hechas < total}>
              {hechas < total ? `Faltan ${total - hechas}` : guardando ? 'Calificando…' : 'Terminar y calificar'}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  )
}
