// ============================================================================
// TIPOS
// ----------------------------------------------------------------------------
// Dos grupos:
//
//   · Los COMPARTIDOS con medicina general y odontología —perfiles y padrón—:
//     son las mismas tablas del mismo proyecto de Supabase. Psicología no lee
//     ninguna otra tabla clínica.
//   · Los PROPIOS de psicología, en las tablas `ps_*`
//     (supabase/migraciones/31_psicologia.sql).
//
// Los campos son exactamente los de la base.
// ============================================================================

export type Rol = 'admin_medico' | 'admin_s4' | 'asistente' | 'lectura' | 'psicologo' | 'comandante'

// ------------------------------------------------------------- compartidos --

export interface Perfil {
  id: string
  nombre_completo: string
  grado: string | null
  cargo: string | null
  rol: Rol
  activo: boolean
  debe_cambiar_clave?: boolean
  foto?: string | null
}

export interface Paciente {
  id: string
  codigo: string | null
  grado: string | null
  nombre_completo: string
  sexo: 'M' | 'F' | null
  cargo: string | null
  seccion: string | null
  ubicacion: string | null
  fecha_nacimiento: string | null
  edad_registrada: number | null
  telefono: string | null
  estado: 'activo' | 'baja' | 'trasladado' | 'licencia'
}

export type PacienteBreve = Pick<Paciente, 'id' | 'codigo' | 'grado' | 'nombre_completo'> &
  Partial<Pick<Paciente, 'seccion' | 'ubicacion' | 'estado' | 'sexo' | 'cargo'>>

// ---------------------------------------------------------------- propios --

export type Nivel = 'normal' | 'leve' | 'moderado' | 'severo' | 'critico'
export type NivelHallazgo = Exclude<Nivel, 'normal'>

export interface Opcion {
  valor: number
  texto: string
  /** Rótulo visible en la hoja (p. ej. «1a» en el BDI-II). */
  rotulo?: string
}

export interface Item {
  n: number
  texto: string
  grupo?: string
  opciones?: Opcion[]
}

export interface Rango {
  desde?: number
  hasta?: number
  nivel: Nivel
  etiqueta?: string
  problema?: string
}

export interface Escala {
  clave: string
  nombre: string
  items?: 'todos' | number[]
  invertidos?: number[]
  clave_v?: number[]
  clave_f?: number[]
  suma_k?: { escala: string; factor: number; redondeo?: 'techo' | 'normal' }
  t?: { media: number; de: number }
  usa?: 'bruta' | 't'
  rangos?: Rango[]
  validez?: boolean
}

export interface Alerta {
  item: number
  minimo: number
  nivel?: NivelHallazgo
  problema?: string
  mensaje: string
}

export interface Definicion {
  opciones?: Opcion[]
  items: Item[]
  escalas: Escala[]
  alertas?: Alerta[]
}

export interface Instrumento {
  clave: string
  nombre: string
  sigla: string | null
  autores: string | null
  descripcion: string | null
  instrucciones: string | null
  definicion: Definicion
  activo: boolean
  orden: number
  version: number
  actualizado_en: string
}

export interface Bateria {
  id: string
  nombre: string
  descripcion: string | null
  instrucciones: string | null
  consentimiento: string | null
  instrumentos: string[]
  mostrar_resultado: boolean
  pedir_contexto: boolean
  activa: boolean
  creado_en: string
}

export type TipoEvaluacion = 'ingreso' | 'periodica' | 'post_incidente' | 'seguimiento' | 'seleccion' | 'egreso' | 'otro'

export interface Convocatoria {
  id: string
  nombre: string
  tipo: TipoEvaluacion
  bateria_id: string
  descripcion: string | null
  cohorte: string | null
  filtro: { secciones?: string[]; ubicaciones?: string[] } | null
  abre_en: string
  cierra_en: string | null
  estado: 'abierta' | 'cerrada'
  token_general: string
  permite_general: boolean
  pin: string
  intentos_fallidos: number
  creado_en: string
}

export type EstadoAplicacion = 'pendiente' | 'en_curso' | 'completada' | 'anulada'

export interface EscalaCalificada {
  clave: string
  nombre: string
  bruta: number
  t: number | null
  valor: number
  nivel: Nivel
  etiqueta: string | null
  problema: string | null
  validez: boolean
}

export interface AlertaCalificada extends Alerta {
  valor: number
}

export interface InstrumentoCalificado {
  instrumento: string
  nombre: string
  sigla: string | null
  version: number
  escalas: EscalaCalificada[]
  alertas: AlertaCalificada[]
  respondidos: number
  total: number
}

export interface Aplicacion {
  id: string
  convocatoria_id: string | null
  bateria_id: string
  paciente_id: string
  tipo: TipoEvaluacion
  token: string
  origen: 'individual' | 'cohorte' | 'presencial'
  identidad_confirmada: boolean
  estado: EstadoAplicacion
  vence_en: string | null
  iniciada_en: string | null
  completada_en: string | null
  respuestas: Record<string, Record<string, number>>
  contexto: { escolaridad?: string; estado_civil?: string; edad?: number; consentimiento?: string }
  resultados: { instrumentos: InstrumentoCalificado[] } | null
  calificada_en: string | null
  nivel_max: Nivel | null
  alerta: boolean
  validez_dudosa: boolean
  revisada: boolean
  revisada_en: string | null
  observaciones: string | null
  motivo_anulacion: string | null
  creado_en: string
}

export interface Problema {
  clave: string
  nombre: string
  descripcion: string | null
  regiones: number[]
  explicacion: string | null
  color: string
  orden: number
  activo: boolean
}

export interface Hallazgo {
  id: number
  aplicacion_id: string
  paciente_id: string
  instrumento: string
  escala: string
  problema: string | null
  nivel: NivelHallazgo
  puntaje: number | null
  etiqueta: string | null
  fecha: string
}

export type TipoNota = 'entrevista' | 'seguimiento' | 'intervencion' | 'devolucion' | 'referencia' | 'otro'

export interface Nota {
  id: string
  paciente_id: string
  aplicacion_id: string | null
  fecha: string
  tipo: TipoNota
  texto: string
  plan: string | null
  autor: string | null
  creado_en: string
}

/** Lo que devuelve `ps_estadisticas()`: cifras, nunca personas. */
export interface Estadisticas {
  generado: string
  minimo_grupo: number
  suficiente: boolean
  totales: {
    aplicaciones: number; pendientes: number; en_curso: number; completadas: number; evaluados: number
    con_hallazgo: number; con_alerta: number; validez_dudosa: number; sin_revisar: number
  }
  por_nivel?: Partial<Record<Nivel, number>>
  por_problema?: {
    problema: string; nombre: string; color: string; regiones: number[]
    personas: number; leve: number; moderado: number; severo: number; critico: number
  }[]
  por_instrumento?: {
    instrumento: string; nombre: string; escala: string; aplicados: number; promedio: number
    normal: number; leve: number; moderado: number; severo: number
  }[]
  por_seccion?: { seccion: string; evaluados: number; con_hallazgo: number }[]
  por_mes?: { mes: string; completadas: number; con_hallazgo: number }[]
  por_tipo?: Partial<Record<TipoEvaluacion, number>>
  convocatorias?: {
    id: string; nombre: string; tipo: TipoEvaluacion; estado: string; abre_en: string; cierra_en: string | null
    asignadas: number; completadas: number
  }[]
  regiones?: Record<string, number>
}
