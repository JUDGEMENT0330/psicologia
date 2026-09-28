-- ============================================================================
-- 33 · AJUSTES DE SEGURIDAD (avisos del analizador de Supabase)
-- ----------------------------------------------------------------------------
-- · `ps_orden_nivel` con search_path fijo.
-- · El visitante anónimo sólo puede ejecutar las tres funciones del enlace
--   público. Las de apoyo (quién es psicóloga, quién ve estadísticas, nuevas
--   fichas) no le sirven de nada y se le retiran.
-- Los avisos que quedan sobre `ps_publico_*` son deliberados: esas funciones
-- EXISTEN para el anónimo y sólo actúan sobre la ficha que se les da.
-- ============================================================================

alter function public.ps_orden_nivel(text) set search_path = public;

revoke all on function public.ps_es_psicologo() from public, anon;
revoke all on function public.ps_ve_estadisticas() from public, anon;
revoke all on function public.ps_nuevo_token() from public, anon;
grant execute on function public.ps_es_psicologo() to authenticated;
grant execute on function public.ps_ve_estadisticas() to authenticated;
grant execute on function public.ps_nuevo_token() to authenticated;
