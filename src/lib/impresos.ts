// ============================================================================
// IMPRESOS DE PSICOLOGÍA
// ----------------------------------------------------------------------------
//   · informe()      resultados de una aplicación, con perfil gráfico de las
//                    escalas T y notas; lo firma la psicóloga.
//   · hojaEnBlanco() la batería en papel para aplicarla sin teléfono; luego se
//                    transcribe en «Aplicaciones → Capturar respuestas».
//   · listaEnlaces() los enlaces de una convocatoria con su QR, para repartir
//                    en formación o pegar en la cartelera.
// ============================================================================

import QRCode from 'qrcode'
import { esc, imprimir } from './imprimir'
import { COLOR_NIVEL, NOMBRE_NIVEL, TIPOS_EVALUACION, edad, fmtFecha, fmtFechaHora } from './formato'
import type { Aplicacion, Bateria, Convocatoria, Instrumento, InstrumentoCalificado, Nota, PacienteBreve, Paciente } from './tipos'

const nivel = (n: string, t?: string | null) =>
  `<span class="n n-${esc(n)}">${esc(t ?? NOMBRE_NIVEL[n as keyof typeof NOMBRE_NIVEL] ?? n)}</span>`

/** Perfil tipo MMPI: puntajes T unidos por una línea, con la franja 30–70. */
function perfilT(ins: InstrumentoCalificado): string {
  const esc_ = ins.escalas.filter((e) => e.t !== null)
  if (esc_.length < 3) return ''
  const W = 640, H = 220, izq = 34, der = 10, arr = 12, aba = 38
  const x = (i: number) => izq + ((W - izq - der) * (i + 0.5)) / esc_.length
  const y = (t: number) => arr + ((H - arr - aba) * (120 - Math.max(20, Math.min(120, t)))) / 100
  const lineas = [30, 50, 70, 90, 110].map((t) =>
    `<line x1="${izq}" x2="${W - der}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 70 ? '#b8241a' : '#d3d0c6'}" stroke-dasharray="${t === 50 ? '' : '3 3'}"/>
     <text x="${izq - 6}" y="${y(t) + 3}" font-size="9" text-anchor="end" fill="#6d6c62">${t}</text>`).join('')
  const puntos = esc_.map((e, i) => `${x(i)},${y(e.t!)}`).join(' ')
  const marcas = esc_.map((e, i) => `
    <circle cx="${x(i)}" cy="${y(e.t!)}" r="3.5" fill="${COLOR_NIVEL[e.nivel]}" />
    <text x="${x(i)}" y="${y(e.t!) - 7}" font-size="8.5" text-anchor="middle" fill="#14140f">${Math.round(e.t!)}</text>
    <text x="${x(i)}" y="${H - aba + 14}" font-size="9" text-anchor="middle" fill="#14140f">${esc(e.clave)}</text>`).join('')
  // Validez y clínicas no se unen con la misma línea.
  const nVal = esc_.filter((e) => e.validez).length
  const pv = esc_.slice(0, nVal).map((e, i) => `${x(i)},${y(e.t!)}`).join(' ')
  const pc = esc_.slice(nVal).map((e, i) => `${x(i + nVal)},${y(e.t!)}`).join(' ')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:220px">
    <rect x="${izq}" y="${y(70)}" width="${W - izq - der}" height="${y(30) - y(70)}" fill="#f1efe9"/>
    ${lineas}
    ${nVal ? `<polyline points="${pv}" fill="none" stroke="#6d6c62" stroke-width="1.5"/>` : ''}
    <polyline points="${nVal ? pc : puntos}" fill="none" stroke="#14140f" stroke-width="1.8"/>
    ${marcas}
    <text x="${izq}" y="${H - 6}" font-size="8.5" fill="#6d6c62">Puntaje T · franja sombreada 30–70 · línea roja: elevación clínica (T ≥ 70)</text>
  </svg>`
}

export function informe({
  ap, paciente, bateria, notas = [], firmante,
}: {
  ap: Aplicacion
  paciente: Paciente | PacienteBreve
  bateria?: Bateria | null
  notas?: Nota[]
  firmante?: string | null
}) {
  const ins = ap.resultados?.instrumentos ?? []
  const cuerpo = `
    <table><tr>
      <td><span class="r">Batería</span>${esc(bateria?.nombre ?? '—')}</td>
      <td><span class="r">Tipo</span>${esc(TIPOS_EVALUACION[ap.tipo])}</td>
      <td><span class="r">Aplicada</span>${esc(fmtFechaHora(ap.completada_en))}</td>
      <td><span class="r">Modo</span>${ap.origen === 'presencial' ? 'Presencial (papel)' : 'Enlace'}</td>
      <td><span class="r">Resultado global</span>${nivel(ap.nivel_max ?? 'normal')}</td>
    </tr></table>
    ${ap.contexto?.escolaridad || ap.contexto?.estado_civil ? `<p><span class="r">Datos referidos</span>
      ${esc([ap.contexto.escolaridad, ap.contexto.estado_civil, ap.contexto.edad ? `${ap.contexto.edad} años` : null].filter(Boolean).join(' · '))}</p>` : ''}
    ${ap.validez_dudosa ? '<div class="alerta" style="border-color:#8a5800;color:#8a5800">Perfil de validez dudosa: interpretar con cautela (ver escalas L, F, K).</div>' : ''}
    ${ins.flatMap((i) => i.alertas.map((a) => `<div class="alerta">⚠ ${esc(a.mensaje)}</div>`)).join('')}
    ${ins.map((i) => `
      <h2>${esc(i.nombre)}${i.sigla ? ` · ${esc(i.sigla)}` : ''}</h2>
      <table>
        <tr><th>Escala</th><th class="num">Bruto</th><th class="num">T</th><th>Nivel</th><th>Interpretación</th></tr>
        ${i.escalas.map((e) => `<tr>
          <td>${esc(e.nombre)}${e.validez ? ' <span class="r" style="display:inline">validez</span>' : ''}</td>
          <td class="num">${e.bruta}</td><td class="num">${e.t ?? '—'}</td>
          <td>${nivel(e.nivel)}</td><td>${esc(e.etiqueta ?? '')}</td></tr>`).join('')}
      </table>
      ${perfilT(i)}
    `).join('')}
    ${ap.observaciones ? `<h2>Observaciones de la psicóloga</h2><p>${esc(ap.observaciones).replace(/\n/g, '<br>')}</p>` : ''}
    ${notas.length ? `<h2>Notas</h2>${notas.map((n) => `<div class="nota"><span class="r">${fmtFecha(n.fecha)} · ${esc(n.tipo)}</span>${esc(n.texto).replace(/\n/g, '<br>')}${n.plan ? `<br><b>Plan:</b> ${esc(n.plan)}` : ''}</div>`).join('')}` : ''}
    <div class="firmas">
      <div class="firma">${esc(firmante ?? 'Psicóloga')}<br>Psicología · Sección de Sanidad</div>
      <div class="firma">Sello</div>
    </div>`
  imprimir({
    titulo: 'Informe de evaluación psicológica',
    folio: `EV-${ap.id.slice(0, 8).toUpperCase()}`,
    paciente: { nombre: paciente.nombre_completo, codigo: paciente.codigo, grado: paciente.grado, seccion: paciente.seccion ?? null,
      edad: 'fecha_nacimiento' in paciente ? edad(paciente.fecha_nacimiento, paciente.edad_registrada) : ap.contexto?.edad ?? null },
    cuerpo,
    confidencial: true,
    pie: 'Los resultados de pruebas psicométricas son orientativos y se interpretan en el contexto de la entrevista clínica. ' +
      'Este documento contiene información psicológica reservada: no se archiva en el expediente administrativo ni se entrega a terceros sin consentimiento.',
  })
}

export function hojaEnBlanco({ bateria, instrumentos, paciente }: {
  bateria: Bateria
  instrumentos: Instrumento[]
  paciente?: PacienteBreve | null
}) {
  const por = new Map(instrumentos.map((i) => [i.clave, i]))
  const cuerpo = `
    ${!paciente ? `<table><tr><td style="width:45%"><span class="r">Grado y nombre</span>&nbsp;</td><td><span class="r">N.º padrón</span>&nbsp;</td>
      <td><span class="r">Edad</span>&nbsp;</td><td><span class="r">Escolaridad</span>&nbsp;</td><td><span class="r">Estado civil</span>&nbsp;</td></tr></table>` : ''}
    ${bateria.instrucciones ? `<p>${esc(bateria.instrucciones)}</p>` : ''}
    ${bateria.instrumentos.map((c, k) => {
      const ins = por.get(c)
      if (!ins) return ''
      const d = ins.definicion
      // Con más de cuatro alternativas (Ryff: seis) los textos no caben en el
      // renglón: se imprimen una vez como clave y cada ítem lleva casillas
      // numeradas, como la hoja de la clínica. El número es el que se teclea
      // al capturar la hoja.
      const numeradas = (d.opciones ?? []).length > 4
      return `<div class="${k > 0 ? 'salto' : ''}"><h2>${esc(ins.nombre)}${ins.sigla ? ` · ${esc(ins.sigla)}` : ''}</h2>
        ${ins.instrucciones ? `<p><i>${esc(ins.instrucciones)}</i></p>` : ''}
        ${numeradas ? `<p>${(d.opciones ?? []).map((o, j) => `<b>${j + 1}</b> ${esc(o.texto)}`).join(' · ')}</p>` : ''}
        ${d.items.map((it) => it.opciones
          ? `<div class="grupo"><b>${it.n}. ${esc(it.texto)}</b>${it.opciones.map((o) =>
              `<div class="op"><span class="caja"></span>${esc(o.rotulo ?? o.valor)} ${esc(o.texto)}</div>`).join('')}</div>`
          : `<div class="item"><span class="num">${it.n}.</span><span>${esc(it.texto)}</span>
              <span class="o">${(d.opciones ?? []).map((o, j) => `<span><span class="caja"></span>${numeradas ? j + 1 : esc(o.texto)}</span>`).join('')}</span></div>`).join('')}
      </div>`
    }).join('')}
    ${bateria.consentimiento ? `<h2>Consentimiento</h2><p>${esc(bateria.consentimiento)}</p>
      <div class="firmas"><div class="firma">Firma del evaluado</div><div class="firma">Psicóloga</div></div>` : ''}`
  imprimir({
    titulo: bateria.nombre,
    folio: 'HOJA DE RESPUESTAS',
    paciente: paciente ? { nombre: paciente.nombre_completo, codigo: paciente.codigo, grado: paciente.grado, seccion: paciente.seccion ?? null } : undefined,
    cuerpo,
    confidencial: true,
  })
}

export async function listaEnlaces({ convocatoria, bateria, filas, general }: {
  convocatoria: Convocatoria
  bateria?: Bateria | null
  filas: { nombre: string; codigo: string | null; seccion: string | null; enlace: string; estado: string }[]
  general?: string | null
}) {
  const qr = (t: string) => QRCode.toDataURL(t, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
  const imgs = await Promise.all(filas.map((f) => qr(f.enlace)))
  const imgGeneral = general ? await qr(general) : null
  const cuerpo = `
    <table><tr>
      <td><span class="r">Convocatoria</span>${esc(convocatoria.nombre)}</td>
      <td><span class="r">Tipo</span>${esc(TIPOS_EVALUACION[convocatoria.tipo])}</td>
      <td><span class="r">Batería</span>${esc(bateria?.nombre ?? '—')}</td>
      <td><span class="r">Plazo</span>${fmtFecha(convocatoria.abre_en)} – ${fmtFecha(convocatoria.cierra_en)}</td>
    </tr></table>
    ${imgGeneral ? `<div class="qr" style="display:flex;gap:16px;align-items:center;text-align:left;margin:8px 0">
      <img src="${imgGeneral}" alt="" style="margin:0"><div><b>Enlace de cohorte</b><br>Cada quien escribe su número de padrón y el PIN.<br>
      <span style="font-size:18pt;font-family:'IBM Plex Mono',monospace;letter-spacing:.2em">PIN ${esc(convocatoria.pin)}</span>
      <div class="l">${esc(general)}</div></div></div>` : ''}
    <p>Enlaces personales: cada uno abre la evaluación de una sola persona. No los intercambie.</p>
    <div class="qrs">
      ${filas.map((f, i) => `<div class="qr"><b>${esc(f.nombre)}</b><br>${esc(f.codigo ?? '')}${f.seccion ? ` · ${esc(f.seccion)}` : ''}
        <img src="${imgs[i]}" alt=""><div class="l">${esc(f.enlace)}</div></div>`).join('')}
    </div>`
  imprimir({ titulo: 'Enlaces de evaluación', folio: convocatoria.nombre, cuerpo, confidencial: true })
}
