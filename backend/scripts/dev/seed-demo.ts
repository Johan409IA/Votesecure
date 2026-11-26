import { z } from 'zod';
import { Pool } from 'pg';
import { hash } from '@node-rs/argon2';
import { loadServerEnv } from '../../src/config/env';

// Seed de datos de demostracion (NO es una migracion: no va en backend/sql/).
// Crea un admin, un docente, estudiantes (7 matriculados y 1 libre para
// demostrar /secciones/unirse) y una eleccion principal ya activada con
// programar_eleccion + activar_eleccion (el padron se congela por el camino
// oficial, sin saltarse triggers). Idempotente: si la seccion demo ya existe,
// no hace nada. Nunca ejecutar en produccion.
//
// Uso: npm run seed:demo -- --contrasena <clave de 15+ caracteres>

const argsSchema = z.object({
  contrasena: z.string().min(15).max(128)
});

function parseArgs(): z.infer<typeof argsSchema> {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i] ?? '';
    if (key.startsWith('--') && i + 1 < process.argv.length) {
      args.set(key.slice(2), process.argv[i + 1] ?? '');
    }
  }
  return argsSchema.parse({
    contrasena: args.get('contrasena') ?? process.env['DEMO_CONTRASENA'] ?? ''
  });
}

const SECTION_CODE = 'SEC-DM25';

async function main(): Promise<void> {
  const args = parseArgs();
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('El seed demo no debe ejecutarse en produccion');
  }
  const env = loadServerEnv();
  const passwordHash = await hash(args.contrasena, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? env.DATABASE_API_URL,
    max: 1
  });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM secciones WHERE codigo = $1 AND periodo_academico = '2026-30'`,
        [SECTION_CODE]
      );
      if (existing.rowCount !== 0) {
        console.log('La seccion demo ya existe; no se modifica nada.');
        await client.query('ROLLBACK');
        return;
      }

      // Usuarios demo, todos con correo verificado (sin token pendiente).
      const users: Array<{ nombre: string; correo: string; tipo: string }> = [
        { nombre: 'Administrador Demo', correo: 'admin.demo@votesecureapp.com', tipo: 'administrador' },
        { nombre: 'Docente Demo', correo: 'c2026001@utp.edu.pe', tipo: 'docente' },
        ...Array.from({ length: 8 }, (_, i) => ({
          nombre: `Estudiante Demo ${i + 1}`,
          correo: `u202600${i + 1}@utp.edu.pe`,
          tipo: 'estudiante'
        }))
      ];
      for (const user of users) {
        await client.query(
          `INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena, correo_verificado_en)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (correo) DO NOTHING`,
          [user.nombre, user.correo, user.tipo, passwordHash]
        );
      }
      const ids = await client.query<{ id: string; correo: string }>(
        `SELECT id, correo FROM usuarios WHERE correo = ANY($1::varchar[])`,
        [users.map((u) => u.correo)]
      );
      const idOf = new Map(ids.rows.map((row) => [row.correo, Number(row.id)]));
      const docenteId = idOf.get('c2026001@utp.edu.pe')!;
      const studentIds = Array.from({ length: 8 }, (_, i) =>
        idOf.get(`u202600${i + 1}@utp.edu.pe`)!
      );

      const section = await client.query<{ id: string }>(
        `INSERT INTO secciones (codigo_curso, nombre_curso, periodo_academico, codigo)
         VALUES ('1IX51', 'Taller de Proyecto Demo', '2026-30', $1)
         RETURNING id`,
        [SECTION_CODE]
      );
      const sectionId = Number(section.rows[0]!.id);

      await client.query(
        `INSERT INTO asignaciones_docentes (seccion_id, docente_id) VALUES ($1, $2)`,
        [sectionId, docenteId]
      );
      // 7 estudiantes matriculados; u2026008 queda libre para unirse por codigo.
      for (const studentId of studentIds.slice(0, 7)) {
        await client.query(
          `INSERT INTO matriculas (seccion_id, estudiante_id) VALUES ($1, $2)`,
          [sectionId, studentId]
        );
      }

      const election = await client.query<{ id: string }>(
        `INSERT INTO elecciones (seccion_id, nombre, tipo, estado, inicia_en, cierra_en, creada_por_usuario_id)
         VALUES ($1, 'Delegado Demo', 'principal', 'borrador',
                 now() - interval '1 minute', now() + interval '7 days', $2)
         RETURNING id`,
        [sectionId, docenteId]
      );
      const electionId = Number(election.rows[0]!.id);

      const matriculas = await client.query<{ id: string; estudiante_id: string }>(
        `SELECT id, estudiante_id FROM matriculas
          WHERE seccion_id = $1 AND estudiante_id = ANY($2::bigint[])
          ORDER BY estudiante_id LIMIT 3`,
        [sectionId, studentIds.slice(0, 3)]
      );
      for (const row of matriculas.rows) {
        await client.query(
          `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id) VALUES ($1, $2, $3)`,
          [electionId, sectionId, Number(row.id)]
        );
      }

      // Programar y activar por las funciones oficiales: generan habilitaciones
      // (padron congelado) y el evento de activacion. Sin votos.
      await client.query('SELECT programar_eleccion($1, $2)', [electionId, docenteId]);
      await client.query('SELECT activar_eleccion($1)', [electionId]);

      await client.query('COMMIT');

      console.log('Seed demo aplicado correctamente.');
      console.log(`  Seccion:   ${SECTION_CODE} (id ${sectionId})`);
      console.log(`  Eleccion:  id ${electionId}, estado activa, lista para votar`);
      console.log('  Admin:     admin.demo@votesecureapp.com');
      console.log('  Docente:   c2026001@utp.edu.pe');
      console.log('  Estudiantes matriculados: u2026001@utp.edu.pe .. u2026007@utp.edu.pe');
      console.log('  Estudiante libre (para unirse): u2026008@utp.edu.pe');
      console.log('  Contrasena: la indicada en --contrasena (no se guarda en claro)');
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
  console.error('Fallo el seed demo:', error instanceof Error ? error.message : error);
  process.exit(1);
});
