// ============================================================================
// CUENTAS — lo que cada quien hace con la suya
// ----------------------------------------------------------------------------
// Psicología no administra cuentas: el alta, el rol y el restablecimiento se
// hacen desde la consulta de medicina general (función `admin-cuentas`), que
// es donde vive la administración. Aquí sólo está lo propio: el retrato y la
// contraseña.
// ============================================================================

import { supabase } from './supabase'

interface Respuesta<T> {
  data: T | null
  error: { message: string } | null
}

export const cuentas = {
  /** El retrato propio. Las políticas de `perfiles` sólo dejan escribir el suyo. */
  guardarFoto: async (id: string | null, foto: string | null): Promise<Respuesta<null>> => {
    const { data: sesion } = await supabase.auth.getSession()
    const destino = id ?? sesion.session?.user.id
    if (!destino) return { data: null, error: { message: 'La sesión expiró. Vuelva a entrar.' } }
    const { error } = await supabase.from('perfiles').update({ foto }).eq('id', destino)
    return error ? { data: null, error: { message: error.message } } : { data: null, error: null }
  },

  /** La propia contraseña: se revalida la actual antes de cambiarla. */
  cambiarMiContrasena: async (actual: string, nueva: string): Promise<Respuesta<null>> => {
    const { data: sesion } = await supabase.auth.getSession()
    const correo = sesion.session?.user.email
    if (!correo) return { data: null, error: { message: 'La sesión expiró. Vuelva a entrar.' } }
    const { error: eActual } = await supabase.auth.signInWithPassword({ email: correo, password: actual })
    if (eActual) return { data: null, error: { message: 'La contraseña actual no es correcta.' } }
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) return { data: null, error: { message: error.message } }
    await supabase.from('perfiles').update({ debe_cambiar_clave: false }).eq('id', sesion.session!.user.id)
    return { data: null, error: null }
  },
}
