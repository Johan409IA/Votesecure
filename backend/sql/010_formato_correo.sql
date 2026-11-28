-- 010: Formato institucional estricto del correo por tipo de usuario.
-- Los codigos reales de la UTP son fijos: estudiantes u + 8 digitos
-- (u23272054@utp.edu.pe) y docentes c + 5 digitos (c22834@utp.edu.pe).
-- Reemplaza el CHECK permisivo del esquema inicial (001) que aceptaba
-- cualquier cadena alfanumerica tras la letra inicial. El administrador
-- conserva el formato de correo libre (puede ser Gmail, no es UTP).
--
-- Precondicion: no deben existir cuentas de estudiante/docente fuera del
-- formato real (verificadas antes de aplicar; los datos demo de 7 digitos
-- se eliminan primero con demo:limpiar).

-- El CHECK original fue declarado sin nombre en 001, asi que PostgreSQL le
-- asigno uno automatico: se localiza por su definicion y se elimina.
DO $$
DECLARE
    v_nombre text;
BEGIN
    SELECT conname INTO v_nombre
      FROM pg_constraint
     WHERE conrelid = 'usuarios'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%utp[.]edu[.]pe%'
     LIMIT 1;
    IF v_nombre IS NOT NULL THEN
        EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', v_nombre);
    END IF;
END;
$$;

ALTER TABLE usuarios ADD CONSTRAINT usuarios_formato_correo_check CHECK (
    (tipo_usuario = 'estudiante' AND correo ~ '^u[0-9]{8}@utp[.]edu[.]pe$')
    OR (tipo_usuario = 'docente' AND correo ~ '^c[0-9]{5}@utp[.]edu[.]pe$')
    OR (tipo_usuario = 'administrador'
        AND correo ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$')
);
