// ============================================================================
// IMPRESOS — informe de evaluación, hoja de respuestas y lista de enlaces
// ----------------------------------------------------------------------------
// Se arman como un documento aparte y se mandan a la impresora (o a PDF) desde
// una ventana propia: el impreso no hereda la interfaz, la barra lateral ni el
// tema oscuro, y lleva su propia cabecera con el escudo, como cualquier
// formulario de la Sección de Sanidad.
// ============================================================================

import logo from '../assets/logo.png'
import { fmtFecha, hoy } from './formato'

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface Impreso {
  titulo: string
  folio?: string
  paciente?: { nombre: string; codigo?: string | null; grado?: string | null; edad?: number | null; seccion?: string | null }
  cuerpo: string
  pie?: string
  /** Franja de «confidencial» arriba y abajo: todo lo que lleva resultados. */
  confidencial?: boolean
}

const ESTILO = `
  @page { size: letter; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.45 'Archivo', 'Helvetica Neue', Arial, sans-serif; color: #14140f; margin: 0; }
  .conf { text-align: center; font-size: 7.5pt; letter-spacing: .3em; font-weight: 700; color: #b8241a; border: 1px solid #b8241a; padding: 2px; margin-bottom: 8px; }
  .cab { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #14140f; padding-bottom: 10px; }
  .cab img { width: 58px; height: 58px; object-fit: contain; }
  .cab .u { font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #45443c; }
  .cab .t { font-size: 15pt; font-weight: 700; letter-spacing: -.01em; margin-top: 2px; }
  .cab .f { margin-left: auto; text-align: right; font: 9.5pt 'IBM Plex Mono', monospace; }
  .pac { display: grid; grid-template-columns: 2.2fr 1fr .8fr 1.6fr; border: 1px solid #14140f; border-top: 0; margin-bottom: 12px; }
  .pac div { padding: 5px 8px; border-right: 1px solid #d3d0c6; }
  .pac div:last-child { border-right: 0; }
  .r { font-size: 7pt; letter-spacing: .12em; text-transform: uppercase; color: #6d6c62; display: block; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th { text-align: left; font-size: 7pt; letter-spacing: .1em; text-transform: uppercase; color: #45443c; border-bottom: 1.5px solid #14140f; padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #d3d0c6; vertical-align: top; }
  .num { text-align: right; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
  h2 { font-size: 9.5pt; letter-spacing: .12em; text-transform: uppercase; margin: 16px 0 6px; border-bottom: 1px solid #d3d0c6; padding-bottom: 3px; break-after: avoid; }
  h3 { font-size: 10pt; margin: 12px 0 4px; break-after: avoid; }
  p { margin: 5px 0; }
  .n { display: inline-block; border: 1px solid; border-radius: 3px; padding: 0 5px; font-size: 8pt; font-weight: 600; }
  .n-normal { color: #1f5c3d; } .n-leve { color: #1a44b8; } .n-moderado { color: #8a5800; }
  .n-severo, .n-critico { color: #b8241a; }
  .alerta { border: 1.5px solid #b8241a; color: #b8241a; padding: 6px 8px; margin: 8px 0; font-weight: 600; }
  .nota { border-left: 3px solid #d3d0c6; padding: 4px 10px; margin: 6px 0; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 44px; }
  .firma { border-top: 1px solid #14140f; padding-top: 4px; text-align: center; font-size: 8.5pt; }
  .pie { margin-top: 20px; font-size: 7.5pt; color: #6d6c62; border-top: 1px solid #d3d0c6; padding-top: 6px; }
  .item { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; align-items: start; padding: 4px 0; border-bottom: 1px dotted #d3d0c6; break-inside: avoid; }
  .item .o { display: flex; gap: 8px; font-size: 8pt; white-space: nowrap; }
  .caja { display: inline-block; width: 11px; height: 11px; border: 1px solid #14140f; vertical-align: -1px; margin-right: 3px; }
  .grupo { break-inside: avoid; padding: 5px 0; border-bottom: 1px dotted #d3d0c6; }
  .grupo .op { padding-left: 26px; font-size: 9pt; }
  .qrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .qr { border: 1px solid #14140f; padding: 8px; text-align: center; break-inside: avoid; font-size: 8.5pt; }
  .qr img { width: 118px; height: 118px; display: block; margin: 4px auto; }
  .qr .l { font: 7pt 'IBM Plex Mono', monospace; word-break: break-all; color: #45443c; }
  .salto { break-before: page; }
  svg text { font-family: 'Archivo', Arial, sans-serif; }
`

export function imprimir(d: Impreso) {
  const v = window.open('', '_blank', 'width=900,height=1000')
  if (!v) {
    alert('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio.')
    return
  }
  const p = d.paciente
  const conf = d.confidencial ? '<div class="conf">CONFIDENCIAL · USO EXCLUSIVO DE PSICOLOGÍA</div>' : ''
  v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title>
    <style>${ESTILO}</style></head><body>
    ${conf}
    <div class="cab"><img src="${logo}" alt=""><div><div class="u">Fuerza Armada de El Salvador · Destacamento Militar N° 1</div>
    <div class="t">${esc(d.titulo)}</div><div class="u">Sección de Sanidad · Psicología</div></div>
    <div class="f">${esc(d.folio ?? '')}<br>${fmtFecha(hoy())}</div></div>
    ${p ? `<div class="pac"><div><span class="r">Evaluado</span>${esc(`${p.grado ? `${p.grado} ` : ''}${p.nombre}`)}</div>
      <div><span class="r">N.º padrón</span>${esc(p.codigo ?? '—')}</div><div><span class="r">Edad</span>${p.edad ?? '—'}</div>
      <div><span class="r">Sección</span>${esc(p.seccion ?? '—')}</div></div>` : ''}
    ${d.cuerpo}
    ${d.pie ? `<div class="pie">${d.pie}</div>` : ''}
    ${conf ? `<div style="margin-top:14px">${conf}</div>` : ''}
    <script>window.onload=()=>{setTimeout(()=>{window.print()},350)}</script>
    </body></html>`)
  v.document.close()
}
