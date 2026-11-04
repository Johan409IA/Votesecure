import 'dotenv/config';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { hashearContrasena } from '../../src/aplicacion/servicios/contrasenas';

const HASH_VERIFICACION = createHash('sha256').update('tok').digest();

const CADENA = process.env.TEST_DATABASE_URL ?? '';
const CONEXION_DISPONIBLE = CADENA.length > 0;

describe.skipIf(!CONEXION_DISPONIBLE)('flujo electoral completo (transaccion con rollback)', () => {
  let pool: Pool;
  let cliente: PoolClient;
  let docenteId = 0;
  const estudianteIds: number[] = [];
  let eleccionId = 0;
  const candidaturaIds: number[] = [];
  const matriculaIds: number[] = [];
  let seccionId = 0;

  // Savepoints: una falla esperada no aborta la transaccion compartida.
  const comoApi = async (sql: string, valores: unknown[] = []) => {
    await cliente.query('SAVEPOINT sp');
    await cliente.query('SET ROLE votesecure_api');
    try {
      const r = await cliente.query(sql, valores);
      await cliente.query('RESET ROLE');
      await cliente.query('RELEASE SAVEPOINT sp');
      return r;
    } catch (error) {
      await cliente.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  const comoProvisionamiento = async (sql: string, valores: unknown[] = []) => {
    await cliente.query('SAVEPOINT sp');
    await cliente.query('SET ROLE votesecure_provisionamiento');
    try {
      const r = await cliente.query(sql, valores);
      await cliente.query('RESET ROLE');
      await cliente.query('RELEASE SAVEPOINT sp');
      return r;
    } catch (error) {
      await cliente.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  const comoAdmin = async (sql: string, valores: unknown[] = []) => {
    await cliente.query('SAVEPOINT sp');
    try {
      const r = await cliente.query(sql, valores);
      await cliente.query('RELEASE SAVEPOINT sp');
      return r;
    } catch (error) {
      await cliente.query('ROLLBACK TO SAVEPOINT sp');
      throw error;
    }
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: CADENA, max: 1 });
    cliente = await pool.connect();
    await cliente.query('BEGIN');

    const hash = await hashearContrasena('clave-de-prueba-integracion');

    // usuarios de prueba
    const docente = await comoApi(
      `SELECT crear_usuario($1,$2,'docente',$3,$4::bytea, now() + interval '1 day') AS id`,
      ['Docente Prueba', 'c.docente@utp.edu.pe', hash, HASH_VERIFICACION]
    );
    docenteId = Number(docente.rows[0].id);
    for (let i = 1; i <= 3; i++) {
      const r = await comoApi(
        `SELECT crear_usuario($1,$2,'estudiante',$3,$4::bytea, now() + interval '1 day') AS id`,
        [`Estudiante ${i}`, `u2023000${i}@utp.edu.pe`, hash, HASH_VERIFICACION]
      );
      estudianteIds.push(Number(r.rows[0].id));
    }
    // verificacion de correo por la funcion oficial (limpia el hash de verificacion)
    for (const correo of [
      'c.docente@utp.edu.pe',
      ...estudianteIds.map((_, i) => `u2023000${i + 1}@utp.edu.pe`)
    ]) {
      const r = await comoApi(`SELECT confirmar_correo($1, $2) AS ok`, [
        correo,
        HASH_VERIFICACION
      ]);
      expect(r.rows[0].ok).toBe(true);
    }

    // seccion, matriculas y asignacion
    const seccion = await comoApi(
      `INSERT INTO secciones (codigo_curso, nombre_curso, periodo_academico, codigo)
       VALUES ('IF5100','Ingenieria de Software','2026-1','P1') RETURNING id`
    );
    seccionId = Number(seccion.rows[0].id);
    for (const est of estudianteIds) {
      const m = await comoApi(
        `INSERT INTO matriculas (seccion_id, estudiante_id) VALUES ($1,$2) RETURNING id`,
        [seccionId, est]
      );
      matriculaIds.push(Number(m.rows[0].id));
    }
    await comoApi(
      `INSERT INTO asignaciones_docentes (seccion_id, docente_id) VALUES ($1,$2)`,
      [seccionId, docenteId]
    );

    // eleccion principal con ventana corta: se cierra por tiempo real
    const eleccion = await comoApi(
      `INSERT INTO elecciones (seccion_id, nombre, inicia_en, cierra_en, creada_por_usuario_id)
       VALUES ($1,'Delegado 2026-1', now() - interval '1 minute',
               now() + interval '45 seconds', $2) RETURNING id`,
      [seccionId, docenteId]
    );
    eleccionId = Number(eleccion.rows[0].id);

    for (const mat of matriculaIds.slice(0, 2)) {
      const c = await comoApi(
        `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
         VALUES ($1,$2,$3) RETURNING id`,
        [eleccionId, seccionId, mat]
      );
      candidaturaIds.push(Number(c.rows[0].id));
    }
    for (const mat of matriculaIds) {
      await comoApi(
        `INSERT INTO habilitaciones_voto (eleccion_id, seccion_id, matricula_id)
         VALUES ($1,$2,$3)`,
        [eleccionId, seccionId, mat]
      );
    }
  });

  afterAll(async () => {
    await cliente.query('ROLLBACK');
    cliente.release();
    await pool.end();
  });

  it('exige dos candidaturas para programar', async () => {
    // se quita una candidatura, programar debe fallar
    const borrada = candidaturaIds.shift();
    await comoApi(`DELETE FROM candidaturas WHERE id = $1`, [borrada]);
    await expect(
      comoApi(`SELECT programar_eleccion($1,$2)`, [eleccionId, docenteId])
    ).rejects.toThrow(/al menos dos candidaturas/);
    const c = await comoApi(
      `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
       VALUES ($1,$2,$3) RETURNING id`,
      [eleccionId, seccionId, matriculaIds[0] ?? 0]
    );
    candidaturaIds.push(Number(c.rows[0].id));
  });

  it('programa y activa la eleccion', async () => {
    await comoApi(`SELECT programar_eleccion($1,$2)`, [eleccionId, docenteId]);
    await comoApi(`SELECT activar_eleccion($1)`, [eleccionId]);
    const estado = await comoAdmin(`SELECT estado FROM elecciones WHERE id = $1`, [eleccionId]);
    expect(estado.rows[0].estado).toBe('activa');
  });

  it('el rol API no puede leer votos ni insertar auditoria directamente', async () => {
    await expect(comoApi(`SELECT * FROM votos LIMIT 1`)).rejects.toThrow();
    await expect(
      comoApi(
        `INSERT INTO eventos_auditoria (eleccion_id, tipo_evento, actor_tipo)
         VALUES ($1,'creacion','sistema')`,
        [eleccionId]
      )
    ).rejects.toThrow();
  });

  it('registra votos atomicos y bloquea el doble voto', async () => {
    const v1 = await comoApi(
      `SELECT registrar_voto($1,$2,$3) AS id`,
      [eleccionId, estudianteIds[0], candidaturaIds[0]]
    );
    expect(Number(v1.rows[0].id)).toBeGreaterThan(0);
    await comoApi(`SELECT registrar_voto($1,$2,$3)`, [
      eleccionId,
      estudianteIds[1] ?? 0,
      candidaturaIds[0]
    ]);
    await expect(
      comoApi(`SELECT registrar_voto($1,$2,$3)`, [
        eleccionId,
        estudianteIds[0],
        candidaturaIds[0]
      ])
    ).rejects.toThrow(/habilitado o voto ya registrado/);
  });

  it('el conteo agregado refleja exactamente los votos', async () => {
    const conteo = await comoApi(`SELECT * FROM contar_votos_eleccion($1)`, [eleccionId]);
    const total = conteo.rows.reduce((s: number, f: { votos: string }) => s + Number(f.votos), 0);
    expect(total).toBe(2);
  });

  it('los votos y resultados son inmutables', async () => {
    await expect(
      comoAdmin(`DELETE FROM votos WHERE eleccion_id = $1`, [eleccionId])
    ).rejects.toThrow(/inmutable/);
  });

  it('cierra, publica y determina ganador unico', async () => {
    // se espera el cierre real por horario (la reconfiguracion en activa esta prohibida)
    await new Promise((resolver) => setTimeout(resolver, 46_000));
    await comoApi(`SELECT cerrar_y_publicar_resultados($1)`, [eleccionId]);
    const resumen = await comoAdmin(
      `SELECT situacion, ganador_candidatura_id FROM resumen_resultados_publicados
       WHERE eleccion_id = $1`,
      [eleccionId]
    );
    expect(resumen.rows[0].situacion).toBe('ganador');
    expect(resumen.rows[0].ganador_candidatura_id).not.toBeNull();
  });

  it('delega al ganador y permite evaluaciones', async () => {
    const resumen = await comoAdmin(
      `SELECT ganador_candidatura_id FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
      [eleccionId]
    );
    const delegacion = await comoApi(
      `INSERT INTO delegaciones (eleccion_id, seccion_id, candidatura_id, inicia_en)
       VALUES ($1,$2,$3, now()) RETURNING id`,
      [eleccionId, seccionId, resumen.rows[0].ganador_candidatura_id]
    );
    const periodo = await comoApi(
      `INSERT INTO periodos_evaluacion (delegacion_id, seccion_id, abre_en, cierra_en)
       VALUES ($1,$2, now(), now() + interval '1 day') RETURNING id`,
      [Number(delegacion.rows[0].id), seccionId]
    );
    await comoApi(
      `INSERT INTO evaluaciones_estudiantes (periodo_evaluacion_id, seccion_id, matricula_id, calificacion, comentario)
       VALUES ($1,$2,$3,8,'Buen trabajo')`,
      [Number(periodo.rows[0].id), seccionId, matriculaIds[0] ?? 0]
    );
    await expect(
      comoApi(
        `INSERT INTO evaluaciones_docentes (periodo_evaluacion_id, seccion_id, asignacion_docente_id, calificacion, comentario)
         VALUES ($1,$2,(SELECT id FROM asignaciones_docentes WHERE seccion_id=$2 AND docente_id=$3),7,'corto')`,
        [Number(periodo.rows[0].id), seccionId, docenteId]
      )
    ).rejects.toThrow();
  });

  it('la auditoria quedo registrada', async () => {
    const eventos = await comoAdmin(
      `SELECT tipo_evento FROM eventos_auditoria WHERE eleccion_id = $1 ORDER BY id`,
      [eleccionId]
    );
    const tipos = eventos.rows.map((f: { tipo_evento: string }) => f.tipo_evento);
    expect(tipos).toContain('creacion');
    expect(tipos).toContain('activacion');
    expect(tipos).toContain('cierre_publicacion');
  });

  it('el rol de aprovisionamiento no gestiona datos electorales', async () => {
    await expect(
      comoProvisionamiento(`SELECT * FROM elecciones LIMIT 1`)
    ).rejects.toThrow();
  });
});
