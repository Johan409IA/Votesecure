-- ============================================================
-- VoteSecure - 003_cierre_anticipado.sql
-- Permite el cierre manual anticipado de una eleccion (§6.1) sin
-- relajar la consistencia: el cierre sigue exigiendo participantes = votos.
-- Aprobado por el DBA del proyecto.
--
-- El planificador sigue llamando cerrar_y_publicar_resultados(id), que
-- conserva la regla de cierre por horario. El endpoint manual la invoca
-- con p_anticipado = true.
-- ============================================================

BEGIN;

DROP FUNCTION cerrar_y_publicar_resultados(bigint);

CREATE FUNCTION cerrar_y_publicar_resultados(
    p_eleccion_id bigint,
    p_anticipado boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
    v_habilitados bigint;
    v_participantes bigint;
    v_votos bigint;
    v_ahora timestamptz;
BEGIN
    SELECT * INTO v_eleccion FROM elecciones WHERE id = p_eleccion_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Eleccion inexistente'; END IF;
    IF v_eleccion.estado = 'cerrada' THEN RETURN; END IF;
    IF v_eleccion.estado <> 'activa'
       OR (NOT p_anticipado AND clock_timestamp() < v_eleccion.cierra_en) THEN
        RAISE EXCEPTION 'La eleccion aun no puede cerrarse';
    END IF;
    SELECT count(*), count(*) FILTER (WHERE ha_votado)
      INTO v_habilitados, v_participantes
      FROM habilitaciones_voto WHERE eleccion_id = p_eleccion_id;
    SELECT count(*) INTO v_votos FROM votos WHERE eleccion_id = p_eleccion_id;
    IF v_participantes <> v_votos THEN
        RAISE EXCEPTION 'Inconsistencia: % participaciones y % votos',
            v_participantes, v_votos;
    END IF;
    v_ahora := clock_timestamp();
    UPDATE elecciones
       SET estado = 'cerrada', cerrada_en = v_ahora, publicada_en = v_ahora
     WHERE id = p_eleccion_id;
    INSERT INTO resultados_electorales
        (eleccion_id, total_habilitados, total_participantes)
    VALUES (p_eleccion_id, v_habilitados, v_participantes);
    INSERT INTO resultados_candidatos (eleccion_id, candidatura_id, votos_obtenidos)
    SELECT p_eleccion_id, c.id, count(v.id)
      FROM candidaturas c LEFT JOIN votos v
        ON v.candidatura_id = c.id AND v.eleccion_id = p_eleccion_id
     WHERE c.eleccion_id = p_eleccion_id
     GROUP BY c.id;
    INSERT INTO eventos_auditoria (eleccion_id, tipo_evento, actor_tipo, detalle)
    VALUES (p_eleccion_id, 'cierre_publicacion', 'sistema',
        jsonb_build_object('total_habilitados', v_habilitados,
                           'total_participantes', v_participantes,
                           'total_votos', v_votos,
                           'anticipado', p_anticipado));
END;
$$;

-- Supabase concede EXECUTE a anon/authenticated/service_role por defecto en
-- funciones nuevas de public; se revoca explicitamente para no exponer el cierre.
REVOKE ALL ON FUNCTION cerrar_y_publicar_resultados(bigint, boolean)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cerrar_y_publicar_resultados(bigint, boolean) TO votesecure_api;

COMMIT;
