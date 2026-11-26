import { Pool } from 'pg';
import { loadServerEnv } from '../../src/config/env';

// Espejo inverso de seed-demo.ts: elimina los datos de demostracion (seccion
// SEC-DM25, sus elecciones y los usuarios demo) de la base de datos. Se creo
// para limpiar la BD compartida de pruebas/produccion antes de abrir al
// publico. No es una migracion: no va en backend/sql/.
//
// Seguridad: alcance fijo (codigo de seccion y correos demo exactos) y
// aborta sin borrar nada si la eleccion demo ya tiene votos registrados.
//
// Uso: npm run demo:limpiar

const SECTION_CODE = 'SEC-DM25';
const PERIODO = '2026-30';
const CORREOS_DEMO = [
  'admin.demo@votesecureapp.com',
  'c2026001@utp.edu.pe',
  ...Array.from({ length: 8 }, (_, i) => `u202600${i + 1}@utp.edu.pe`)
];

interface Borrado {
  tabla: string;
  sql: string;
  params: unknown[];
}

async function main(): Promise<void> {
  const env = loadServerEnv();
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? env.DATABASE_API_URL,
    max: 1
  });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const seccion = await client.query<{ id: string }>(
        `SELECT id FROM secciones WHERE codigo = $1 AND periodo_academico = $2`,
        [SECTION_CODE, PERIODO]
      );
      if (seccion.rowCount === 0) {
        console.log('No existe la seccion demo; no hay nada que limpiar.');
        await client.query('ROLLBACK');
        return;
      }
      const seccionId = Number(seccion.rows[0]!.id);

      const elecciones = await client.query<{ id: string }>(
        `SELECT id FROM elecciones WHERE seccion_id = $1`,
        [seccionId]
      );
      const eleccionIds = elecciones.rows.map((row) => Number(row.id));
      const idsParaFiltro = eleccionIds.length > 0 ? eleccionIds : [-1];

      // El voto es anonimo e irrevocable: si hay votos, no se toca nada.
      const votos = await client.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM votos WHERE eleccion_id = ANY($1::bigint[])`,
        [idsParaFiltro]
      );
      const totalVotos = Number(votos.rows[0]!.total);
      if (totalVotos > 0) {
        throw new Error(
          `La eleccion demo tiene ${totalVotos} voto(s) registrado(s); ` +
            'no se elimina nada. Verifica el alcance manualmente.'
        );
      }

      // Orden de borrado segun las FKs (todas ON DELETE RESTRICT): hijos antes
      // que padres. La seccion acota las tablas por seccion; las tablas por
      // eleccion se acotan con los ids de elecciones de la seccion demo.
      const delegacionesDemo = `SELECT id FROM delegaciones WHERE eleccion_id = ANY($1::bigint[])`;
      const periodosDemo = `SELECT id FROM periodos_evaluacion WHERE delegacion_id IN (${delegacionesDemo})`;

      const borrados: Borrado[] = [
        {
          tabla: 'resultados_candidatos',
          sql: `DELETE FROM resultados_candidatos WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'resultados_electorales',
          sql: `DELETE FROM resultados_electorales WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'votos',
          sql: `DELETE FROM votos WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'evaluaciones_estudiantes',
          sql: `DELETE FROM evaluaciones_estudiantes
                WHERE periodo_evaluacion_id IN (${periodosDemo})`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'evaluaciones_docentes',
          sql: `DELETE FROM evaluaciones_docentes
                WHERE periodo_evaluacion_id IN (${periodosDemo})`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'periodos_evaluacion',
          sql: `DELETE FROM periodos_evaluacion WHERE delegacion_id IN (${delegacionesDemo})`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'delegaciones',
          sql: `DELETE FROM delegaciones WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'eventos_auditoria',
          sql: `DELETE FROM eventos_auditoria WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'habilitaciones_voto',
          sql: `DELETE FROM habilitaciones_voto WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'candidaturas',
          sql: `DELETE FROM candidaturas WHERE eleccion_id = ANY($1::bigint[])`,
          params: [idsParaFiltro]
        },
        {
          tabla: 'elecciones',
          sql: `DELETE FROM elecciones WHERE seccion_id = $1`,
          params: [seccionId]
        },
        {
          tabla: 'matriculas',
          sql: `DELETE FROM matriculas WHERE seccion_id = $1`,
          params: [seccionId]
        },
        {
          tabla: 'asignaciones_docentes',
          sql: `DELETE FROM asignaciones_docentes WHERE seccion_id = $1`,
          params: [seccionId]
        },
        {
          tabla: 'secciones',
          sql: `DELETE FROM secciones WHERE id = $1`,
          params: [seccionId]
        }
      ];

      for (const { tabla, sql, params } of borrados) {
        const resultado = await client.query(sql, params);
        console.log(`  ${tabla}: ${resultado.rowCount ?? 0} fila(s) eliminada(s)`);
      }

      // Los usuarios demo solo se borran si ya no tienen referencias (FKs
      // RESTRICT): se verifica antes y se omite (logueando) al que conserve.
      const pendientes = await client.query<{ id: string; correo: string; referencias: string }>(
        `SELECT u.id, u.correo,
                (SELECT count(*) FROM matriculas m WHERE m.estudiante_id = u.id)
              + (SELECT count(*) FROM asignaciones_docentes a WHERE a.docente_id = u.id)
              + (SELECT count(*) FROM elecciones e
                 WHERE e.creada_por_usuario_id = u.id OR e.cancelada_por_usuario_id = u.id)
              + (SELECT count(*) FROM eventos_auditoria ev WHERE ev.actor_usuario_id = u.id)
                AS referencias
         FROM usuarios u
         WHERE u.correo = ANY($1::varchar[])`,
        [CORREOS_DEMO]
      );
      for (const usuario of pendientes.rows) {
        if (Number(usuario.referencias) > 0) {
          console.log(
            `  usuarios: se omite ${usuario.correo} (conserva ${usuario.referencias} referencia(s))`
          );
          continue;
        }
        await client.query(`DELETE FROM usuarios WHERE id = $1`, [usuario.id]);
        console.log(`  usuarios: ${usuario.correo} eliminado`);
      }

      await client.query('COMMIT');
      console.log('Limpieza del seed demo completada.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('Fallo la limpieza del seed demo:', error instanceof Error ? error.message : error);
  process.exit(1);
});
