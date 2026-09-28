-- ============================================================================
-- 30 · ROLES DE PSICOLOGÍA
-- ----------------------------------------------------------------------------
-- Dos roles nuevos en el tipo compartido `rol_usuario`. Va en una migración
-- propia porque PostgreSQL no deja USAR un valor de enum en la misma
-- transacción que lo añade.
--
--   psicologo   Ve y escribe todo lo psicológico con nombre y apellido:
--               baterías, instrumentos, aplicaciones, resultados y notas.
--               En medicina general y odontología es de sólo lectura
--               (`puede_editar()` no lo incluye).
--   comandante  Mismas limitaciones que el jefe de la S-4 dentro de
--               psicología: sólo estadísticas agregadas, nunca nombres.
--
-- Es aditiva: no cambia ni el significado de los roles existentes ni las
-- funciones `mi_rol`, `puede_editar`, `es_admin` o `es_clinico`.
-- ============================================================================

alter type rol_usuario add value if not exists 'psicologo';
alter type rol_usuario add value if not exists 'comandante';
