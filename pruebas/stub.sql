-- Esquema mínimo que imita lo compartido de Supabase (perfiles, pacientes, mi_rol, auth.uid)
-- para correr las migraciones 30–33 en un PostgreSQL local.
do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema extensions; create extension pgcrypto schema extensions;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
create type rol_usuario as enum ('admin_medico','admin_s4','asistente','lectura');
create table perfiles (id uuid primary key, nombre_completo text, rol rol_usuario, activo boolean default true);
create table pacientes (id uuid primary key default gen_random_uuid(), codigo text, grado text, nombre_completo text, seccion text, estado text default 'activo');
create function mi_rol() returns rol_usuario language sql stable security definer set search_path = public as $$ select rol from public.perfiles where id = auth.uid() and activo $$;
grant usage on schema public to anon, authenticated;
grant select on pacientes, perfiles to authenticated;
