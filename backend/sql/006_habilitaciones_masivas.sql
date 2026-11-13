-- ============================================================
-- VoteSecure - 006_habilitaciones_masivas.sql
-- §3.2 (Integridad del Padron): al activar la eleccion, la base de
-- datos genera masivamente los registros en habilitaciones_voto a
-- partir de las matriculas activas registradas hasta ese instante;
-- el padron queda congelado al pasar a 'activa'. Aprobado por el DBA
-- del proyecto.
--
-- Solo se habilita a estudiantes con matricula activa, usuario activo
-- y correo verificado (§2.1): quien no acredito su correo no emite
-- votos. Las habilitaciones ya configuradas por la ruta complementaria
-- se conservan (ON CONFLICT DO NOTHING).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION activar_eleccion(p_eleccion_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
    v_esperados bigint;
    v_actuales bigint;
    v_maximo bigint;
BEGIN
    SELECT * INTO v_eleccion FROM elecciones WHERE id = p_eleccion_id FOR UPDATE;
    IF NOT FOUND OR v_eleccion.estado <> 'programada'
       OR clock_timestamp() < v_eleccion.inicia_en
       OR clock_timestamp() >= v_eleccion.cierra_en THEN
        RAISE EXCEPTION 'La eleccion no puede activarse en este momento';
    END IF;
    SELECT count(*) INTO v_actuales FROM candidaturas WHERE eleccion_id = p_eleccion_id;
    -- §3.2: congelamiento del padron. La insercion ocurre mientras la
    -- eleccion sigue en 'programada', de modo que el trigger
    -- controlar_configuracion_electoral la permite y a partir de aqui
    -- veta toda mutacion de candidaturas y habilitaciones.
    INSERT INTO habilitaciones_voto (eleccion_id, seccion_id, matricula_id)
    SELECT p_eleccion_id, m.seccion_id, m.id
      FROM matriculas m
      JOIN usuarios u ON u.id = m.estudiante_id
     WHERE m.seccion_id = v_eleccion.seccion_id
       AND m.activa
       AND u.tipo_usuario = 'estudiante'
       AND u.activo
       AND u.correo_verificado_en IS NOT NULL
    ON CONFLICT (eleccion_id, matricula_id) DO NOTHING;
    IF v_actuales = 0 OR NOT EXISTS (
        SELECT 1 FROM habilitaciones_voto WHERE eleccion_id = p_eleccion_id
    ) THEN
        RAISE EXCEPTION 'Se requieren candidaturas y votantes habilitados';
    END IF;
    IF EXISTS (
        SELECT 1 FROM candidaturas c
        JOIN matriculas m ON m.id = c.matricula_id
        JOIN usuarios u ON u.id = m.estudiante_id
        WHERE c.eleccion_id = p_eleccion_id
          AND (NOT m.activa OR NOT u.activo OR u.correo_verificado_en IS NULL)
    ) OR EXISTS (
        SELECT 1 FROM habilitaciones_voto h
        JOIN matriculas m ON m.id = h.matricula_id
        JOIN usuarios u ON u.id = m.estudiante_id
        WHERE h.eleccion_id = p_eleccion_id
          AND (NOT m.activa OR NOT u.activo OR u.correo_verificado_en IS NULL)
    ) THEN
        RAISE EXCEPTION 'Candidatos y votantes deben estar activos y verificados';
    END IF;
    IF v_eleccion.tipo <> 'principal'
       AND NOT (v_eleccion.tipo = 'repeticion' AND EXISTS (
           SELECT 1 FROM elecciones origen
           WHERE origen.id = v_eleccion.eleccion_origen_id
             AND origen.estado = 'cancelada')) THEN
        IF v_eleccion.tipo = 'desempate' THEN
            SELECT max(votos_obtenidos) INTO v_maximo FROM resultados_candidatos
             WHERE eleccion_id = v_eleccion.eleccion_origen_id;
            SELECT count(*) INTO v_esperados FROM resultados_candidatos
             WHERE eleccion_id = v_eleccion.eleccion_origen_id
               AND votos_obtenidos = v_maximo;
        ELSE
            SELECT count(*) INTO v_esperados FROM candidaturas
             WHERE eleccion_id = v_eleccion.eleccion_origen_id;
        END IF;
        IF v_actuales <> v_esperados THEN
            RAISE EXCEPTION 'La eleccion derivada debe incluir todos los candidatos correspondientes';
        END IF;
    END IF;
    UPDATE elecciones SET estado = 'activa' WHERE id = p_eleccion_id;
    INSERT INTO eventos_auditoria (eleccion_id, tipo_evento, actor_tipo)
    VALUES (p_eleccion_id, 'activacion', 'sistema');
END;
$$;

-- La funcion se reemplaza con la misma firma: conserva los grants de 002.
-- Se reafirma el bloqueo de EXECUTE a los roles publicos de Supabase por
-- consistencia con las migraciones anteriores.
REVOKE ALL ON FUNCTION activar_eleccion(bigint)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION activar_eleccion(bigint) TO votesecure_api;

COMMIT;
