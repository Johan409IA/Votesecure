-- ============================================================
-- VoteSecure - 001_esquema_oficial.sql
-- Version unica identificada de la fuente oficial: script_oficial.txt (v1.0).
-- Aprobado por el DBA del proyecto. No modificar sin nueva aprobacion documentada.
-- ============================================================


BEGIN;

CREATE TABLE usuarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre varchar(120) NOT NULL CHECK (length(btrim(nombre)) > 0),
    correo varchar(254) NOT NULL UNIQUE,
    tipo_usuario varchar(13) NOT NULL CHECK (
        tipo_usuario IN ('estudiante', 'docente', 'administrador')
    ),
    hash_contrasena varchar(255) NOT NULL CHECK (length(btrim(hash_contrasena)) >= 20),
    correo_verificado_en timestamptz,
    verificacion_hash bytea,
    verificacion_expira_en timestamptz,
    sesion_hash bytea,
    sesion_expira_en timestamptz,
    sesion_revocada_en timestamptz,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    CHECK (correo = lower(btrim(correo))),
    CHECK (
        (tipo_usuario = 'estudiante' AND correo ~ '^u[a-z0-9._%+-]*@utp[.]edu[.]pe$')
        OR (tipo_usuario = 'docente' AND correo ~ '^c[a-z0-9._%+-]*@utp[.]edu[.]pe$')
        OR (tipo_usuario = 'administrador'
            AND correo ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$')
    ),
    CHECK (
        (verificacion_hash IS NULL AND verificacion_expira_en IS NULL)
        OR
        (octet_length(verificacion_hash) = 32 AND verificacion_expira_en IS NOT NULL)
    ),
    CHECK (correo_verificado_en IS NULL OR verificacion_hash IS NULL),
    CHECK (
        (sesion_hash IS NULL AND sesion_expira_en IS NULL
            AND sesion_revocada_en IS NULL)
        OR (octet_length(sesion_hash) = 32 AND sesion_expira_en IS NOT NULL)
    )
);

-- Una seccion identifica un curso especifico en un periodo academico (decision B1).
CREATE TABLE secciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_curso varchar(30) NOT NULL CHECK (length(btrim(codigo_curso)) > 0),
    nombre_curso varchar(160) NOT NULL CHECK (length(btrim(nombre_curso)) > 0),
    periodo_academico varchar(30) NOT NULL CHECK (length(btrim(periodo_academico)) > 0),
    codigo varchar(30) NOT NULL CHECK (length(btrim(codigo)) > 0),
    activa boolean NOT NULL DEFAULT true,
    UNIQUE (codigo_curso, periodo_academico, codigo)
);

CREATE TABLE matriculas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seccion_id bigint NOT NULL REFERENCES secciones(id) ON DELETE RESTRICT,
    estudiante_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    activa boolean NOT NULL DEFAULT true,
    UNIQUE (seccion_id, estudiante_id),
    UNIQUE (id, seccion_id)
);

CREATE TABLE asignaciones_docentes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seccion_id bigint NOT NULL REFERENCES secciones(id) ON DELETE RESTRICT,
    docente_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    activa boolean NOT NULL DEFAULT true,
    UNIQUE (seccion_id, docente_id),
    UNIQUE (id, seccion_id)
);

CREATE TABLE elecciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seccion_id bigint NOT NULL REFERENCES secciones(id) ON DELETE RESTRICT,
    eleccion_origen_id bigint UNIQUE,
    nombre varchar(160) NOT NULL CHECK (length(btrim(nombre)) > 0),
    tipo varchar(12) NOT NULL DEFAULT 'principal',
    estado varchar(12) NOT NULL DEFAULT 'borrador',
    inicia_en timestamptz NOT NULL,
    cierra_en timestamptz NOT NULL,
    cerrada_en timestamptz,
    publicada_en timestamptz,
    creada_por_usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    cancelada_en timestamptz,
    cancelada_por_usuario_id bigint REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo_cancelacion varchar(500),
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, seccion_id),
    CHECK (
        (tipo = 'principal' AND eleccion_origen_id IS NULL)
        OR (tipo IN ('desempate', 'repeticion') AND eleccion_origen_id IS NOT NULL)
    ),
    CHECK (estado IN ('borrador', 'programada', 'activa', 'cerrada', 'cancelada')),
    CHECK (cierra_en > inicia_en),
    CHECK (eleccion_origen_id IS NULL OR eleccion_origen_id <> id),
    CHECK (
        (estado = 'cerrada' AND cerrada_en IS NOT NULL AND publicada_en IS NOT NULL)
        OR (estado <> 'cerrada' AND cerrada_en IS NULL AND publicada_en IS NULL)
    ),
    CHECK (
        (estado = 'cancelada' AND cancelada_en IS NOT NULL
            AND cancelada_por_usuario_id IS NOT NULL
            AND motivo_cancelacion IS NOT NULL
            AND length(btrim(motivo_cancelacion)) > 0)
        OR (estado <> 'cancelada' AND cancelada_en IS NULL
            AND cancelada_por_usuario_id IS NULL AND motivo_cancelacion IS NULL)
    ),
    FOREIGN KEY (eleccion_origen_id, seccion_id)
        REFERENCES elecciones(id, seccion_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX elecciones_una_activa_por_seccion_idx
    ON elecciones (seccion_id) WHERE estado = 'activa';

-- La seccion ya identifica el curso y el periodo; desempates y repeticiones
-- se vinculan a la principal, sin crear una segunda principal.
CREATE UNIQUE INDEX elecciones_una_principal_por_seccion_idx
    ON elecciones (seccion_id) WHERE tipo = 'principal';

CREATE TABLE candidaturas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eleccion_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    UNIQUE (eleccion_id, matricula_id),
    UNIQUE (id, eleccion_id),
    FOREIGN KEY (eleccion_id, seccion_id)
        REFERENCES elecciones(id, seccion_id) ON DELETE RESTRICT,
    FOREIGN KEY (matricula_id, seccion_id)
        REFERENCES matriculas(id, seccion_id) ON DELETE RESTRICT
);

-- Padron congelado cuando la eleccion pasa a activa.
CREATE TABLE habilitaciones_voto (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eleccion_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    ha_votado boolean NOT NULL DEFAULT false,
    UNIQUE (eleccion_id, matricula_id),
    FOREIGN KEY (eleccion_id, seccion_id)
        REFERENCES elecciones(id, seccion_id) ON DELETE RESTRICT,
    FOREIGN KEY (matricula_id, seccion_id)
        REFERENCES matriculas(id, seccion_id) ON DELETE RESTRICT
);

-- Deliberadamente no guarda identidad, matricula ni fecha del votante.
CREATE TABLE votos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eleccion_id bigint NOT NULL REFERENCES elecciones(id) ON DELETE RESTRICT,
    candidatura_id bigint NOT NULL,
    FOREIGN KEY (candidatura_id, eleccion_id)
        REFERENCES candidaturas(id, eleccion_id) ON DELETE RESTRICT
);

CREATE TABLE resultados_electorales (
    eleccion_id bigint PRIMARY KEY REFERENCES elecciones(id) ON DELETE RESTRICT,
    total_habilitados bigint NOT NULL CHECK (total_habilitados >= 0),
    total_participantes bigint NOT NULL CHECK (total_participantes >= 0),
    CHECK (total_participantes <= total_habilitados)
);

CREATE TABLE resultados_candidatos (
    eleccion_id bigint NOT NULL REFERENCES resultados_electorales(eleccion_id)
        ON DELETE RESTRICT,
    candidatura_id bigint NOT NULL,
    votos_obtenidos bigint NOT NULL CHECK (votos_obtenidos >= 0),
    PRIMARY KEY (eleccion_id, candidatura_id),
    FOREIGN KEY (candidatura_id, eleccion_id)
        REFERENCES candidaturas(id, eleccion_id) ON DELETE RESTRICT
);

CREATE TABLE delegaciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eleccion_id bigint NOT NULL UNIQUE,
    seccion_id bigint NOT NULL,
    candidatura_id bigint NOT NULL,
    inicia_en timestamptz NOT NULL,
    termina_en timestamptz,
    UNIQUE (id, seccion_id),
    CHECK (termina_en IS NULL OR termina_en > inicia_en),
    FOREIGN KEY (eleccion_id, seccion_id)
        REFERENCES elecciones(id, seccion_id) ON DELETE RESTRICT,
    FOREIGN KEY (candidatura_id, eleccion_id)
        REFERENCES candidaturas(id, eleccion_id) ON DELETE RESTRICT
);

CREATE TABLE periodos_evaluacion (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delegacion_id bigint NOT NULL UNIQUE,
    seccion_id bigint NOT NULL,
    abre_en timestamptz NOT NULL,
    cierra_en timestamptz NOT NULL,
    UNIQUE (id, seccion_id),
    CHECK (cierra_en > abre_en),
    FOREIGN KEY (delegacion_id, seccion_id)
        REFERENCES delegaciones(id, seccion_id) ON DELETE RESTRICT
);

CREATE TABLE evaluaciones_estudiantes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    periodo_evaluacion_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    calificacion smallint NOT NULL CHECK (calificacion BETWEEN 1 AND 10),
    comentario varchar(500),
    UNIQUE (periodo_evaluacion_id, matricula_id),
    CHECK (comentario IS NULL OR length(btrim(comentario)) > 0),
    FOREIGN KEY (periodo_evaluacion_id, seccion_id)
        REFERENCES periodos_evaluacion(id, seccion_id) ON DELETE RESTRICT,
    FOREIGN KEY (matricula_id, seccion_id)
        REFERENCES matriculas(id, seccion_id) ON DELETE RESTRICT
);

CREATE TABLE evaluaciones_docentes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    periodo_evaluacion_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    asignacion_docente_id bigint NOT NULL,
    calificacion smallint NOT NULL CHECK (calificacion BETWEEN 1 AND 10),
    comentario varchar(1000) NOT NULL CHECK (length(btrim(comentario)) >= 20),
    UNIQUE (periodo_evaluacion_id, asignacion_docente_id),
    FOREIGN KEY (periodo_evaluacion_id, seccion_id)
        REFERENCES periodos_evaluacion(id, seccion_id) ON DELETE RESTRICT,
    FOREIGN KEY (asignacion_docente_id, seccion_id)
        REFERENCES asignaciones_docentes(id, seccion_id) ON DELETE RESTRICT
);

-- Unica tabla nueva respecto del script recibido (decision E1).
-- Nunca registrar aqui la candidatura elegida junto a un votante.
CREATE TABLE eventos_auditoria (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eleccion_id bigint NOT NULL REFERENCES elecciones(id) ON DELETE RESTRICT,
    tipo_evento varchar(30) NOT NULL CHECK (
        tipo_evento IN ('creacion', 'activacion', 'cancelacion', 'cierre_publicacion')
    ),
    actor_tipo varchar(8) NOT NULL CHECK (actor_tipo IN ('usuario', 'sistema')),
    actor_usuario_id bigint REFERENCES usuarios(id) ON DELETE RESTRICT,
    ocurrido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    detalle jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detalle) = 'object'),
    CHECK (
        (actor_tipo = 'sistema' AND actor_usuario_id IS NULL)
        OR (actor_tipo = 'usuario' AND actor_usuario_id IS NOT NULL)
    )
);

CREATE INDEX matriculas_estudiante_idx ON matriculas (estudiante_id);
CREATE INDEX asignaciones_docentes_docente_idx ON asignaciones_docentes (docente_id);
CREATE INDEX elecciones_seccion_idx ON elecciones (seccion_id);
CREATE INDEX candidaturas_matricula_idx ON candidaturas (matricula_id);
CREATE INDEX habilitaciones_matricula_idx ON habilitaciones_voto (matricula_id);
CREATE INDEX votos_eleccion_candidatura_idx ON votos (eleccion_id, candidatura_id);
CREATE INDEX resultados_candidatos_candidatura_idx ON resultados_candidatos (candidatura_id);
CREATE INDEX evaluaciones_estudiantes_matricula_idx ON evaluaciones_estudiantes (matricula_id);
CREATE INDEX evaluaciones_docentes_asignacion_idx ON evaluaciones_docentes (asignacion_docente_id);
CREATE INDEX eventos_auditoria_eleccion_idx ON eventos_auditoria (eleccion_id, ocurrido_en);

-- Los porcentajes y el ganador se derivan de la instantanea publicada.
-- En empate o ausencia de votos, ganador_candidatura_id queda NULL.
CREATE VIEW resumen_resultados_publicados AS
WITH maximos AS (
    SELECT eleccion_id, max(votos_obtenidos) AS max_votos
      FROM resultados_candidatos
     GROUP BY eleccion_id
), lideres AS (
    SELECT r.eleccion_id,
           count(*) FILTER (WHERE r.votos_obtenidos = m.max_votos
                               AND m.max_votos > 0) AS cantidad_lideres,
           min(r.candidatura_id) FILTER (WHERE r.votos_obtenidos = m.max_votos
                                            AND m.max_votos > 0) AS candidatura_lider_id
      FROM resultados_candidatos r
      JOIN maximos m ON m.eleccion_id = r.eleccion_id
     GROUP BY r.eleccion_id
)
SELECT re.eleccion_id,
       re.total_habilitados,
       re.total_participantes,
       coalesce(round(100.0 * re.total_participantes /
           nullif(re.total_habilitados, 0), 2), 0) AS porcentaje_participacion,
       CASE WHEN re.total_participantes = 0 THEN 'sin_votos'
            WHEN coalesce(l.cantidad_lideres, 0) = 1 THEN 'ganador'
            ELSE 'empate' END AS situacion,
       CASE WHEN l.cantidad_lideres = 1 THEN l.candidatura_lider_id
            ELSE NULL END AS ganador_candidatura_id
  FROM resultados_electorales re
  LEFT JOIN lideres l ON l.eleccion_id = re.eleccion_id;

-- A2: el servidor genera un token aleatorio, guarda solo su hash SHA-256,
-- envia el original al correo y llama a esta funcion al confirmar el enlace.
-- El servidor debe generar hash_contrasena con un algoritmo para contrasenas
-- como Argon2id. Este script nunca almacena la contrasena en texto claro.
CREATE FUNCTION confirmar_correo(p_correo varchar, p_token_hash bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE usuarios
       SET correo_verificado_en = clock_timestamp(),
           verificacion_hash = NULL,
           verificacion_expira_en = NULL
      WHERE correo = lower(btrim(p_correo))
       AND correo_verificado_en IS NULL
       AND verificacion_hash = p_token_hash
       AND verificacion_expira_en > clock_timestamp();
    RETURN FOUND;
END;
$$;

CREATE FUNCTION validar_usuario_y_relacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_tipo varchar(10);
BEGIN
    IF TG_TABLE_NAME = 'matriculas' THEN
        SELECT tipo_usuario INTO v_tipo FROM usuarios WHERE id = NEW.estudiante_id;
        IF v_tipo IS DISTINCT FROM 'estudiante' THEN
            RAISE EXCEPTION 'La matricula requiere un usuario estudiante';
        END IF;
    ELSE
        SELECT tipo_usuario INTO v_tipo FROM usuarios WHERE id = NEW.docente_id;
        IF v_tipo IS DISTINCT FROM 'docente' THEN
            RAISE EXCEPTION 'La asignacion requiere un usuario docente';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER matriculas_validar_usuario
BEFORE INSERT OR UPDATE OF estudiante_id ON matriculas
FOR EACH ROW EXECUTE FUNCTION validar_usuario_y_relacion();

CREATE TRIGGER asignaciones_validar_usuario
BEFORE INSERT OR UPDATE OF docente_id ON asignaciones_docentes
FOR EACH ROW EXECUTE FUNCTION validar_usuario_y_relacion();

CREATE FUNCTION normalizar_y_proteger_usuario() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.correo := lower(btrim(NEW.correo));
    IF TG_OP = 'UPDATE' THEN
        IF NEW.tipo_usuario IS DISTINCT FROM OLD.tipo_usuario THEN
            RAISE EXCEPTION 'El rol de una cuenta no se puede cambiar';
        END IF;
        IF NEW.correo IS DISTINCT FROM OLD.correo THEN
            IF EXISTS (SELECT 1 FROM matriculas WHERE estudiante_id = OLD.id)
               OR EXISTS (SELECT 1 FROM asignaciones_docentes WHERE docente_id = OLD.id) THEN
                RAISE EXCEPTION 'No se puede cambiar el correo de un usuario ya asignado';
            END IF;
            NEW.correo_verificado_en := NULL;
            NEW.verificacion_hash := NULL;
            NEW.verificacion_expira_en := NULL;
            NEW.sesion_revocada_en := CASE WHEN NEW.sesion_hash IS NOT NULL
                THEN clock_timestamp() ELSE NULL END;
        ELSIF OLD.activo AND NOT NEW.activo AND OLD.sesion_hash IS NOT NULL THEN
            NEW.sesion_revocada_en := clock_timestamp();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER usuarios_normalizar_y_proteger
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION normalizar_y_proteger_usuario();

-- Las reglas de origen se comprueban al crear la eleccion derivada.
CREATE FUNCTION controlar_eleccion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_estado_origen varchar(12);
    v_participantes bigint;
    v_maximo bigint;
    v_empatados bigint;
    v_autorizado boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado NOT IN ('borrador', 'programada') THEN
            RAISE EXCEPTION 'La eleccion debe crearse en borrador o programada';
        END IF;
        SELECT u.activo AND u.correo_verificado_en IS NOT NULL
                   AND (u.tipo_usuario = 'administrador'
                        OR (u.tipo_usuario = 'docente' AND EXISTS (
                        SELECT 1 FROM asignaciones_docentes a
                        WHERE a.docente_id = u.id AND a.seccion_id = NEW.seccion_id
                          AND a.activa)))
          INTO v_autorizado
          FROM usuarios u WHERE u.id = NEW.creada_por_usuario_id;
        IF NOT coalesce(v_autorizado, false) THEN
            RAISE EXCEPTION 'El creador debe ser administrador o docente asignado y verificado';
        END IF;
        IF NEW.tipo <> 'principal' THEN
            SELECT e.estado, r.total_participantes
              INTO v_estado_origen, v_participantes
              FROM elecciones e LEFT JOIN resultados_electorales r ON r.eleccion_id = e.id
             WHERE e.id = NEW.eleccion_origen_id AND e.seccion_id = NEW.seccion_id;
            IF NEW.tipo = 'repeticion' THEN
                IF NOT coalesce(v_estado_origen = 'cancelada'
                    OR (v_estado_origen = 'cerrada' AND v_participantes = 0), false) THEN
                    RAISE EXCEPTION 'La repeticion requiere una eleccion cancelada o cerrada sin votos';
                END IF;
            ELSIF NEW.tipo = 'desempate' THEN
                IF v_estado_origen IS DISTINCT FROM 'cerrada' THEN
                    RAISE EXCEPTION 'El desempate requiere una eleccion cerrada y publicada';
                END IF;
                SELECT max(votos_obtenidos) INTO v_maximo
                  FROM resultados_candidatos WHERE eleccion_id = NEW.eleccion_origen_id;
                SELECT count(*) INTO v_empatados FROM resultados_candidatos
                 WHERE eleccion_id = NEW.eleccion_origen_id
                   AND votos_obtenidos = v_maximo;
                IF coalesce(v_maximo, 0) = 0 OR v_empatados < 2 THEN
                    RAISE EXCEPTION 'El desempate requiere empate positivo';
                END IF;
            END IF;
        END IF;
    ELSE
        IF OLD.estado IN ('cerrada', 'cancelada') THEN
            RAISE EXCEPTION 'Una eleccion cerrada o cancelada es inmutable';
        END IF;
        IF (NEW.seccion_id, NEW.eleccion_origen_id, NEW.nombre, NEW.tipo, NEW.inicia_en,
            NEW.cierra_en, NEW.creada_por_usuario_id) IS DISTINCT FROM
           (OLD.seccion_id, OLD.eleccion_origen_id, OLD.nombre, OLD.tipo, OLD.inicia_en,
            OLD.cierra_en, OLD.creada_por_usuario_id) AND OLD.estado = 'activa' THEN
            RAISE EXCEPTION 'No se puede reconfigurar una eleccion activa';
        END IF;
        IF NEW.estado IS DISTINCT FROM OLD.estado THEN
            IF NOT (
                (OLD.estado = 'borrador' AND NEW.estado IN ('programada', 'cancelada'))
                OR (OLD.estado = 'programada' AND NEW.estado IN ('activa', 'cancelada'))
                OR (OLD.estado = 'activa' AND NEW.estado IN ('cerrada', 'cancelada'))
            ) THEN
                RAISE EXCEPTION 'Transicion de estado electoral no permitida';
            END IF;
            IF NEW.estado = 'cancelada' THEN
                SELECT u.activo AND u.correo_verificado_en IS NOT NULL
                       AND (u.tipo_usuario = 'administrador'
                            OR (u.tipo_usuario = 'docente' AND EXISTS (
                                SELECT 1 FROM asignaciones_docentes a
                                WHERE a.docente_id = u.id AND a.seccion_id = NEW.seccion_id
                                  AND a.activa)))
                  INTO v_autorizado
                  FROM usuarios u WHERE u.id = NEW.cancelada_por_usuario_id;
                IF NOT coalesce(v_autorizado, false) THEN
                    RAISE EXCEPTION 'La cancelacion requiere un administrador o docente asignado y verificado';
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER elecciones_control
BEFORE INSERT OR UPDATE ON elecciones
FOR EACH ROW EXECUTE FUNCTION controlar_eleccion();

CREATE FUNCTION auditar_cambios_eleccion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO eventos_auditoria (eleccion_id, tipo_evento, actor_tipo, actor_usuario_id)
        VALUES (NEW.id, 'creacion', 'usuario', NEW.creada_por_usuario_id);
    ELSIF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
        INSERT INTO eventos_auditoria
            (eleccion_id, tipo_evento, actor_tipo, actor_usuario_id, detalle)
        VALUES (NEW.id, 'cancelacion', 'usuario', NEW.cancelada_por_usuario_id,
                jsonb_build_object('motivo', NEW.motivo_cancelacion));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER elecciones_auditoria
AFTER INSERT OR UPDATE OF estado ON elecciones
FOR EACH ROW EXECUTE FUNCTION auditar_cambios_eleccion();

-- Las candidaturas y habilitaciones se configuran antes de activar.
CREATE FUNCTION controlar_configuracion_electoral() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
    v_matricula_activa boolean;
    v_maximo bigint;
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.eleccion_id, NEW.seccion_id) IS DISTINCT FROM
       (OLD.eleccion_id, OLD.seccion_id) THEN
        RAISE EXCEPTION 'No se puede trasladar una candidatura o habilitacion';
    END IF;
    SELECT * INTO v_eleccion FROM elecciones
     WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.eleccion_id ELSE NEW.eleccion_id END
     FOR UPDATE;
    IF v_eleccion.estado NOT IN ('borrador', 'programada') THEN
        RAISE EXCEPTION 'El padron y las candidaturas ya estan cerrados';
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT activa INTO v_matricula_activa FROM matriculas WHERE id = NEW.matricula_id;
        IF v_matricula_activa IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'Se requiere una matricula activa';
        END IF;
        IF TG_TABLE_NAME = 'candidaturas' AND v_eleccion.tipo <> 'principal' THEN
            IF v_eleccion.tipo = 'desempate' THEN
                SELECT max(votos_obtenidos) INTO v_maximo FROM resultados_candidatos
                 WHERE eleccion_id = v_eleccion.eleccion_origen_id;
                IF NOT EXISTS (
                    SELECT 1 FROM candidaturas c
                    JOIN resultados_candidatos r ON r.candidatura_id = c.id
                    WHERE c.eleccion_id = v_eleccion.eleccion_origen_id
                      AND c.matricula_id = NEW.matricula_id
                      AND r.votos_obtenidos = v_maximo
                ) THEN
                    RAISE EXCEPTION 'El candidato no participo en el empate de origen';
                END IF;
            ELSIF (SELECT estado FROM elecciones
                    WHERE id = v_eleccion.eleccion_origen_id) <> 'cancelada'
                  AND NOT EXISTS (
                      SELECT 1 FROM candidaturas c
                       WHERE c.eleccion_id = v_eleccion.eleccion_origen_id
                         AND c.matricula_id = NEW.matricula_id
                  ) THEN
                RAISE EXCEPTION 'El candidato no participo en la eleccion de origen';
            END IF;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER candidaturas_configuracion
BEFORE INSERT OR UPDATE OR DELETE ON candidaturas
FOR EACH ROW EXECUTE FUNCTION controlar_configuracion_electoral();

CREATE TRIGGER habilitaciones_configuracion
BEFORE INSERT OR UPDATE OF eleccion_id, seccion_id, matricula_id OR DELETE
ON habilitaciones_voto
FOR EACH ROW EXECUTE FUNCTION controlar_configuracion_electoral();

CREATE FUNCTION controlar_marca_voto() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
BEGIN
    IF OLD.ha_votado OR NOT NEW.ha_votado THEN
        RAISE EXCEPTION 'La marca de participacion solo puede pasar de falso a verdadero';
    END IF;
    SELECT * INTO v_eleccion FROM elecciones WHERE id = NEW.eleccion_id FOR SHARE;
    IF v_eleccion.estado <> 'activa'
       OR clock_timestamp() < v_eleccion.inicia_en
       OR clock_timestamp() >= v_eleccion.cierra_en THEN
        RAISE EXCEPTION 'La eleccion no esta abierta';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER habilitaciones_marca_voto
BEFORE UPDATE OF ha_votado ON habilitaciones_voto
FOR EACH ROW EXECUTE FUNCTION controlar_marca_voto();

CREATE FUNCTION controlar_insert_voto() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
BEGIN
    SELECT * INTO v_eleccion FROM elecciones WHERE id = NEW.eleccion_id FOR SHARE;
    IF v_eleccion.estado <> 'activa'
       OR clock_timestamp() < v_eleccion.inicia_en
       OR clock_timestamp() >= v_eleccion.cierra_en THEN
        RAISE EXCEPTION 'La eleccion no esta abierta';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER votos_solo_eleccion_abierta
BEFORE INSERT ON votos
FOR EACH ROW EXECUTE FUNCTION controlar_insert_voto();

CREATE FUNCTION impedir_cambios_historicos() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    RAISE EXCEPTION 'El registro historico es inmutable';
END;
$$;

CREATE TRIGGER votos_inmutables
BEFORE UPDATE OR DELETE ON votos
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_historicos();

CREATE TRIGGER resultados_electorales_inmutables
BEFORE UPDATE OR DELETE ON resultados_electorales
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_historicos();

CREATE TRIGGER resultados_candidatos_inmutables
BEFORE UPDATE OR DELETE ON resultados_candidatos
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_historicos();

CREATE TRIGGER auditoria_inmutable
BEFORE UPDATE OR DELETE ON eventos_auditoria
FOR EACH ROW EXECUTE FUNCTION impedir_cambios_historicos();

-- A2 y G1: el usuario debe estar verificado, activo y en el padron congelado.
-- La fila electoral se bloquea para que el cierre espere a los votos en curso.
CREATE FUNCTION registrar_voto(
    p_eleccion_id bigint, p_estudiante_id bigint, p_candidatura_id bigint
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_eleccion elecciones%ROWTYPE;
    v_habilitacion_id bigint;
    v_voto_id bigint;
BEGIN
    SELECT * INTO v_eleccion FROM elecciones WHERE id = p_eleccion_id FOR SHARE;
    IF NOT FOUND OR v_eleccion.estado <> 'activa'
       OR clock_timestamp() < v_eleccion.inicia_en
       OR clock_timestamp() >= v_eleccion.cierra_en THEN
        RAISE EXCEPTION 'La eleccion no esta abierta';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM candidaturas
         WHERE id = p_candidatura_id AND eleccion_id = p_eleccion_id
    ) THEN
        RAISE EXCEPTION 'La candidatura no corresponde a la eleccion';
    END IF;
    UPDATE habilitaciones_voto h
       SET ha_votado = true
      FROM matriculas m JOIN usuarios u ON u.id = m.estudiante_id
     WHERE h.eleccion_id = p_eleccion_id
       AND h.matricula_id = m.id
       AND m.estudiante_id = p_estudiante_id
        AND m.activa AND u.tipo_usuario = 'estudiante' AND u.activo
       AND u.correo_verificado_en IS NOT NULL
       AND NOT h.ha_votado
    RETURNING h.id INTO v_habilitacion_id;
    IF v_habilitacion_id IS NULL THEN
        RAISE EXCEPTION 'Estudiante no habilitado o voto ya registrado';
    END IF;
    INSERT INTO votos (eleccion_id, candidatura_id)
    VALUES (p_eleccion_id, p_candidatura_id)
    RETURNING id INTO v_voto_id;
    RETURN v_voto_id;
END;
$$;

-- El planificador de la API llama a esta funcion al llegar inicia_en.
CREATE FUNCTION activar_eleccion(p_eleccion_id bigint)
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

-- D1: cierre, validacion, conteo, publicacion y auditoria son atomicos.
-- El planificador debe llamarla al alcanzar cierra_en. La funcion es idempotente.
CREATE FUNCTION cerrar_y_publicar_resultados(p_eleccion_id bigint)
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
       OR clock_timestamp() < v_eleccion.cierra_en THEN
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
                           'total_votos', v_votos));
END;
$$;

CREATE FUNCTION controlar_delegacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_maximo bigint;
    v_ganadores bigint;
    v_ganador_id bigint;
BEGIN
    SELECT max(votos_obtenidos) INTO v_maximo
      FROM resultados_candidatos WHERE eleccion_id = NEW.eleccion_id;
    SELECT count(*), min(candidatura_id)
      INTO v_ganadores, v_ganador_id
      FROM resultados_candidatos
     WHERE eleccion_id = NEW.eleccion_id AND votos_obtenidos = v_maximo;
    IF coalesce(v_maximo, 0) = 0 OR v_ganadores <> 1
       OR NEW.candidatura_id <> v_ganador_id THEN
        RAISE EXCEPTION 'Solo puede delegarse al ganador unico publicado';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER delegaciones_ganador
BEFORE INSERT OR UPDATE OF eleccion_id, candidatura_id ON delegaciones
FOR EACH ROW EXECUTE FUNCTION controlar_delegacion();

CREATE FUNCTION controlar_periodo_evaluacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_delegacion delegaciones%ROWTYPE;
BEGIN
    SELECT * INTO v_delegacion FROM delegaciones WHERE id = NEW.delegacion_id;
    IF NEW.abre_en < v_delegacion.inicia_en
       OR (v_delegacion.termina_en IS NOT NULL
           AND NEW.cierra_en > v_delegacion.termina_en) THEN
        RAISE EXCEPTION 'El periodo de evaluacion debe estar dentro de la delegacion';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER periodos_evaluacion_fechas
BEFORE INSERT OR UPDATE ON periodos_evaluacion
FOR EACH ROW EXECUTE FUNCTION controlar_periodo_evaluacion();

-- C3: estudiantes y docentes califican de 1 a 10; nota y opinion docente obligatorias.
CREATE FUNCTION controlar_evaluacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_abre timestamptz;
    v_cierra timestamptz;
    v_termina timestamptz;
    v_activa boolean;
BEGIN
    SELECT p.abre_en, p.cierra_en, d.termina_en
      INTO v_abre, v_cierra, v_termina
      FROM periodos_evaluacion p JOIN delegaciones d ON d.id = p.delegacion_id
     WHERE p.id = NEW.periodo_evaluacion_id;
    IF clock_timestamp() < v_abre OR clock_timestamp() >= v_cierra
       OR (v_termina IS NOT NULL AND clock_timestamp() >= v_termina) THEN
        RAISE EXCEPTION 'El periodo de evaluacion no esta abierto';
    END IF;
    IF TG_TABLE_NAME = 'evaluaciones_estudiantes' THEN
        SELECT activa INTO v_activa FROM matriculas WHERE id = NEW.matricula_id;
    ELSE
        SELECT activa INTO v_activa FROM asignaciones_docentes
         WHERE id = NEW.asignacion_docente_id;
    END IF;
    IF v_activa IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Evaluador no asignado actualmente a la seccion';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER evaluaciones_estudiantes_control
BEFORE INSERT OR UPDATE ON evaluaciones_estudiantes
FOR EACH ROW EXECUTE FUNCTION controlar_evaluacion();

CREATE TRIGGER evaluaciones_docentes_control
BEFORE INSERT OR UPDATE ON evaluaciones_docentes
FOR EACH ROW EXECUTE FUNCTION controlar_evaluacion();

-- H1: el voto solo puede elegir una candidatura; no se registran votos en blanco.
-- F1: sin votos o tras cancelacion puede crearse una repeticion;
-- con empate positivo, un desempate. La repeticion de una cancelada
-- configura nuevamente sus candidaturas.
-- La delegacion se registra solo tras obtener un ganador unico.

-- Evita el EXECUTE implicito a PUBLIC en funciones SECURITY DEFINER.
REVOKE ALL ON FUNCTION confirmar_correo(varchar, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION registrar_voto(bigint, bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION activar_eleccion(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION cerrar_y_publicar_resultados(bigint) FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

COMMIT;

