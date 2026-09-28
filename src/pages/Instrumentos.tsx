// ============================================================================
// 07 · INSTRUMENTOS
// ----------------------------------------------------------------------------
// Los cuestionarios con su corrección. Vienen cargados el Rosenberg, el BAI,
// el BDI-II y el Mini-Mult; la psicóloga puede ajustarlos (puntos de corte,
// normas, redacción) o crear los suyos a partir de uno existente.
// ============================================================================

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cargarInstrumentos, invalidar } from '../lib/datos'
import { fmtFecha } from '../lib/formato'
import type { Instrumento } from '../lib/tipos'
import { Boton, Encabezado, EsqueletoTabla, Insignia, Tarjeta } from '../components/ui'

export default function Instrumentos() {
  const [ins, setIns] = useState<Instrumento[] | null>(null)
  const navegar = useNavigate()
  useEffect(() => { invalidar('instrumentos'); cargarInstrumentos().then(setIns) }, [])

  return (
    <div className="space-y-4">
      <Encabezado indice="07 / Instrumentos" titulo="Instrumentos"
        detalle="Ítems, alternativas, escalas, puntos de corte, normas T y alertas de cada cuestionario. La calificación la hace la base con esta definición."
        accion={<Boton onClick={() => navegar('/instrumentos/nuevo')}>Nuevo instrumento</Boton>} />
      {!ins ? <EsqueletoTabla filas={4} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {ins.map((i) => (
            <Link key={i.clave} to={`/instrumentos/${i.clave}`} className={`tarjeta-viva lamina pulsable block rounded-tarjeta border border-borde p-4 ${i.activo ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="cifras rotulo text-marca">{i.sigla ?? i.clave}</div>
                  <h2 className="mt-1 text-[16px] font-semibold text-tinta">{i.nombre}</h2>
                </div>
                {!i.activo && <Insignia>Inactivo</Insignia>}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-tinta-suave">{i.descripcion}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-borde pt-3 text-[12px] text-tinta-tenue">
                <span className="cifras">{i.definicion.items.length} ítems</span>
                <span className="cifras">{i.definicion.escalas.length} escalas</span>
                <span className="cifras">{i.definicion.alertas?.length ?? 0} alertas</span>
                <span className="cifras">v{i.version} · {fmtFecha(i.actualizado_en)}</span>
              </div>
            </Link>
          ))}
          <Tarjeta className="p-4 text-[12px] leading-relaxed text-tinta-tenue md:col-span-2">
            Mini-Mult: ítems y clave de Kincannon (1968) con las normas T de la adaptación СМОЛ (Zaitsev), tomadas de un sistema
            de evaluación militar de código abierto (github.com/vilnar/quiz) y traducidas al español. Si la sección cuenta con
            normas locales, reemplace la media y la desviación de cada escala en su editor.
          </Tarjeta>
        </div>
      )}
    </div>
  )
}
