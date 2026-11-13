-- ============================================================
-- VoteSecure - 007_periodos_evaluacion_multiples.sql
-- Hasta 3 periodos de evaluacion por delegacion y ciclo (§7.1),
-- abiertos discrecionalmente por el docente responsable. Cada
-- periodo admite una evaluacion por estudiante y una por docente
-- (las UNIQUE por periodo de 001 se conservan). Aprobado por el
-- DBA del proyecto.
-- ============================================================

BEGIN;

-- 1) Se retira el periodo unico por delegacion (001: delegacion_id UNIQUE).
ALTER TABLE periodos_evaluacion
    DROP CONSTRAINT periodos_evaluacion_delegacion_id_key;

-- Indice de busqueda por delegacion (antes lo cubria el UNIQUE).
CREATE INDEX periodos_evaluacion_delegacion_idx
    ON periodos_evaluacion (delegacion_id);

-- 2) Se reemplaza el cuerpo de la funcion del trigger existente
-- (periodos_evaluacion_fechas): ademas de la ventana dentro de la
-- delegacion, exige maximo 3 periodos y prohibe solapamientos.
CREATE OR REPLACE FUNCTION controlar_periodo_evaluacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_delegacion delegaciones%ROWTYPE;
    v_cantidad int;
BEGIN
    SELECT * INTO v_delegacion FROM delegaciones WHERE id = NEW.delegacion_id;
    IF NEW.abre_en < v_delegacion.inicia_en
       OR (v_delegacion.termina_en IS NOT NULL
           AND NEW.cierra_en > v_delegacion.termina_en) THEN
        RAISE EXCEPTION 'El periodo de evaluacion debe estar dentro de la delegacion';
    END IF;
    -- Maximo 3 periodos de evaluacion por delegacion (§7.1).
    SELECT count(*) INTO v_cantidad
      FROM periodos_evaluacion
     WHERE delegacion_id = NEW.delegacion_id
       AND id <> NEW.id;
    IF v_cantidad >= 3 THEN
        RAISE EXCEPTION 'La delegacion ya tiene los 3 periodos de evaluacion permitidos';
    END IF;
    -- Los periodos de una misma delegacion no se solapan: a lo sumo
    -- uno abierto a la vez, sin ambiguedad para currentPeriodByDelegation.
    IF EXISTS (
        SELECT 1 FROM periodos_evaluacion
         WHERE delegacion_id = NEW.delegacion_id
           AND id <> NEW.id
           AND abre_en < NEW.cierra_en
           AND cierra_en > NEW.abre_en
    ) THEN
        RAISE EXCEPTION 'El periodo de evaluacion se solapa con otro de la misma delegacion';
    END IF;
    RETURN NEW;
END;
$$;

-- Funcion reemplazada: revocar ejecucion a roles no operativos.
REVOKE ALL ON FUNCTION controlar_periodo_evaluacion()
    FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
