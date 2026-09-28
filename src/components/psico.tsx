// ============================================================================
// PIEZAS DE PSICOLOGÍA — estado, resultado y distribución por nivel
// ============================================================================

import type { Aplicacion, InstrumentoCalificado, Nivel } from '../lib/tipos'
import { COLOR_NIVEL, ESTADOS_APLICACION, NOMBRE_NIVEL, ORDEN_NIVEL } from '../lib/formato'
import { EtiquetaNivel, Insignia } from './ui'

export function EstadoAplicacion({ ap }: { ap: Pick<Aplicacion, 'estado' | 'identidad_confirmada'> }) {
  const e = ESTADOS_APLICACION[ap.estado]
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Insignia tono={e.tono}>{e.etiqueta}</Insignia>
      {!ap.identidad_confirmada && ap.estado !== 'anulada' && <Insignia tono="ambar">Identidad por confirmar</Insignia>}
    </span>
  )
}

/** Barra apilada: cuántos de cada nivel. Se lee de un vistazo en una fila. */
export function BarraNiveles({ cuenta, alto = 8 }: { cuenta: Partial<Record<Nivel, number>>; alto?: number }) {
  const total = ORDEN_NIVEL.reduce((s, n) => s + (cuenta[n] ?? 0), 0)
  if (!total) return <div className="rounded-pastilla bg-superficie-alta" style={{ height: alto }} />
  return (
    <div className="flex w-full overflow-hidden rounded-pastilla bg-superficie-alta" style={{ height: alto }}
      title={ORDEN_NIVEL.filter((n) => cuenta[n]).map((n) => `${NOMBRE_NIVEL[n]}: ${cuenta[n]}`).join(' · ')}>
      {ORDEN_NIVEL.map((n) => (cuenta[n] ? <span key={n} style={{ width: `${((cuenta[n] ?? 0) / total) * 100}%`, background: COLOR_NIVEL[n] }} /> : null))}
    </div>
  )
}

export function LeyendaNiveles({ niveles = ORDEN_NIVEL }: { niveles?: Nivel[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-tinta-tenue">
      {niveles.map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}
        </span>
      ))}
    </div>
  )
}

/** Resultado de una aplicación: escalas, niveles, alertas y validez. */
export function ResultadoAplicacion({ ap }: { ap: Aplicacion }) {
  const ins = ap.resultados?.instrumentos ?? []
  if (!ins.length) return <p className="text-sm text-tinta-tenue">Sin calificar todavía.</p>
  const alertas = ins.flatMap((i) => i.alertas)
  return (
    <div className="space-y-4">
      {alertas.map((a, k) => (
        <div key={k} className="rounded-control border border-alerta bg-alerta-suave px-3 py-2 text-sm font-medium text-alerta">
          {a.mensaje}
        </div>
      ))}
      {ap.validez_dudosa && (
        <div className="rounded-control border border-aviso bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Perfil de validez dudosa (escalas L, F o K elevadas): interpretar con cautela.
        </div>
      )}
      {ins.map((i) => <TablaInstrumento key={i.instrumento} ins={i} />)}
    </div>
  )
}

function TablaInstrumento({ ins }: { ins: InstrumentoCalificado }) {
  const conT = ins.escalas.some((e) => e.t !== null)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-tinta">{ins.nombre}</h3>
        <span className="cifras text-[11px] text-tinta-tenue">v{ins.version} · {ins.respondidos}/{ins.total}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rotulo text-left text-tinta-tenue">
              <th className="py-1.5 pr-2 font-normal">Escala</th>
              <th className="py-1.5 pr-2 text-right font-normal">Bruto</th>
              {conT && <th className="py-1.5 pr-2 text-right font-normal">T</th>}
              <th className="py-1.5 font-normal">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {ins.escalas.map((e) => (
              <tr key={e.clave}>
                <td className="py-1.5 pr-2">
                  {e.nombre}
                  {e.validez && <span className="rotulo ml-1.5 text-[9px] text-tinta-tenue">validez</span>}
                </td>
                <td className="cifras py-1.5 pr-2 text-right">{e.bruta}</td>
                {conT && (
                  <td className="py-1.5 pr-2 text-right">
                    {e.t !== null && <MedidorT t={e.t} nivel={e.nivel} />}
                  </td>
                )}
                <td className="py-1.5"><EtiquetaNivel nivel={e.nivel} texto={e.etiqueta ?? undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** El T con una regla de 20 a 110 y la marca del 70. */
function MedidorT({ t, nivel }: { t: number; nivel: Nivel }) {
  const x = (v: number) => ((Math.max(20, Math.min(110, v)) - 20) / 90) * 100
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative hidden h-1.5 w-20 rounded-pastilla bg-superficie-alta sm:inline-block">
        <span className="absolute inset-y-0 w-px bg-alerta/60" style={{ left: `${x(70)}%` }} />
        <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x(t)}%`, background: COLOR_NIVEL[nivel] }} />
      </span>
      <span className="cifras">{Math.round(t)}</span>
    </span>
  )
}
