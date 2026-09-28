// Proveedor de datos de la aplicación. El alias `@datos` lo resuelve Vite
// según el objetivo de la compilación (ver vite.config.ts):
//
//   web        → src/lib/nube.ts             (Supabase, protegido por RLS)
//   escritorio → src/lib/escritorio/cliente.ts (SQLite local, sin red)
//
// Las pantallas clínicas no distinguen uno de otro: ambos hablan el mismo
// `from(...).select(...).eq(...)` y devuelven `{ data, error }`.
export { cliente as supabase } from '@datos'
