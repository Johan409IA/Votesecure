-- ============================================================
-- VoteSecure - 005_instrucciones_periodo_evaluacion.sql
-- Instrucciones/criterios especificos que el docente fija al abrir
-- el periodo de evaluacion (§7.1). Aprobado por el DBA del proyecto.
--
-- NOT NULL exige que periodos_evaluacion este vacia (hoy no hay
-- delegaciones ni periodos); si existieran filas, habria que
-- backfillear instrucciones antes de aplicar.
--
-- Los grants de 002 son de tabla (SELECT, INSERT, UPDATE sobre
-- periodos_evaluacion), por lo que cubren la columna nueva sin
-- cambios. No se crean funciones: no hay nada que revocar.
-- ============================================================

BEGIN;

ALTER TABLE periodos_evaluacion
    ADD COLUMN instrucciones varchar(1000) NOT NULL
    CHECK (length(btrim(instrucciones)) BETWEEN 20 AND 1000);

COMMIT;
