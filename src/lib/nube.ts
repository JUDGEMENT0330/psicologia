import { createClient } from '@supabase/supabase-js'

// Proyecto Supabase de la clínica médica. La clave publicable no otorga acceso por
// sí sola —viaja siempre en el paquete del navegador—; toda la protección está
// en las políticas RLS de la base de datos. Se dejan como respaldo para que el
// despliegue funcione aunque falten las variables de entorno.
//
// Este archivo es el proveedor de datos de la versión web. La de escritorio usa
// `escritorio/cliente.ts` en su lugar (ver el alias `@datos` en vite.config.ts):
// allí no hay nube, los expedientes viven en el equipo.
const URL_POR_DEFECTO = 'https://rqbktclippbypchkilgw.supabase.co'
const CLAVE_POR_DEFECTO = 'sb_publishable_HFJg34abdmHW07n4WAq7qw_nark7uDu'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || URL_POR_DEFECTO
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || CLAVE_POR_DEFECTO

export const cliente = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
