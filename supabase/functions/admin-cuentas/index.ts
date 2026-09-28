// ============================================================================
// ADMIN-CUENTAS — alta y administración de usuarios desde la web
// ----------------------------------------------------------------------------
// POR QUÉ EXISTE
//
// Crear una cuenta exige la clave de servicio de Supabase, y esa clave NO puede
// viajar al navegador: quien la tenga lee y escribe el expediente de todos
// saltándose las políticas RLS. En el sistema odontológico eso se resolvió no
// resolviéndolo —las cuentas se creaban a mano desde el panel de Supabase y la
// pantalla de usuarios sólo existía en la versión de escritorio—, y el
// resultado fue el previsible: nadie podía dar de alta a nadie.
//
// Aquí la clave de servicio vive sólo en el servidor, dentro de esta función.
// El navegador manda la sesión de quien pide; la función comprueba CONTRA LA
// BASE que esa persona sea administradora y recién entonces actúa.
//
// Desplegar:  supabase functions deploy admin-cuentas
// Requiere:   SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
//             (las tres las inyecta Supabase en el entorno de la función).
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['admin_medico', 'admin_s4', 'asistente', 'lectura', 'psicologo', 'comandante']
const ROLES_ADMIN = ['admin_medico', 'admin_s4']
// Roles que ven lo clínico reservado (ITS). Sólo `admin_medico` los asigna y
// sólo él administra a quien ya los tiene: si no, `admin_s4` podía darse acceso
// clínico creando un asistente, o restablecer la clave de un médico y entrar
// con su cuenta.
//
// `psicologo` entra aquí por lo mismo: es la única cuenta que ve resultados
// psicológicos con nombre. Si `admin_s4` pudiera restablecer su clave, entraría
// como la psicóloga y se saltaría la regla de «S-4 sólo estadísticas».
// `comandante` también: su cuenta no la administra un subordinado.
const ROLES_CLINICOS = ['admin_medico', 'asistente', 'psicologo', 'comandante']

/** Mínimo de la contraseña inicial. Se entrega en persona y se cambia al entrar. */
function claveValida(c: unknown): string | null {
  if (typeof c !== 'string' || c.length < 12) return 'La contraseña debe tener al menos 12 caracteres.'
  if (!/[a-z]/.test(c) || !/[A-Z]/.test(c) || !/\d/.test(c)) {
    return 'La contraseña debe llevar mayúscula, minúscula y cifra.'
  }
  return null
}

const responde = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const error = (mensaje: string, status = 400) => responde({ data: null, error: { message: mensaje } }, status)

/** Fallo interno: el detalle va al registro de la función, no al navegador. */
const fallo = (e: unknown) => {
  console.error(e)
  return error('Error inesperado en el servidor.', 500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('Método no admitido.', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const admin0 = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } })

  // --- 0. arranque en frío -------------------------------------------------
  // Sin esto no hay forma de empezar: para crear una cuenta hace falta ser
  // administrador, y para ser administrador hace falta una cuenta. La puerta se
  // abre SÓLO mientras no exista ni un perfil, y se cierra sola en cuanto hay
  // uno. Es el mismo trato que en la versión de escritorio, donde el primer
  // administrador se crea en la pantalla de acceso del equipo recién instalado.
  const { count: cuantos } = await admin0.from('perfiles').select('id', { count: 'exact', head: true })
  const enFrio = (cuantos ?? 0) === 0

  // Consulta sin sesión: la pantalla de acceso necesita saber si hay que crear
  // al primer administrador. No revela nada más que un sí o un no.
  let cuerpoPrevio: Record<string, unknown> = {}
  try { cuerpoPrevio = await req.clone().json() } catch { /* se valida más abajo */ }
  if (cuerpoPrevio.accion === 'estado') return responde({ data: { hayUsuarios: !enFrio }, error: null })

  // --- 1. quién pide -------------------------------------------------------
  const autorizacion = req.headers.get('Authorization') ?? ''
  if (!enFrio && !autorizacion.startsWith('Bearer ')) return error('Sesión no enviada.', 401)

  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: autorizacion } } })
  const { data: sesion } = await comoUsuario.auth.getUser()
  if (!enFrio && !sesion?.user) return error('Sesión no válida o expirada.', 401)
  const quienPide = sesion?.user?.id ?? null
  let rolQuienPide: string | null = null

  // --- 2. si puede -------------------------------------------------------
  // Se lee con la sesión de quien pide, no con la clave de servicio: si sus
  // políticas no le dejan verse a sí mismo, tampoco debe poder administrar.
  if (!enFrio) {
    const { data: perfil } = await comoUsuario
      .from('perfiles').select('rol, activo').eq('id', quienPide!).maybeSingle()

    if (!perfil) return error('Su cuenta no tiene perfil asignado. Avise a la administración.', 403)
    if (!perfil.activo) return error('La cuenta está inactiva.', 403)
    if (!ROLES_ADMIN.includes(perfil.rol)) return error('Sólo la administración puede administrar cuentas.', 403)
    rolQuienPide = perfil.rol
  }
  const esMedico = enFrio || rolQuienPide === 'admin_medico'

  // --- 3. qué pide -------------------------------------------------------
  let cuerpo: Record<string, unknown>
  try { cuerpo = await req.json() } catch { return error('Petición ilegible.') }
  const accion = String(cuerpo.accion ?? '')

  const admin = admin0
  const auditar = (que: string, sobre: string, detalle: Record<string, unknown> = {}) =>
    admin.from('auditoria').insert({
      perfil_id: quienPide, accion: que, tabla: 'perfiles', fila_id: sobre,
      detalle: enFrio ? { ...detalle, arranque_en_frio: true } : detalle,
    })

  // En frío lo único que se admite es crear al primer administrador.
  if (enFrio && accion !== 'crear') return error('Todavía no hay ninguna cuenta en el sistema.', 403)

  /** ¿Puede quien pide tocar la cuenta `id`? Las cuentas clínicas, sólo el médico. */
  const alcanza = async (id: string): Promise<Response | null> => {
    if (!id) return error('Falta la cuenta.')
    if (esMedico) return null
    const { data: destino, error: e } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (e) return fallo(e)
    if (!destino) return error('La cuenta no existe.', 404)
    if (ROLES_CLINICOS.includes(destino.rol)) return error('Sólo el administrador médico puede administrar cuentas clínicas.', 403)
    return null
  }
  const asignable = (rol: string) =>
    !ROLES.includes(rol) ? 'Rol desconocido.'
      : !esMedico && ROLES_CLINICOS.includes(rol) ? 'Sólo el administrador médico puede asignar roles clínicos.'
        : null

  try {
    switch (accion) {
      // ------------------------------------------------------------ listar
      case 'listar': {
        const { data, error: e } = await admin
          .from('perfiles')
          .select('id, nombre_completo, grado, cargo, rol, activo, correo, creado_en, ultimo_ingreso, foto')
          .order('nombre_completo')
        if (e) return fallo(e)
        return responde({ data, error: null })
      }

      // ------------------------------------------------------------- crear
      case 'crear': {
        const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
        const nombre = String(cuerpo.nombre_completo ?? '').trim()
        // La primera cuenta es administradora por definición: si naciera con
        // rol de lectura, nadie podría elevarla después.
        const rol = enFrio ? 'admin_medico' : String(cuerpo.rol ?? 'lectura')
        if (!correo || !nombre) return error('Nombre y correo son obligatorios.')
        const rolMalo = asignable(rol)
        if (rolMalo) return error(rolMalo, rolMalo === 'Rol desconocido.' ? 400 : 403)
        const malaClave = claveValida(cuerpo.contrasena)
        if (malaClave) return error(malaClave)

        const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
          email: correo,
          password: String(cuerpo.contrasena),
          email_confirm: true,          // correo interno: no hay buzón que confirmar
          user_metadata: { nombre_completo: nombre },
        })
        if (eCrear) {
          const ya = /already|exists|registered/i.test(eCrear.message)
          if (ya) return error('Ya existe una cuenta con ese correo.')
          return /password|email/i.test(eCrear.message) ? error(eCrear.message) : fallo(eCrear)
        }

        // `upsert`, no `insert`: el disparador `t_auth_nuevo_usuario` ya creó
        // el perfil (con rol de lectura) al nacer el usuario en auth. Un insert
        // chocaba con esa fila, devolvía 500 y la cuenta recién creada se borraba.
        const { error: ePerfil } = await admin.from('perfiles').upsert({
          id: creado.user.id, nombre_completo: nombre, correo,
          grado: cuerpo.grado || null, cargo: cuerpo.cargo || null,
          rol, activo: true, debe_cambiar_clave: true,
        }, { onConflict: 'id' })
        if (ePerfil) {
          // Sin perfil la cuenta no sirve para nada y quedaría suelta en auth.
          await admin.auth.admin.deleteUser(creado.user.id)
          return fallo(ePerfil)
        }
        await auditar('crear_cuenta', creado.user.id, { correo, rol })
        return responde({ data: { id: creado.user.id }, error: null })
      }

      // ---------------------------------------------------------- rol/alta
      case 'cambiar_rol': {
        const id = String(cuerpo.id ?? '')
        const rol = String(cuerpo.rol ?? '')
        const rolMalo = asignable(rol)
        if (rolMalo) return error(rolMalo, rolMalo === 'Rol desconocido.' ? 400 : 403)
        if (id === quienPide) return error('No puede cambiarse el rol a sí mismo.')
        const fuera = await alcanza(id)
        if (fuera) return fuera
        const { error: e } = await admin.from('perfiles').update({ rol }).eq('id', id)
        if (e) return fallo(e)
        await auditar('cambiar_rol', id, { rol })
        return responde({ data: null, error: null })
      }

      case 'activar': {
        const id = String(cuerpo.id ?? '')
        const activo = !!cuerpo.activo
        if (id === quienPide) return error('No puede desactivarse a sí mismo.')
        const fuera = await alcanza(id)
        if (fuera) return fuera
        const { error: e } = await admin.from('perfiles').update({ activo }).eq('id', id)
        if (e) return fallo(e)
        // Sin sesiones abiertas: desactivar tiene que surtir efecto ya, no al caducar el token.
        if (!activo) await admin.auth.admin.signOut(id, 'global').catch(() => {})
        await auditar(activo ? 'activar_cuenta' : 'desactivar_cuenta', id)
        return responde({ data: null, error: null })
      }

      // ------------------------------------------------------ contraseñas
      case 'restablecer': {
        const id = String(cuerpo.id ?? '')
        const malaClave = claveValida(cuerpo.contrasena)
        if (malaClave) return error(malaClave)
        const fuera = await alcanza(id)
        if (fuera) return fuera
        const { error: e } = await admin.auth.admin.updateUserById(id, { password: String(cuerpo.contrasena) })
        if (e) return fallo(e)
        await admin.from('perfiles').update({ debe_cambiar_clave: true }).eq('id', id)
        await auditar('restablecer_clave', id)
        return responde({ data: null, error: null })
      }

      // ---------------------------------------------------------- eliminar
      case 'eliminar': {
        const id = String(cuerpo.id ?? '')
        if (id === quienPide) return error('No puede eliminarse a sí mismo.')
        const fuera = await alcanza(id)
        if (fuera) return fuera
        // El historial clínico NO se borra: las consultas guardan quién las
        // registró y esa columna queda en nulo, no se lleva el expediente.
        const { error: e } = await admin.auth.admin.deleteUser(id)
        if (e) return fallo(e)
        await auditar('eliminar_cuenta', id)
        return responde({ data: null, error: null })
      }

      default:
        return error('Acción desconocida.')
    }
  } catch (e) {
    return fallo(e)
  }
})
