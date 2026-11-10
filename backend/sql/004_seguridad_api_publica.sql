-- ============================================================
-- VoteSecure - 004_seguridad_api_publica.sql
-- Cierra la exposicion de la Data API de Supabase sobre el esquema public.
-- Aprobado por el DBA del proyecto (nov 2026).
--
-- Problema: Supabase concede por defecto todos los privilegios sobre las
-- tablas/secuencias de public a anon y authenticated (roles de la Data API,
-- PostgREST) y EXECUTE en las funciones nuevas a anon/authenticated/
-- service_role. El proyecto nunca los revoco, asi que con la anon key
-- (publica por diseno) cualquiera podria leer usuarios (hashes Argon2),
-- borrar o alterar votos y ejecutar las funciones SECURITY DEFINER saltandose
-- las validaciones de negocio. Las 15 tablas quedan sin RLS por diseno: la
-- defensa es el modelo de roles minimos (002), no RLS.
--
-- Impacto: nulo para el backend, que nunca usa la Data API para datos; se
-- conecta con el rol votesecure_api (pooler) cuyos GRANT son explicitos y
-- no dependen de PUBLIC ni de los roles de Supabase. Realtime Broadcast
-- usa la API REST de Supabase, no privilegios de tablas.
-- ============================================================

BEGIN;

-- 1. Tablas y vistas (ALL TABLES incluye vistas como resumen_resultados_publicados).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Secuencias.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. Funciones: cubre las SECURITY DEFINER (confirmar_correo, registrar_voto,
--    activar_eleccion, cerrar_y_publicar_resultados, crear_usuario,
--    programar_eleccion, cancelar_eleccion, contar_votos_eleccion,
--    auditar_cambios_eleccion). votesecure_api conserva los GRANT explicitos
--    de 002 y 003.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public
    FROM PUBLIC, anon, authenticated, service_role;

-- 4. Default privileges: los objetos futuros (migraciones 005+) no vuelven a
--    heredar los privilegios de Supabase. Aplica al rol que ejecuta las
--    migraciones (postgres).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
