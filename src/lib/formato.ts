// ============================================================================
// FORMATO — fechas, rótulos y catálogos de psicología
// ----------------------------------------------------------------------------
// Un solo sitio para que «post-incidente» no se escriba de tres maneras y el
// nivel «moderado» tenga siempre el mismo color.
// ============================================================================

import type { EstadoAplicacion, Nivel, TipoEvaluacion, TipoNota } from './tipos'

// ---------------------------------------------------------------- fechas --

/** Fecha local de hoy (AAAA-MM-DD). No `toISOString`: en El Salvador, a las
 *  seis de la tarde UTC ya es mañana. */
export function hoy(): string {
  return fechaLocal(new Date())
}

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return fechaLocal(new Date(a, m - 1, d + dias))
}

/** Acepta fecha o marca de tiempo; las marcas se leen en hora local. */
export function fmtFecha(f?: string | null): string {
  if (!f) return '—'
  const iso = f.length > 10 ? fechaLocal(new Date(f)) : f
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function fmtFechaHora(f?: string | null): string {
  if (!f) return '—'
  const d = new Date(f)
  return `${fmtFecha(f)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fmtMes(f: string): string {
  const [a, m] = f.slice(0, 7).split('-').map(Number)
  return `${MESES[m - 1]} ${String(a).slice(2)}`
}

export function edad(nacimiento?: string | null, registrada?: number | null): number | null {
  if (!nacimiento) return registrada ?? null
  const [a, m, d] = nacimiento.split('-').map(Number)
  const h = new Date()
  let e = h.getFullYear() - a
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) e--
  return e
}

// ---------------------------------------------------------------- rótulos --

export const NOMBRES_ROL: Record<string, string> = {
  admin_medico: 'Clínico · admin',
  admin_s4: 'Jefe S-4 · estadística',
  asistente: 'Asistente',
  lectura: 'Solo lectura',
  psicologo: 'Psicología',
  comandante: 'Comandante · estadística',
}

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  normal: 'Normal',
  leve: 'Leve',
  moderado: 'Moderado',
  severo: 'Severo',
  critico: 'Crítico',
}

/** Colores literales para gráficas y el mapa cerebral (no dependen del tema). */
export const COLOR_NIVEL: Record<Nivel, string> = {
  normal: '#3f8a63',
  leve: '#4a73d6',
  moderado: '#c98a14',
  severo: '#d24a3c',
  critico: '#a3161a',
}

export const ORDEN_NIVEL: Nivel[] = ['normal', 'leve', 'moderado', 'severo', 'critico']

export const TIPOS_EVALUACION: Record<TipoEvaluacion, string> = {
  ingreso: 'Ingreso',
  periodica: 'Periódica',
  post_incidente: 'Post-incidente',
  seguimiento: 'Seguimiento',
  seleccion: 'Selección',
  egreso: 'Egreso',
  otro: 'Otra',
}

export const ESTADOS_APLICACION: Record<EstadoAplicacion, { etiqueta: string; tono: 'neutro' | 'azul' | 'verde' | 'rojo' }> = {
  pendiente: { etiqueta: 'Pendiente', tono: 'neutro' },
  en_curso: { etiqueta: 'En curso', tono: 'azul' },
  completada: { etiqueta: 'Completada', tono: 'verde' },
  anulada: { etiqueta: 'Anulada', tono: 'rojo' },
}

export const TIPOS_NOTA: Record<TipoNota, string> = {
  entrevista: 'Entrevista',
  seguimiento: 'Seguimiento',
  intervencion: 'Intervención',
  devolucion: 'Devolución de resultados',
  referencia: 'Referencia',
  otro: 'Otra',
}

export const ESCOLARIDAD = [
  'Básica incompleta', 'Básica completa', 'Bachillerato', 'Técnico', 'Universitaria incompleta',
  'Universitaria completa', 'Posgrado',
]

export const ESTADO_CIVIL = ['Soltero(a)', 'Casado(a)', 'Acompañado(a)', 'Divorciado(a)', 'Viudo(a)']

// ------------------------------------------------------------------ enlaces --

/** Dirección pública de un enlace de evaluación, apta para compartir. */
export function enlaceEvaluacion(token: string): string {
  return `${window.location.origin}/e/${token}`
}
