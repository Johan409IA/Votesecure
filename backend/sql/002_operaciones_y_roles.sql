-- ============================================================
-- VoteSecure - 002_operaciones_y_roles.sql
-- Roles separados y operaciones privilegiadas sobre el esquema oficial.
-- Aprobado por el DBA del proyecto (decision documentada en docs/votesecure.md).
--
-- Roles (NOLOGIN, se usan con SET ROLE desde la conexion `postgres`):
--   * votesecure_migraciones : aplicacion del esquema y DDL.
--   * votesecure_api         : runtime del backend. Permisos minimos:
--       - sin lectura directa de filas de `votos`
--       - sin insercion directa en `eventos_auditoria`
--       - sin actualizacion directa del estado electoral
--   * votesecure_provisionamiento : unicamente para la CLI del primer administrador.
--
-- Hospedado en Supabase: la conexion runtime pasa por el pooler en modo
-- sesion; el rol se aplica con SET ROLE dentro de cada transaccion.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Roles
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'votesecure_migraciones') THEN
        CREATE ROLE votesecure_migraciones NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'votesecure_api') THEN
        CREATE ROLE votesecure_api NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'votesecure_provisionamiento') THEN
        CREATE ROLE votesecure_provisionamiento NOLOGIN;
    END IF;
END
$$;

-- `postgres` debe ser miembro para poder ejecutar SET ROLE.
GRANT votesecure_migraciones, votesecure_api, votesecure_provisionamiento TO postgres;
GRANT votesecure_migraciones TO votesecure_api;

-- ------------------------------------------------------------
-- 2. Permisos de esquema y secuencias (identity requiere USAGE)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO votesecure_api, votesecure_provisionamiento;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
    TO votesecure_api, votesecure_provisionamiento;

-- ------------------------------------------------------------
-- 3. Auditoria: solo las funciones SECURITY DEFINER escriben
--    eventos; el rol API no recibe INSERT sobre eventos_auditoria.
-- ------------------------------------------------------------
ALTER FUNCTION auditar_cambios_eleccion() SECURITY DEFINER;
ALTER FUNCTION auditar_cambios_eleccion() OWNER TO postgres;

-- ------------------------------------------------------------
-- 4. Lectura para el rol API
-- ------------------------------------------------------------
GRANT SELECT ON usuarios, secciones, matriculas, asignaciones_docentes,
    elecciones, candidaturas, habilitaciones_voto,
    resultados_electorales, resultados_candidatos, eventos_auditoria,
    delegaciones, periodos_evaluacion, evaluaciones_estudiantes,
    evaluaciones_docentes
TO votesecure_api;
GRANT SELECT ON resumen_resultados_publicados TO votesecure_api;

-- Sesiones: el API solo puede actualizar las columnas de sesion.
GRANT UPDATE (sesion_hash, sesion_expira_en, sesion_revocada_en)
    ON usuarios TO votesecure_api;

-- ------------------------------------------------------------
-- 5. Escritura para el rol API (sin votos, sin auditoria, sin estado)
-- ------------------------------------------------------------
GRANT INSERT, UPDATE, DELETE ON secciones, matriculas, asignaciones_docentes
    TO votesecure_api;
GRANT INSERT, DELETE ON candidaturas, habilitaciones_voto TO votesecure_api;
GRANT INSERT ON elecciones TO votesecure_api;
GRANT UPDATE (nombre, inicia_en, cierra_en) ON elecciones TO votesecure_api;
GRANT INSERT, UPDATE ON evaluaciones_estudiantes, evaluaciones_docentes,
    delegaciones, periodos_evaluacion TO votesecure_api;

-- ------------------------------------------------------------
-- 6. Funciones privilegiadas del rol API
-- ------------------------------------------------------------
CREATE FUNCTION crear_usuario(
    p_nombre varchar,
    p_correo varchar,
    p_tipo varchar,
    p_hash_contrasena varchar,
    p_verificacion_hash bytea,
    p_verificacion_expira timestamptz
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_id bigint;
BEGIN
    IF p_tipo = 'administrador' THEN
        RAISE EXCEPTION 'El rol administrador se asigna solo mediante aprovisionamiento autorizado';
    END IF;
    IF p_verificacion_hash IS NULL OR octet_length(p_verificacion_hash) <> 32
       OR p_verificacion_expira IS NULL THEN
        RAISE EXCEPTION 'Se requiere hash de verificacion de 32 bytes y su expiracion';
    END IF;
    INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena,
                          verificacion_hash, verificacion_expira_en)
    VALUES (btrim(p_nombre), lower(btrim(p_correo)), p_tipo, p_hash_contrasena,
            p_verificacion_hash, p_verificacion_expira)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE FUNCTION programar_eleccion(p_eleccion_id bigint, p_usuario_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_autorizado boolean;
    v_candidaturas bigint;
BEGIN
    SELECT u.activo AND u.correo_verificado_en IS NOT NULL
       AND (u.tipo_usuario = 'administrador'
            OR (u.tipo_usuario = 'docente' AND EXISTS (
                SELECT 1 FROM asignaciones_docentes a
                WHERE a.docente_id = u.id AND a.seccion_id = (
                    SELECT seccion_id FROM elecciones WHERE id = p_eleccion_id)
                  AND a.activa)))
      INTO v_autorizado
      FROM usuarios u WHERE u.id = p_usuario_id;
    IF NOT coalesce(v_autorizado, false) THEN
        RAISE EXCEPTION 'Solo un administrador o docente asignado y verificado puede programar';
    END IF;
    SELECT count(*) INTO v_candidaturas FROM candidaturas
     WHERE eleccion_id = p_eleccion_id;
    IF v_candidaturas < 2 THEN
        RAISE EXCEPTION 'Se requieren al menos dos candidaturas para programar';
    END IF;
    UPDATE elecciones SET estado = 'programada' WHERE id = p_eleccion_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eleccion inexistente';
    END IF;
END;
$$;

CREATE FUNCTION cancelar_eleccion(
    p_eleccion_id bigint,
    p_usuario_id bigint,
    p_motivo varchar
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_autorizado boolean;
BEGIN
    SELECT u.activo AND u.correo_verificado_en IS NOT NULL
       AND (u.tipo_usuario = 'administrador'
            OR (u.tipo_usuario = 'docente' AND EXISTS (
                SELECT 1 FROM asignaciones_docentes a
                WHERE a.docente_id = u.id AND a.seccion_id = (
                    SELECT seccion_id FROM elecciones WHERE id = p_eleccion_id)
                  AND a.activa)))
      INTO v_autorizado
      FROM usuarios u WHERE u.id = p_usuario_id;
    IF NOT coalesce(v_autorizado, false) THEN
        RAISE EXCEPTION 'Solo un administrador o docente asignado y verificado puede cancelar';
    END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
        RAISE EXCEPTION 'Se requiere un motivo de cancelacion';
    END IF;
    UPDATE elecciones
       SET estado = 'cancelada',
           cancelada_en = clock_timestamp(),
           cancelada_por_usuario_id = p_usuario_id,
           motivo_cancelacion = btrim(p_motivo)
     WHERE id = p_eleccion_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eleccion inexistente';
    END IF;
END;
$$;

-- Agregados exactos de resultados en vivo: el rol API no lee filas de votos.
CREATE FUNCTION contar_votos_eleccion(p_eleccion_id bigint)
RETURNS TABLE (candidatura_id bigint, votos bigint)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.id, count(v.id)::bigint
      FROM candidaturas c
      LEFT JOIN votos v
        ON v.candidatura_id = c.id AND v.eleccion_id = p_eleccion_id
     WHERE c.eleccion_id = p_eleccion_id
     GROUP BY c.id
$$;

-- ------------------------------------------------------------
-- 7. Ejecucion de funciones para el rol API
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION confirmar_correo(varchar, bytea) TO votesecure_api;
GRANT EXECUTE ON FUNCTION registrar_voto(bigint, bigint, bigint) TO votesecure_api;
GRANT EXECUTE ON FUNCTION activar_eleccion(bigint) TO votesecure_api;
GRANT EXECUTE ON FUNCTION cerrar_y_publicar_resultados(bigint) TO votesecure_api;
GRANT EXECUTE ON FUNCTION crear_usuario(varchar, varchar, varchar, varchar, bytea, timestamptz)
    TO votesecure_api;
GRANT EXECUTE ON FUNCTION programar_eleccion(bigint, bigint) TO votesecure_api;
GRANT EXECUTE ON FUNCTION cancelar_eleccion(bigint, bigint, varchar) TO votesecure_api;
GRANT EXECUTE ON FUNCTION contar_votos_eleccion(bigint) TO votesecure_api;

-- ------------------------------------------------------------
-- 8. Rol de aprovisionamiento (CLI del primer administrador)
-- ------------------------------------------------------------
GRANT SELECT, INSERT ON usuarios TO votesecure_provisionamiento;

-- Nada de acceso a datos electorales para aprovisionamiento.

-- Evita el EXECUTE implicito a PUBLIC en las funciones nuevas.
REVOKE ALL ON FUNCTION crear_usuario(varchar, varchar, varchar, varchar, bytea, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION programar_eleccion(bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancelar_eleccion(bigint, bigint, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION contar_votos_eleccion(bigint) FROM PUBLIC;

COMMIT;
