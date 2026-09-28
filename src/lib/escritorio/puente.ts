// Tipos del puente que expone el proceso principal de Electron (`preload.ts`).
// Si `window.dm1` no existe, la aplicación está corriendo en el navegador.

export interface Respuesta<T> {
  data: T | null
  error: { message: string } | null
}

export interface SesionLocal {
  perfilId: string
  correo: string
  nombre: string
  rol: string
  desde: string
  debeCambiar: boolean
}

export interface UsuarioLocal {
  id: string
  nombre_completo: string
  grado: string | null
  cargo: string | null
  rol: string
  activo: boolean
  correo: string
  creado_en: string
  ultimo_ingreso: string | null
  debe_cambiar: boolean
  /** Retrato incrustado, o nulo si no tiene. */
  foto: string | null
}

export interface Puente {
  version: string
  estado(): Promise<Respuesta<{ hayUsuarios: boolean; sesion: SesionLocal | null }>>
  entrar(correo: string, contrasena: string): Promise<Respuesta<SesionLocal>>
  salir(): Promise<Respuesta<null>>
  crearPrimerAdmin(datos: Record<string, unknown>): Promise<Respuesta<SesionLocal>>
  consulta<T>(peticion: unknown): Promise<Respuesta<T>>
  usuarios(): Promise<Respuesta<UsuarioLocal[]>>
  crearUsuario(datos: Record<string, unknown>): Promise<Respuesta<null>>
  cambiarRol(id: string, rol: string): Promise<Respuesta<null>>
  activarUsuario(id: string, activo: boolean): Promise<Respuesta<null>>
  eliminarUsuario(id: string): Promise<Respuesta<null>>
  restablecerContrasena(id: string, clave: string): Promise<Respuesta<null>>
  cambiarMiContrasena(actual: string, nueva: string): Promise<Respuesta<null>>
  /** `id` nulo es «mi retrato»; el de otra cuenta sólo lo cambia administración. */
  guardarFoto(id: string | null, foto: string | null): Promise<Respuesta<null>>
  latido(): Promise<Respuesta<null>>
  bloquear(): Promise<Respuesta<null>>
  alCambiarSesion(cb: (estado: { sesion: SesionLocal | null; motivo: string }) => void): () => void
}

declare global {
  interface Window {
    dm1?: Puente
  }
}

/** El puente, o un error claro si se invoca fuera de la aplicación de escritorio. */
export function puente(): Puente {
  const p = typeof window !== 'undefined' ? window.dm1 : undefined
  if (!p) throw new Error('Esta función sólo existe en la versión de escritorio.')
  return p
}

export const EN_ESCRITORIO = typeof window !== 'undefined' && !!window.dm1

const MOTIVO_BLOQUEO = 'dm1-bloqueo-inactividad'

/** Deja constancia de que la sesión se cerró sola, para explicarlo al volver. */
export function anotarBloqueo() {
  sessionStorage.setItem(MOTIVO_BLOQUEO, '1')
}

/** Consume ese aviso: la pantalla de acceso lo muestra una sola vez. */
export function huboBloqueoPorInactividad(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const hubo = sessionStorage.getItem(MOTIVO_BLOQUEO) === '1'
  if (hubo) sessionStorage.removeItem(MOTIVO_BLOQUEO)
  return hubo
}
