// ============================================================================
// DATOS COMPARTIDOS ENTRE PANTALLAS
// ----------------------------------------------------------------------------
// Instrumentos, baterías y problemas cambian poco y los necesitan casi todas
// las pantallas: se piden una vez por sesión. `invalidar()` los vuelve a pedir
// cuando la psicóloga los edita.
// ============================================================================

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Bateria, Instrumento, PacienteBreve, Problema } from './tipos'

type Cache<T> = { valor: T | null; promesa: Promise<T> | null }
const instrumentos: Cache<Instrumento[]> = { valor: null, promesa: null }
const baterias: Cache<Bateria[]> = { valor: null, promesa: null }
const problemas: Cache<Problema[]> = { valor: null, promesa: null }

async function pedir<T>(c: Cache<T>, f: () => Promise<T>): Promise<T> {
  if (c.valor) return c.valor
  if (!c.promesa) c.promesa = f().then((v) => { c.valor = v; return v }).finally(() => { c.promesa = null })
  return c.promesa
}

export function cargarInstrumentos(): Promise<Instrumento[]> {
  return pedir(instrumentos, async () => {
    const { data, error } = await supabase.from('ps_instrumentos').select('*').order('orden').order('nombre')
    if (error) throw error
    return (data ?? []) as Instrumento[]
  })
}

export function cargarBaterias(): Promise<Bateria[]> {
  return pedir(baterias, async () => {
    const { data, error } = await supabase.from('ps_baterias').select('*').order('nombre')
    if (error) throw error
    return (data ?? []) as Bateria[]
  })
}

export function cargarProblemas(): Promise<Problema[]> {
  return pedir(problemas, async () => {
    const { data, error } = await supabase.from('ps_problemas').select('*').order('orden')
    if (error) throw error
    return (data ?? []) as Problema[]
  })
}

export function invalidar(que: 'instrumentos' | 'baterias' | 'problemas') {
  ;({ instrumentos, baterias, problemas })[que].valor = null
}

/** Hook de conveniencia: el valor, o nulo mientras llega. */
export function useCargado<T>(f: () => Promise<T>, deps: unknown[] = []): { datos: T | null; error: string | null } {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    f().then((d) => vivo && setDatos(d)).catch((e) => vivo && setError(e?.message ?? String(e)))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { datos, error }
}

const CAMPOS_BREVE = 'id, codigo, grado, nombre_completo, seccion, ubicacion, estado, sexo, cargo'

/** Pacientes por id, para las filas de listados globales. */
export async function pacientesPorId(ids: string[]): Promise<Record<string, PacienteBreve>> {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return {}
  const out: Record<string, PacienteBreve> = {}
  // Troceado: una URL con cientos de identificadores supera lo que admite el servidor.
  for (let i = 0; i < unicos.length; i += 150) {
    const { data } = await supabase.from('pacientes').select(CAMPOS_BREVE).in('id', unicos.slice(i, i + 150))
    for (const p of data ?? []) out[p.id] = p as PacienteBreve
  }
  return out
}

/** El padrón completo en forma breve (571 filas: se pide por páginas de mil). */
export async function padron(): Promise<PacienteBreve[]> {
  const { data, error } = await supabase.from('pacientes').select(CAMPOS_BREVE).order('nombre_completo').range(0, 4999)
  if (error) throw error
  return (data ?? []) as PacienteBreve[]
}

export const nombreDe = (p?: PacienteBreve | null) => (p ? `${p.grado ? `${p.grado} ` : ''}${p.nombre_completo}` : '—')

/** Sin tildes y en minúscula: en el padrón se escribe «Ramirez» y «Ramírez». */
export function plano(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
