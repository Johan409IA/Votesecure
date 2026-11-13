-- ============================================================
-- VoteSecure - 008_gestion_usuarios.sql
-- F-009 (review de backend 2026-11-12): gestion de cuentas desde la API.
-- Dos funciones SECURITY DEFINER acotadas: el rol API NO obtiene UPDATE
-- sobre usuarios (mismo patron que crear_usuario), y toda funcion nueva
-- revoca EXECUTE a PUBLIC, anon, authenticated y service_role.
-- Los cambios dejan rastro: el trigger usuarios_normalizar_y_proteger
-- revoca la sesion al desactivar, y cambiar_contrasena invalida la sesion.
-- Aprobado por el DBA del proyecto. No modificar sin nueva aprobacion.
-- ============================================================

BEGIN;

-- Desactiva (o reactiva) una cuenta. El trigger normalizar_y_proteger_usuario
-- revoca la sesion vigente al pasar a activo = false.
CREATE FUNCTION cambiar_estado_usuario(
    p_usuario_id bigint,
    p_activo boolean,
    p_admin_id bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin boolean;
BEGIN
    SELECT u.activo AND u.correo_verificado_en IS NOT NULL
       AND u.tipo_usuario = 'administrador'
      INTO v_admin
      FROM usuarios u WHERE u.id = p_admin_id;
    IF NOT coalesce(v_admin, false) THEN
        RAISE EXCEPTION 'Solo un administrador activo y verificado puede cambiar estados de cuenta';
    END IF;
    IF p_usuario_id = p_admin_id AND NOT p_activo THEN
        RAISE EXCEPTION 'Un administrador no puede desactivar su propia cuenta';
    END IF;
    UPDATE usuarios SET activo = p_activo WHERE id = p_usuario_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario inexistente';
    END IF;
END;
$$;

-- Cambia el hash de contrasena y invalida la sesion vigente (la verificacion
-- de la contrasena actual se hace en la aplicacion con Argon2id).
CREATE FUNCTION cambiar_contrasena(
    p_usuario_id bigint,
    p_hash_nueva varchar
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_hash_nueva IS NULL OR length(btrim(p_hash_nueva)) < 20 THEN
        RAISE EXCEPTION 'Hash de contrasena invalido';
    END IF;
    UPDATE usuarios
       SET hash_contrasena = p_hash_nueva,
           sesion_hash = NULL,
           sesion_expira_en = NULL,
           sesion_revocada_en = NULL
     WHERE id = p_usuario_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario inexistente';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION cambiar_estado_usuario(bigint, boolean, bigint)
    TO votesecure_api;
GRANT EXECUTE ON FUNCTION cambiar_contrasena(bigint, varchar)
    TO votesecure_api;

-- Evita el EXECUTE implicito a PUBLIC y a los roles de Supabase.
REVOKE ALL ON FUNCTION cambiar_estado_usuario(bigint, boolean, bigint)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION cambiar_contrasena(bigint, varchar)
    FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
