-- ============================================================
-- VoteSecure - 009_foto_y_reenvio_verificacion.sql
-- Dos funciones SECURITY DEFINER acotadas, mismo patron que 008:
-- el rol API NO obtiene UPDATE sobre usuarios (solo escribe por
-- funciones), y toda funcion nueva revoca EXECUTE a PUBLIC, anon,
-- authenticated y service_role.
--   * actualizar_foto_usuario: foto de perfil en base64 (data URL
--     JPEG, tope 90 000 caracteres) o NULL para borrarla.
--   * regenerar_verificacion: rota el token de verificacion de una
--     cuenta aun no verificada. Con cooldown de 60 s en la BD para
--     que el reenvio no pueda usarse como spamer de correos.
-- Aprobado por el usuario del proyecto (plan 2026-11-25).
-- ============================================================

BEGIN;

ALTER TABLE usuarios ADD COLUMN foto text;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_foto_formato CHECK (
    foto IS NULL
    OR (
        foto ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$'
        AND length(foto) <= 90000
    )
);

-- Guarda o borra (p_foto = NULL) la foto del propio usuario.
-- La validacion del formato y del tamano vive en la aplicacion y en
-- el CHECK de la columna; aqui solo se acota la propiedad del dato.
CREATE FUNCTION actualizar_foto_usuario(
    p_usuario_id bigint,
    p_foto text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_foto IS NOT NULL AND NOT (
        p_foto ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$'
        AND length(p_foto) <= 90000
    ) THEN
        RAISE EXCEPTION 'Foto invalida: se requiere un JPEG en base64 de hasta 90000 caracteres';
    END IF;
    UPDATE usuarios SET foto = p_foto WHERE id = p_usuario_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario inexistente';
    END IF;
END;
$$;

-- Rota el token de verificacion. Devuelve true si rotó el token;
-- false si la cuenta no existe, ya esta verificada, esta inactiva
-- o el token vigente se emitió hace menos de 60 s (cooldown).
CREATE FUNCTION regenerar_verificacion(
    p_correo varchar,
    p_hash bytea,
    p_expira timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_hash IS NULL OR octet_length(p_hash) <> 32 OR p_expira IS NULL THEN
        RAISE EXCEPTION 'Se requiere hash de verificacion de 32 bytes y su expiracion';
    END IF;
    UPDATE usuarios
       SET verificacion_hash = p_hash,
           verificacion_expira_en = p_expira
     WHERE correo = lower(btrim(p_correo))
       AND activo
       AND correo_verificado_en IS NULL
       AND (verificacion_expira_en IS NULL
            OR verificacion_expira_en <= now() + interval '24 hours' - interval '60 seconds');
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_foto_usuario(bigint, text)
    TO votesecure_api;
GRANT EXECUTE ON FUNCTION regenerar_verificacion(varchar, bytea, timestamptz)
    TO votesecure_api;

-- Evita el EXECUTE implicito a PUBLIC y a los roles de Supabase.
REVOKE ALL ON FUNCTION actualizar_foto_usuario(bigint, text)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION regenerar_verificacion(varchar, bytea, timestamptz)
    FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
