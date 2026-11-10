import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { hashPassword } from '../../src/application/services/passwords';

const VERIFICATION_HASH = createHash('sha256').update('tok').digest();

const CONNECTION_STRING = process.env.TEST_DATABASE_URL ?? '';
const CONNECTION_AVAILABLE = CONNECTION_STRING.length > 0;

describe.skipIf(!CONNECTION_AVAILABLE)('flujo electoral completo (transaccion con rollback)', () => {
  let pool: Pool;
  let client: PoolClient;
  let teacherId = 0;
  const studentIds: number[] = [];
  let electionId = 0;
  const candidacyIds: number[] = [];
  const enrollmentIds: number[] = [];
  let sectionId = 0;

  // Savepoints: una falla esperada no aborta la transaccion compartida.
  const asApi = async (sql: string, values: unknown[] = []) => {
    await client.query('SAVEPOINT sp');
    await client.query('SET ROLE votesecure_api');
    try {
      const result = await client.query(sql, values);
      await client.query('RESET ROLE');
      await client.query('RELEASE SAVEPOINT sp');
      return result;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  const asProvisioning = async (sql: string, values: unknown[] = []) => {
    await client.query('SAVEPOINT sp');
    await client.query('SET ROLE votesecure_provisionamiento');
    try {
      const result = await client.query(sql, values);
      await client.query('RESET ROLE');
      await client.query('RELEASE SAVEPOINT sp');
      return result;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  const asAdmin = async (sql: string, values: unknown[] = []) => {
    await client.query('SAVEPOINT sp');
    try {
      const result = await client.query(sql, values);
      await client.query('RELEASE SAVEPOINT sp');
      return result;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    client = await pool.connect();
    await client.query('BEGIN');

    const hash = await hashPassword('clave-de-prueba-integracion');

    // usuarios de prueba
    const teacher = await asApi(
      `SELECT crear_usuario($1,$2,'docente',$3,$4::bytea, now() + interval '1 day') AS id`,
      ['Docente Prueba', 'c.docente@utp.edu.pe', hash, VERIFICATION_HASH]
    );
    teacherId = Number(teacher.rows[0].id);
    for (let i = 1; i <= 3; i++) {
      const result = await asApi(
        `SELECT crear_usuario($1,$2,'estudiante',$3,$4::bytea, now() + interval '1 day') AS id`,
        [`Estudiante ${i}`, `u2023000${i}@utp.edu.pe`, hash, VERIFICATION_HASH]
      );
      studentIds.push(Number(result.rows[0].id));
    }
    // verificacion de correo por la funcion oficial (limpia el hash de verificacion)
    for (const email of [
      'c.docente@utp.edu.pe',
      ...studentIds.map((_, i) => `u2023000${i + 1}@utp.edu.pe`)
    ]) {
      const result = await asApi(`SELECT confirmar_correo($1, $2) AS ok`, [
        email,
        VERIFICATION_HASH
      ]);
      expect(result.rows[0].ok).toBe(true);
    }

    // seccion, matriculas y asignacion
    const section = await asApi(
      `INSERT INTO secciones (codigo_curso, nombre_curso, periodo_academico, codigo)
       VALUES ('IF5100','Ingenieria de Software','2026-1','P1') RETURNING id`
    );
    sectionId = Number(section.rows[0].id);
    for (const student of studentIds) {
      const enrollment = await asApi(
        `INSERT INTO matriculas (seccion_id, estudiante_id) VALUES ($1,$2) RETURNING id`,
        [sectionId, student]
      );
      enrollmentIds.push(Number(enrollment.rows[0].id));
    }
    await asApi(
      `INSERT INTO asignaciones_docentes (seccion_id, docente_id) VALUES ($1,$2)`,
      [sectionId, teacherId]
    );

    // eleccion principal con ventana corta: se cierra por tiempo real
    const election = await asApi(
      `INSERT INTO elecciones (seccion_id, nombre, inicia_en, cierra_en, creada_por_usuario_id)
       VALUES ($1,'Delegado 2026-1', now() - interval '1 minute',
               now() + interval '45 seconds', $2) RETURNING id`,
      [sectionId, teacherId]
    );
    electionId = Number(election.rows[0].id);

    for (const enrollment of enrollmentIds.slice(0, 2)) {
      const candidacy = await asApi(
        `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
         VALUES ($1,$2,$3) RETURNING id`,
        [electionId, sectionId, enrollment]
      );
      candidacyIds.push(Number(candidacy.rows[0].id));
    }
    for (const enrollment of enrollmentIds) {
      await asApi(
        `INSERT INTO habilitaciones_voto (eleccion_id, seccion_id, matricula_id)
         VALUES ($1,$2,$3)`,
        [electionId, sectionId, enrollment]
      );
    }
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  it('exige dos candidaturas para programar', async () => {
    // se quita una candidatura, programar debe fallar
    const removed = candidacyIds.shift();
    await asApi(`DELETE FROM candidaturas WHERE id = $1`, [removed]);
    await expect(
      asApi(`SELECT programar_eleccion($1,$2)`, [electionId, teacherId])
    ).rejects.toThrow(/al menos dos candidaturas/);
    const candidacy = await asApi(
      `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
       VALUES ($1,$2,$3) RETURNING id`,
      [electionId, sectionId, enrollmentIds[0] ?? 0]
    );
    candidacyIds.push(Number(candidacy.rows[0].id));
  });

  it('programa y activa la eleccion', async () => {
    await asApi(`SELECT programar_eleccion($1,$2)`, [electionId, teacherId]);
    await asApi(`SELECT activar_eleccion($1)`, [electionId]);
    const status = await asAdmin(`SELECT estado FROM elecciones WHERE id = $1`, [electionId]);
    expect(status.rows[0].estado).toBe('activa');
  });

  it('el rol API no puede leer votos ni insertar auditoria directamente', async () => {
    await expect(asApi(`SELECT * FROM votos LIMIT 1`)).rejects.toThrow();
    await expect(
      asApi(
        `INSERT INTO eventos_auditoria (eleccion_id, tipo_evento, actor_tipo)
         VALUES ($1,'creacion','sistema')`,
        [electionId]
      )
    ).rejects.toThrow();
  });

  it('registra votos atomicos y bloquea el doble voto', async () => {
    const first = await asApi(
      `SELECT registrar_voto($1,$2,$3) AS id`,
      [electionId, studentIds[0], candidacyIds[0]]
    );
    expect(Number(first.rows[0].id)).toBeGreaterThan(0);
    await asApi(`SELECT registrar_voto($1,$2,$3)`, [
      electionId,
      studentIds[1] ?? 0,
      candidacyIds[0]
    ]);
    await expect(
      asApi(`SELECT registrar_voto($1,$2,$3)`, [
        electionId,
        studentIds[0],
        candidacyIds[0]
      ])
    ).rejects.toThrow(/habilitado o voto ya registrado/);
  });

  it('el conteo agregado refleja exactamente los votos', async () => {
    const count = await asApi(`SELECT * FROM contar_votos_eleccion($1)`, [electionId]);
    const total = count.rows.reduce((sum: number, row: { votos: string }) => sum + Number(row.votos), 0);
    expect(total).toBe(2);
  });

  it('los votos y resultados son inmutables', async () => {
    await expect(
      asAdmin(`DELETE FROM votos WHERE eleccion_id = $1`, [electionId])
    ).rejects.toThrow(/inmutable/);
  });

  it('cierra, publica y determina ganador unico', async () => {
    // se espera el cierre real por horario (la reconfiguracion en activa esta prohibida)
    await new Promise((resolve) => setTimeout(resolve, 46_000));
    await asApi(`SELECT cerrar_y_publicar_resultados($1)`, [electionId]);
    const summary = await asAdmin(
      `SELECT situacion, ganador_candidatura_id FROM resumen_resultados_publicados
       WHERE eleccion_id = $1`,
      [electionId]
    );
    expect(summary.rows[0].situacion).toBe('ganador');
    expect(summary.rows[0].ganador_candidatura_id).not.toBeNull();
  });

  it('delega al ganador y permite evaluaciones', async () => {
    const summary = await asAdmin(
      `SELECT ganador_candidatura_id FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
      [electionId]
    );
    const delegation = await asApi(
      `INSERT INTO delegaciones (eleccion_id, seccion_id, candidatura_id, inicia_en)
       VALUES ($1,$2,$3, now()) RETURNING id`,
      [electionId, sectionId, summary.rows[0].ganador_candidatura_id]
    );
    const period = await asApi(
      `INSERT INTO periodos_evaluacion (delegacion_id, seccion_id, abre_en, cierra_en)
       VALUES ($1,$2, now(), now() + interval '1 day') RETURNING id`,
      [Number(delegation.rows[0].id), sectionId]
    );
    await asApi(
      `INSERT INTO evaluaciones_estudiantes (periodo_evaluacion_id, seccion_id, matricula_id, calificacion, comentario)
       VALUES ($1,$2,$3,8,'Buen trabajo')`,
      [Number(period.rows[0].id), sectionId, enrollmentIds[0] ?? 0]
    );
    await expect(
      asApi(
        `INSERT INTO evaluaciones_docentes (periodo_evaluacion_id, seccion_id, asignacion_docente_id, calificacion, comentario)
         VALUES ($1,$2,(SELECT id FROM asignaciones_docentes WHERE seccion_id=$2 AND docente_id=$3),7,'corto')`,
        [Number(period.rows[0].id), sectionId, teacherId]
      )
    ).rejects.toThrow();
  });

  it('la auditoria quedo registrada', async () => {
    const events = await asAdmin(
      `SELECT tipo_evento FROM eventos_auditoria WHERE eleccion_id = $1 ORDER BY id`,
      [electionId]
    );
    const types = events.rows.map((row: { tipo_evento: string }) => row.tipo_evento);
    expect(types).toContain('creacion');
    expect(types).toContain('activacion');
    expect(types).toContain('cierre_publicacion');
  });

  it('el rol de aprovisionamiento no gestiona datos electorales', async () => {
    await expect(
      asProvisioning(`SELECT * FROM elecciones LIMIT 1`)
    ).rejects.toThrow();
  });
});
