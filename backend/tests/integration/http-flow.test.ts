import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Pool, type PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { loadServerEnv } from '../../src/config/env';
import { createApp } from '../../src/app';
import { createContext, type ApiContext } from '../../src/presentation/context';
import { hashPassword } from '../../src/application/services/passwords';
import {
  ResultsPublisher,
  type ResultLoad
} from '../../src/application/services/realtime';

// Flujo HTTP completo de los endpoints de §10 sobre TEST_DATABASE_URL.
// Todo corre dentro de una unica transaccion con ROLLBACK (los votos son
// inmutables y no pueden borrarse de una BD compartida): la capa de datos
// se desvia al cliente de la transaccion mediante el mock de src/data/db
// y el puente de tests/helpers/transactional-pool.ts.

const CONNECTION_STRING = process.env.TEST_DATABASE_URL ?? '';
const CONNECTION_AVAILABLE = CONNECTION_STRING.length > 0;

const state = vi.hoisted(() => ({ client: null as PoolClient | null }));

vi.mock('../../src/data/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/data/db')>();
  // Resuelto por el runner de vitest sin extension (tsc exige la extensión
  // en importaciones dinamicas bajo resolucion node16).
  // @ts-expect-error ver comentario anterior
  const { createSavepointPool } = await import('../helpers/transactional-pool');
  const savepointPool = createSavepointPool(
    () => state.client as NonNullable<typeof state.client>
  );
  return {
    ...actual,
    getPool: () => savepointPool,
    withTransaction: ((fn: (client: PoolClient) => Promise<unknown>) =>
      actual.withTransaction(fn, savepointPool)) as unknown as typeof actual.withTransaction,
    // withClient delega en withTransaction del modulo real (referencia interna,
    // no la del mock): hay que redirigirlo tambien al puente o las lecturas
    // compondrian sobre el pool real y no verian la transaccion del test.
    withClient: ((fn: (client: PoolClient) => Promise<unknown>, tx?: PoolClient) =>
      tx
        ? fn(tx)
        : actual.withTransaction(fn, savepointPool)) as unknown as typeof actual.withClient,
    closePool: async () => undefined
  };
});

const env = loadServerEnv();
const PASSWORD = 'clave-de-prueba-fase-nueve';
const VERIFICATION_HASH = createHash('sha256').update('tok').digest();

interface Session {
  cookie: string;
  csrf: string;
}

function buildContext(): {
  ctx: ApiContext;
  publisher: ResultsPublisher;
  published: Array<{ electionId: number; load: ResultLoad }>;
} {
  const base = createContext(env);
  const real = base.publisher;
  const published: Array<{ electionId: number; load: ResultLoad }> = [];
  // Publicacion capturada (sin red): el ticket HMAC es el real.
  const publisher = {
    subscription: (electionId: number, now?: number) =>
      real.subscription(electionId, now),
    ticket: (electionId: number, now?: number) => real.ticket(electionId, now),
    ticketFor: (electionId: number, expUnix: number) =>
      real.ticketFor(electionId, expUnix),
    channelName: (electionId: number, now?: number) =>
      real.channelName(electionId, now),
    publish: async (electionId: number, load: ResultLoad) => {
      published.push({ electionId, load });
    },
    close: async () => undefined,
    stop: async () => undefined
  } as unknown as ResultsPublisher;
  return { ctx: { env, mail: base.mail, publisher }, publisher, published };
}

const { ctx, publisher } = buildContext();
const app: Express = createApp(env, ctx);

describe.skipIf(!CONNECTION_AVAILABLE)(
  'flujo HTTP de la API sobre la BD de prueba (transaccion con rollback)',
  () => {
    let pool: Pool;
    let client: PoolClient;
    let teacherId = 0;
    const students: Record<'s1' | 's2' | 's3' | 's4', number> = {
      s1: 0,
      s2: 0,
      s3: 0,
      s4: 0
    };
    interface Sessions {
      teacher: Session;
      admin: Session;
      s1: Session;
      s2: Session;
      s3: Session;
      s4: Session;
    }

    const emptySession = (): Session => ({ cookie: '', csrf: '' });
    const sessions: Sessions = {
      teacher: emptySession(),
      admin: emptySession(),
      s1: emptySession(),
      s2: emptySession(),
      s3: emptySession(),
      s4: emptySession()
    };
    let section1 = { id: 0, code: '' };
    let section2 = { id: 0, code: '' };
    let election1 = 0;
    let candidacy1 = 0;
    let candidacy2 = 0;
    let election2 = 0;
    let tieCandidacy1 = 0;
    let tieCandidacy2 = 0;
    let tiebreakElection = 0;
    let delegation = 0;
    let period1 = 0;
    let period2 = 0;
    let period3 = 0;

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
        await client.query('RESET ROLE');
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
        await client.query('RESET ROLE');
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

    const enrollmentId = async (seccionId: number, estudianteId: number) => {
      const result = await asAdmin(
        `SELECT id FROM matriculas WHERE seccion_id = $1 AND estudiante_id = $2`,
        [seccionId, estudianteId]
      );
      return Number(result.rows[0]?.id ?? 0);
    };

    const login = async (email: string): Promise<Session> => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ correo: email, contrasena: PASSWORD });
      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      const value = (name: string): string => {
        const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
        return found ? (found.split(';')[0] ?? '') : '';
      };
      return {
        cookie: [value('votecure_sesion'), value('votecure_csrf')].join('; '),
        csrf: (value('votecure_csrf').split('=')[1] ?? '')
      };
    };

    const post = (session: Session, path: string, body?: string | object) =>
      request(app)
        .post(path)
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrf)
        .send(body);

    const patch = (session: Session, path: string, body?: string | object) =>
      request(app)
        .patch(path)
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrf)
        .send(body);

    const get = (session: Session, path: string) =>
      request(app).get(path).set('Cookie', session.cookie);

    const iso = (minutesFromNow: number) =>
      new Date(Date.now() + minutesFromNow * 60_000).toISOString();

    beforeAll(async () => {
      // Timeout de conexion: el host directo de Supabase resuelve DNS de
      // forma intermitente y un valor infinito cuelga el beforeAll.
      pool = new Pool({
        connectionString: CONNECTION_STRING,
        max: 1,
        connectionTimeoutMillis: 15_000
      });
      client = await pool.connect();
      state.client = client;
      await client.query('BEGIN');

      const hash = await hashPassword(PASSWORD);
      const teacher = await asApi(
        `SELECT crear_usuario($1,$2,'docente',$3,$4::bytea, now() + interval '1 day') AS id`,
        ['Docente Fase Nueve', 'c.fase9.docente@utp.edu.pe', hash, VERIFICATION_HASH]
      );
      teacherId = Number(teacher.rows[0].id);
      const names: Array<['s1' | 's2' | 's3' | 's4', string, string]> = [
        ['s1', 'Alumna Uno Fase9', 'u.fase9.alumno1@utp.edu.pe'],
        ['s2', 'Alumno Dos Fase9', 'u.fase9.alumno2@utp.edu.pe'],
        ['s3', 'Alumna Tres Fase9', 'u.fase9.alumno3@utp.edu.pe'],
        ['s4', 'Alumno Cuatro Fase9', 'u.fase9.alumno4@utp.edu.pe']
      ];
      for (const [key, name, email] of names) {
        const result = await asApi(
          `SELECT crear_usuario($1,$2,'estudiante',$3,$4::bytea, now() + interval '1 day') AS id`,
          [name, email, hash, VERIFICATION_HASH]
        );
        students[key] = Number(result.rows[0].id);
      }
      await asProvisioning(
        `INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena,
           verificacion_hash, verificacion_expira_en)
         VALUES ($1,$2,'administrador',$3,$4::bytea, now() + interval '1 day')
         RETURNING id`,
        ['Admin Fase Nueve', 'admin.fase9@utp.edu.pe', hash, VERIFICATION_HASH]
      );

      for (const email of [
        'c.fase9.docente@utp.edu.pe',
        'u.fase9.alumno1@utp.edu.pe',
        'u.fase9.alumno2@utp.edu.pe',
        'u.fase9.alumno3@utp.edu.pe',
        'u.fase9.alumno4@utp.edu.pe',
        'admin.fase9@utp.edu.pe'
      ]) {
        const result = await asApi(`SELECT confirmar_correo($1, $2) AS ok`, [
          email,
          VERIFICATION_HASH
        ]);
        expect(result.rows[0].ok).toBe(true);
      }

      sessions.teacher = await login('c.fase9.docente@utp.edu.pe');
      sessions.admin = await login('admin.fase9@utp.edu.pe');
      sessions.s1 = await login('u.fase9.alumno1@utp.edu.pe');
      sessions.s2 = await login('u.fase9.alumno2@utp.edu.pe');
      sessions.s3 = await login('u.fase9.alumno3@utp.edu.pe');
      sessions.s4 = await login('u.fase9.alumno4@utp.edu.pe');
    });

    afterAll(async () => {
      await client.query('ROLLBACK');
      state.client = null;
      client.release();
      await pool.end();
    });

    it('el docente crea su seccion y queda como su responsable (§3.1, §10)', async () => {
      const response = await post(sessions.teacher, '/api/secciones', {
        codigoCurso: 'IF7701',
        nombreCurso: 'Arquitectura de Software',
        periodoAcademico: '2026-2'
      });
      expect(response.status).toBe(201);
      expect(response.body.seccion.code).toMatch(/^SEC-[A-HJ-KM-NP-Z2-9]{4}$/);
      section1 = { id: response.body.seccion.id, code: response.body.seccion.code };
      const assigned = await asAdmin(
        `SELECT 1 FROM asignaciones_docentes WHERE seccion_id = $1 AND docente_id = $2 AND activa`,
        [section1.id, teacherId]
      );
      expect(assigned.rowCount).toBe(1);
    });

    it('solo docente y administrador crean secciones (§10)', async () => {
      const denied = await post(sessions.s1, '/api/secciones', {
        codigoCurso: 'IF7702',
        nombreCurso: 'No permitido',
        periodoAcademico: '2026-2'
      });
      expect(denied.status).toBe(403);
      const allowed = await post(sessions.admin, '/api/secciones', {
        codigoCurso: 'IF7702',
        nombreCurso: 'Calculo Numerico',
        periodoAcademico: '2026-2'
      });
      expect(allowed.status).toBe(201);
      section2 = { id: allowed.body.seccion.id, code: allowed.body.seccion.code };
    });

    it('el administrador asigna al docente de la seccion que creo', async () => {
      const response = await post(
        sessions.admin,
        `/api/secciones/${section2.id}/asignaciones`,
        { docenteId: teacherId }
      );
      expect(response.status).toBe(201);
    });

    it('los estudiantes se unen por codigo y el duplicado se rechaza (§3.1)', async () => {
      for (const key of ['s1', 's2', 's3'] as const) {
        const response = await post(sessions[key], '/api/secciones/unirse', {
          codigo: section1.code
        });
        expect(response.status).toBe(200);
        expect(response.body.seccion.id).toBe(section1.id);
      }
      const duplicate = await post(sessions.s1, '/api/secciones/unirse', {
        codigo: section1.code
      });
      expect(duplicate.status).toBe(409);
      const malformed = await post(sessions.s4, '/api/secciones/unirse', {
        codigo: 'SEC-0O1I'
      });
      expect(malformed.status).toBe(400);
      const missing = await post(sessions.s4, '/api/secciones/unirse', {
        codigo: 'SEC-ZZZZ'
      });
      expect(missing.status).toBe(404);
    });

    it('el docente puede bloquear las inscripciones de su seccion (§3.1)', async () => {
      const denied = await patch(sessions.s1, `/api/secciones/${section2.id}`, {
        activa: false
      });
      expect(denied.status).toBe(403);
      const toggle = await patch(sessions.teacher, `/api/secciones/${section2.id}`, {
        activa: false
      });
      expect(toggle.status).toBe(200);
      const blocked = await post(sessions.s3, '/api/secciones/unirse', {
        codigo: section2.code
      });
      expect(blocked.status).toBe(422);
      expect(blocked.body.error).toBe('NEGOCIO');
    });

    it('el docente crea la eleccion, registra candidaturas y la programa (§3.2)', async () => {
      const created = await post(sessions.teacher, '/api/elecciones', {
        seccionId: section1.id,
        nombre: 'Delegado 2026-2',
        iniciaEn: iso(-1),
        cierraEn: iso(30)
      });
      expect(created.status).toBe(201);
      election1 = created.body.eleccion.id;
      expect(created.body.eleccion.status).toBe('borrador');

      const m1 = await enrollmentId(section1.id, students.s1);
      const m2 = await enrollmentId(section1.id, students.s2);
      const first = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/candidaturas`,
        { matriculaId: m1 }
      );
      expect(first.status).toBe(201);
      candidacy1 = first.body.candidatura.id;
      const second = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/candidaturas`,
        { matriculaId: m2 }
      );
      expect(second.status).toBe(201);
      candidacy2 = second.body.candidatura.id;

      const denied = await post(
        sessions.s1,
        `/api/elecciones/${election1}/candidaturas`,
        { matriculaId: m2 }
      );
      expect(denied.status).toBe(403);

      const scheduled = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/programar`
      );
      expect(scheduled.status).toBe(200);
    });

    it('activar congela el padron desde las matriculas activas (§3.2)', async () => {
      const activated = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/activar`
      );
      expect(activated.status).toBe(200);

      // s4 se matricula despues de la activacion: queda fuera del padron.
      const joined = await post(sessions.s4, '/api/secciones/unirse', {
        codigo: section1.code
      });
      expect(joined.status).toBe(200);

      const electorate = await asAdmin(
        `SELECT count(*) AS total FROM habilitaciones_voto WHERE eleccion_id = $1`,
        [election1]
      );
      expect(Number(electorate.rows[0].total)).toBe(3);

      const late = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/habilitaciones`,
        { matriculaId: await enrollmentId(section1.id, students.s4) }
      );
      expect(late.status).toBe(422);
      expect(late.body.mensaje).toBe('El padron y las candidaturas ya estan cerrados');
    });

    it('el estudiante vota una sola vez y no habilitado no vota (§4.1)', async () => {
      const vote1 = await post(sessions.s1, `/api/elecciones/${election1}/votar`, {
        candidaturaId: candidacy1
      });
      expect(vote1.status).toBe(201);
      expect(vote1.body.confirmed).toBe(true);

      const repeat = await post(sessions.s1, `/api/elecciones/${election1}/votar`, {
        candidaturaId: candidacy1
      });
      expect(repeat.status).toBe(422);

      const vote2 = await post(sessions.s2, `/api/elecciones/${election1}/votar`, {
        candidaturaId: candidacy2
      });
      expect(vote2.status).toBe(201);
      const vote3 = await post(sessions.s3, `/api/elecciones/${election1}/votar`, {
        candidaturaId: candidacy2
      });
      expect(vote3.status).toBe(201);

      const byTeacher = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/votar`,
        { candidaturaId: candidacy1 }
      );
      expect(byTeacher.status).toBe(403);

      const notEligible = await post(
        sessions.s4,
        `/api/elecciones/${election1}/votar`,
        { candidaturaId: candidacy1 }
      );
      expect(notEligible.status).toBe(422);

      const votes = await asAdmin(
        `SELECT count(*) AS total FROM votos WHERE eleccion_id = $1`,
        [election1]
      );
      expect(Number(votes.rows[0].total)).toBe(3);
    });

    it('resultados en vivo y suscripcion con ticket HMAC efimero (§5.1)', async () => {
      const live = await get(sessions.s1, `/api/elecciones/${election1}/resultados`);
      expect(live.status).toBe(200);
      expect(live.body.tipo).toBe('en_vivo');
      expect(live.body.totalVotos).toBe(3);
      expect(live.body.yaVoto).toBe(true);

      expect(
        (await get(sessions.teacher, `/api/elecciones/${election1}/resultados`)).status
      ).toBe(200);
      expect(
        (await get(sessions.admin, `/api/elecciones/${election1}/resultados`)).status
      ).toBe(200);
      const outsider = await get(
        sessions.s4,
        `/api/elecciones/${election1}/resultados`
      );
      expect(outsider.status).toBe(403);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = await post(
        sessions.s1,
        `/api/resultados/${election1}/suscripcion`
      );
      expect(subscription.status).toBe(200);
      const { canal, expiraEn } = subscription.body as {
        canal: string;
        expiraEn: number;
      };
      expect(canal).toBe(
        `resultados:${election1}:${publisher.ticketFor(election1, expiraEn)}`
      );
      expect(expiraEn % 60).toBe(0);
      expect(expiraEn - nowSeconds).toBeGreaterThan(0);
      expect(expiraEn - nowSeconds).toBeLessThanOrEqual(60);

      expect(
        (
          await post(sessions.teacher, `/api/resultados/${election1}/suscripcion`)
        ).status
      ).toBe(200);
      expect(
        (await post(sessions.s4, `/api/resultados/${election1}/suscripcion`)).status
      ).toBe(403);

      // El ticket expira al rotar la ventana de un minuto.
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date((expiraEn + 1) * 1000));
        const rotated = await post(
          sessions.s1,
          `/api/resultados/${election1}/suscripcion`
        );
        expect(rotated.status).toBe(200);
        expect(rotated.body.canal).not.toBe(canal);
        expect(rotated.body.expiraEn).toBeGreaterThan(expiraEn);
      } finally {
        vi.useRealTimers();
      }
    });

    it('el cierre manual anticipado publica los resultados definitivos (§6.1)', async () => {
      const closed = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/cerrar`
      );
      expect(closed.status).toBe(200);

      const final = await get(sessions.s1, `/api/elecciones/${election1}/resultados`);
      expect(final.status).toBe(200);
      expect(final.body.tipo).toBe('final');
      expect(final.body.situation).toBe('ganador');
      expect(final.body.winnerCandidacyId).toBe(candidacy2);

      const summary = await asAdmin(
        `SELECT situacion FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
        [election1]
      );
      expect(summary.rows[0].situacion).toBe('ganador');
      const audit = await asAdmin(
        `SELECT detalle FROM eventos_auditoria
          WHERE eleccion_id = $1 AND tipo_evento = 'cierre_publicacion'`,
        [election1]
      );
      expect(audit.rows[0].detalle.anticipado).toBe(true);

      const lateVote = await post(
        sessions.s1,
        `/api/elecciones/${election1}/votar`,
        { candidaturaId: candidacy1 }
      );
      expect(lateVote.status).toBe(422);
      expect(
        (
          await post(sessions.s1, `/api/resultados/${election1}/suscripcion`)
        ).status
      ).toBe(403);
    });

    it('el desempate auto-carga a los candidatos empatados (§6.2)', async () => {
      expect(
        (
          await patch(sessions.admin, `/api/secciones/${section2.id}`, {
            activa: true
          })
        ).status
      ).toBe(200);
      for (const key of ['s1', 's2'] as const) {
        expect(
          (await post(sessions[key], '/api/secciones/unirse', { codigo: section2.code }))
            .status
        ).toBe(200);
      }

      const created = await post(sessions.teacher, '/api/elecciones', {
        seccionId: section2.id,
        nombre: 'Delegado Calculo',
        iniciaEn: iso(-1),
        cierraEn: iso(30)
      });
      expect(created.status).toBe(201);
      election2 = created.body.eleccion.id;

      const m1 = await enrollmentId(section2.id, students.s1);
      const m2 = await enrollmentId(section2.id, students.s2);
      const first = await post(
        sessions.teacher,
        `/api/elecciones/${election2}/candidaturas`,
        { matriculaId: m1 }
      );
      tieCandidacy1 = first.body.candidatura.id;
      const second = await post(
        sessions.teacher,
        `/api/elecciones/${election2}/candidaturas`,
        { matriculaId: m2 }
      );
      tieCandidacy2 = second.body.candidatura.id;

      expect(
        (await post(sessions.teacher, `/api/elecciones/${election2}/programar`))
          .status
      ).toBe(200);
      expect(
        (await post(sessions.teacher, `/api/elecciones/${election2}/activar`)).status
      ).toBe(200);
      expect(
        (
          await post(sessions.s1, `/api/elecciones/${election2}/votar`, {
            candidaturaId: tieCandidacy1
          })
        ).status
      ).toBe(201);
      expect(
        (
          await post(sessions.s2, `/api/elecciones/${election2}/votar`, {
            candidaturaId: tieCandidacy2
          })
        ).status
      ).toBe(201);
      expect(
        (await post(sessions.teacher, `/api/elecciones/${election2}/cerrar`)).status
      ).toBe(200);
      const summary = await asAdmin(
        `SELECT situacion FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
        [election2]
      );
      expect(summary.rows[0].situacion).toBe('empate');

      // La ventana del balotaje es de 15 a 30 minutos (§6.2).
      const tooShort = await post(sessions.teacher, '/api/elecciones', {
        seccionId: section2.id,
        nombre: 'Desempate invalido',
        tipo: 'desempate',
        eleccionOrigenId: election2,
        iniciaEn: iso(1),
        cierraEn: iso(11)
      });
      expect(tooShort.status).toBe(400);

      const withoutTie = await post(sessions.teacher, '/api/elecciones', {
        seccionId: section1.id,
        nombre: 'Desempate sin empate',
        tipo: 'desempate',
        eleccionOrigenId: election1,
        iniciaEn: iso(-1),
        cierraEn: iso(19)
      });
      expect(withoutTie.status).toBe(422);

      const tiebreak = await post(sessions.teacher, '/api/elecciones', {
        seccionId: section2.id,
        nombre: 'Desempate Calculo',
        tipo: 'desempate',
        eleccionOrigenId: election2,
        iniciaEn: iso(-1),
        cierraEn: iso(19)
      });
      expect(tiebreak.status).toBe(201);
      tiebreakElection = tiebreak.body.eleccion.id;

      const detail = await get(
        sessions.teacher,
        `/api/elecciones/${tiebreakElection}`
      );
      expect(detail.status).toBe(200);
      const enrollmentIds = detail.body.candidacies.map(
        (candidacy: { enrollmentId: number }) => candidacy.enrollmentId
      );
      expect(enrollmentIds.sort()).toEqual([m1, m2].sort());

      expect(
        (
          await post(sessions.teacher, `/api/elecciones/${tiebreakElection}/programar`)
        ).status
      ).toBe(200);
      expect(
        (await post(sessions.teacher, `/api/elecciones/${tiebreakElection}/activar`))
          .status
      ).toBe(200);
    });

    it('solo con ganador unico se proclama el delegado (§6.3)', async () => {
      // Fechas en el pasado: las consultas con now() de PostgreSQL quedan
      // congeladas al iniciar la transaccion del test.
      const proclaimed = await post(
        sessions.teacher,
        `/api/elecciones/${election1}/proclamar`,
        { iniciaEn: iso(-120) }
      );
      expect(proclaimed.status).toBe(201);
      delegation = proclaimed.body.delegacionId;
      expect(delegation).toBeGreaterThan(0);

      const tied = await post(
        sessions.teacher,
        `/api/elecciones/${election2}/proclamar`,
        { iniciaEn: iso(0) }
      );
      expect(tied.status).toBe(403);
    });

    it('el periodo de evaluacion exige instrucciones (§7.1)', async () => {
      const instructions = 'Evalua el desempeno del delegado durante el ciclo.';
      const period = await post(sessions.teacher, '/api/evaluaciones/periodos', {
        delegacionId: delegation,
        abreEn: iso(-90),
        cierraEn: iso(7 * 24 * 60),
        instrucciones: instructions
      });
      expect(period.status).toBe(201);
      expect(period.body.periodoId).toBeGreaterThan(0);
      period1 = period.body.periodoId;

      const invalid = await post(sessions.teacher, '/api/evaluaciones/periodos', {
        delegacionId: delegation,
        abreEn: iso(-90),
        cierraEn: iso(7 * 24 * 60),
        instrucciones: 'muy corta'
      });
      expect(invalid.status).toBe(400);

      // §7.2: el delegado no ve promedios mientras el periodo esta abierto;
      // un miembro que no es delegado jamas los ve.
      const view = await get(
        sessions.s2,
        `/api/evaluaciones/delegado?seccionId=${section1.id}`
      );
      expect(view.status).toBe(200);
      expect(view.body.periodoAbierto.instructions).toBe(instructions);
      expect(view.body.promediosPorPeriodo).toEqual([]);
      expect(view.body.promedioGlobal).toBeUndefined();
      const memberView = await get(
        sessions.s1,
        `/api/evaluaciones/delegado?seccionId=${section1.id}`
      );
      expect(memberView.status).toBe(200);
      expect(memberView.body.promediosPorPeriodo).toBeUndefined();

      const evaluation = await post(sessions.s1, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 8,
        comentario: 'Buen trabajo del delegado'
      });
      expect(evaluation.status).toBe(201);
      // §7.1: envio unico por periodo; un segundo intento se rechaza y la
      // evaluacion original se conserva.
      const repeated = await post(sessions.s1, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 9
      });
      expect(repeated.status).toBe(409);
      const studentVotes = await asAdmin(
        `SELECT calificacion FROM evaluaciones_estudiantes
          WHERE periodo_evaluacion_id = (
            SELECT id FROM periodos_evaluacion WHERE delegacion_id = $1)
            AND matricula_id = $2`,
        [delegation, await enrollmentId(section1.id, students.s1)]
      );
      expect(studentVotes.rowCount).toBe(1);
      expect(Number(studentVotes.rows[0].calificacion)).toBe(8);

      const shortTeacherComment = await post(sessions.teacher, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 9,
        comentario: 'corto'
      });
      expect(shortTeacherComment.status).toBe(422);
      const teacherEvaluation = await post(sessions.teacher, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 9,
        comentario: 'Buen liderazgo y organizacion del grupo de trabajo.'
      });
      expect(teacherEvaluation.status).toBe(201);
      const repeatedTeacher = await post(sessions.teacher, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 10,
        comentario: 'Segunda evaluacion del docente sobre el delegado.'
      });
      expect(repeatedTeacher.status).toBe(409);

      const byAdmin = await post(sessions.admin, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 10
      });
      expect(byAdmin.status).toBe(403);
    });

    it('admite hasta 3 periodos por delegacion y rechaza solapamientos (§7.1)', async () => {
      // p1 ya existe (abierto). Se abren dos periodos futuros disjuntos:
      // la ventana debe quedar dentro de la vigencia de la delegacion.
      const second = await post(sessions.teacher, '/api/evaluaciones/periodos', {
        delegacionId: delegation,
        abreEn: iso(8 * 24 * 60),
        cierraEn: iso(9 * 24 * 60),
        instrucciones: 'Segunda evaluacion del ciclo: desempeno y compromiso.'
      });
      expect(second.status).toBe(201);
      period2 = second.body.periodoId;

      // Solapada con p2: la rechaza el trigger aunque queden cupos.
      const overlap = await post(
        sessions.teacher,
        '/api/evaluaciones/periodos',
        {
          delegacionId: delegation,
          abreEn: iso(8 * 24 * 60 + 30),
          cierraEn: iso(8 * 24 * 60 + 90),
          instrucciones: 'Intento solapado con el segundo periodo del ciclo.'
        }
      );
      expect(overlap.status).toBe(422);
      expect(overlap.body.error).toBe('NEGOCIO');
      expect(overlap.body.mensaje).toMatch(/solapa/);

      const third = await post(sessions.teacher, '/api/evaluaciones/periodos', {
        delegacionId: delegation,
        abreEn: iso(10 * 24 * 60),
        cierraEn: iso(11 * 24 * 60),
        instrucciones: 'Tercera evaluacion del ciclo: balance final del ciclo.'
      });
      expect(third.status).toBe(201);
      period3 = third.body.periodoId;

      const fourth = await post(sessions.teacher, '/api/evaluaciones/periodos', {
        delegacionId: delegation,
        abreEn: iso(12 * 24 * 60),
        cierraEn: iso(13 * 24 * 60),
        instrucciones: 'Cuarto intento que excede el maximo de periodos.'
      });
      expect(fourth.status).toBe(422);
      expect(fourth.body.mensaje).toMatch(/3 periodos/);
    });

    it('registra una evaluacion por periodo con periodoId explicito (§7.1)', async () => {
      // p1 ya recibio la evaluacion de s1 y del docente. Se cierra p1 y se
      // abre p2 sobre el instante real reajustando ventanas: now() de la
      // transaccion esta congelado, pero controlar_evaluacion usa
      // clock_timestamp() (tiempo real) y exige la ventana vigente.
      await asAdmin(
        `UPDATE periodos_evaluacion
           SET abre_en = now() - interval '110 minutes',
               cierra_en = now() - interval '60 minutes'
         WHERE id = $1`,
        [period1]
      );
      await asAdmin(
        `UPDATE periodos_evaluacion
           SET abre_en = now() - interval '50 minutes',
               cierra_en = now() + interval '2 hours'
         WHERE id = $1`,
        [period2]
      );

      // s3 evalua en p2 con resolucion implicita del periodo abierto.
      const implicit = await post(sessions.s3, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 7,
        comentario: 'Buen manejo del grupo en el segundo periodo'
      });
      expect(implicit.status).toBe(201);

      // s1 ya evaluo en p1 y puede volver a evaluar en p2 (una por periodo).
      const explicit = await post(sessions.s1, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 9,
        comentario: 'Mejor organizacion en la segunda revision',
        periodoId: period2
      });
      expect(explicit.status).toBe(201);
      const duplicate = await post(sessions.s1, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 5,
        periodoId: period2
      });
      expect(duplicate.status).toBe(409);

      // El docente tambien evalua una vez por periodo.
      const teacherSecond = await post(sessions.teacher, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 8,
        comentario: 'Segundo periodo con buena participacion del grupo.',
        periodoId: period2
      });
      expect(teacherSecond.status).toBe(201);
      const teacherDuplicate = await post(sessions.teacher, '/api/evaluaciones', {
        seccionId: section1.id,
        calificacion: 6,
        comentario: 'Intento repetido del docente en el mismo periodo.',
        periodoId: period2
      });
      expect(teacherDuplicate.status).toBe(409);
    });

    it('el resumen muestra promedios por periodo y global (§7.2)', async () => {
      const summary = await get(
        sessions.teacher,
        `/api/evaluaciones/resumen?seccionId=${section1.id}`
      );
      expect(summary.status).toBe(200);
      const resumen = summary.body.resumen;
      expect(resumen.periodos).toHaveLength(3);
      // p1: solo s1 evaluo (8). p2: s3 (7) y s1 (9). p3: sin evaluaciones.
      expect(resumen.periodos[0].studentAverage).toBe(8);
      expect(resumen.periodos[0].teacherAverage).toBe(9);
      expect(resumen.periodos[1].studentAverage).toBe(8);
      expect(resumen.periodos[1].totalStudentEvaluations).toBe(2);
      expect(resumen.periodos[1].studentComments).toContain(
        'Mejor organizacion en la segunda revision'
      );
      expect(resumen.periodos[2].studentAverage).toBeNull();
      expect(resumen.periodos[2].totalStudentEvaluations).toBe(0);
      // Global del ciclo: avg(8,7,9) = 8; docente avg(9,8) = 8.5.
      expect(resumen.global.studentAverage).toBe(8);
      expect(resumen.global.totalStudentEvaluations).toBe(3);
      expect(resumen.global.teacherAverage).toBe(8.5);
      expect(resumen.global.totalTeacherRatings).toBe(2);
    });

    it('el delegado ve promedios por periodo tras cada cierre y el global al final (§7.2)', async () => {
      // Cierra los 3 periodos con ventanas pasadas disjuntas ancladas a
      // inicia_en de la delegacion: now() de la transaccion esta congelado
      // y arranca antes que la proclamacion, pues now() - '120 minutes'
      // quedaria fuera de la delegacion.
      await asAdmin(
        `UPDATE periodos_evaluacion p
            SET abre_en = d.inicia_en + interval '1 minute',
                cierra_en = d.inicia_en + interval '20 minutes'
           FROM delegaciones d
          WHERE d.id = p.delegacion_id AND p.id = $1`,
        [period1]
      );
      await asAdmin(
        `UPDATE periodos_evaluacion p
            SET abre_en = d.inicia_en + interval '21 minutes',
                cierra_en = d.inicia_en + interval '40 minutes'
           FROM delegaciones d
          WHERE d.id = p.delegacion_id AND p.id = $1`,
        [period2]
      );
      await asAdmin(
        `UPDATE periodos_evaluacion p
            SET abre_en = d.inicia_en + interval '41 minutes',
                cierra_en = d.inicia_en + interval '60 minutes'
           FROM delegaciones d
          WHERE d.id = p.delegacion_id AND p.id = $1`,
        [period3]
      );

      const closed = await get(
        sessions.s2,
        `/api/evaluaciones/delegado?seccionId=${section1.id}`
      );
      expect(closed.status).toBe(200);
      expect(closed.body.periodoAbierto).toBeNull();
      expect(closed.body.promediosPorPeriodo).toHaveLength(3);
      expect(
        closed.body.promediosPorPeriodo.map(
          (item: { promedio: number | null }) => item.promedio
        )
      ).toEqual([8, 8, null]);
      expect(closed.body.promedioGlobal).toBe(8);

      // Con un periodo reabierto: sin global y solo los cerrados.
      await asAdmin(
        `UPDATE periodos_evaluacion
           SET abre_en = now() - interval '1 minute',
               cierra_en = now() + interval '1 hour'
         WHERE id = $1`,
        [period3]
      );
      const reopened = await get(
        sessions.s2,
        `/api/evaluaciones/delegado?seccionId=${section1.id}`
      );
      expect(reopened.status).toBe(200);
      expect(reopened.body.periodoAbierto.id).toBe(period3);
      expect(reopened.body.promediosPorPeriodo).toHaveLength(2);
      expect(reopened.body.promedioGlobal).toBeUndefined();
    });

    it('la auditoria es exclusiva del administrador (§8)', async () => {
      expect(
        (await get(sessions.s1, `/api/auditoria/elecciones/${election1}`)).status
      ).toBe(403);
      expect(
        (await get(sessions.teacher, `/api/auditoria/elecciones/${election1}`)).status
      ).toBe(403);
      const audit = await get(
        sessions.admin,
        `/api/auditoria/elecciones/${election1}`
      );
      expect(audit.status).toBe(200);
      const types = audit.body.eventos.map(
        (event: { eventType: string }) => event.eventType
      );
      expect(types).toContain('creacion');
      expect(types).toContain('activacion');
      expect(types).toContain('cierre_publicacion');
    });

    it('la lectura de padrones y elecciones exige pertenencia a la seccion (F-001)', async () => {
      // s3 y s4 no estan matriculados en section2 (solo s1 y s2, desde el
      // desempate) y election2 pertenece a section2.
      expect((await get(sessions.s3, `/api/secciones/${section2.id}`)).status).toBe(403);
      expect((await get(sessions.s3, `/api/secciones/${section2.id}/matriculas`)).status).toBe(403);
      expect((await get(sessions.s3, `/api/secciones/${section2.id}/asignaciones`)).status).toBe(403);
      expect((await get(sessions.s3, `/api/elecciones?seccionId=${section2.id}`)).status).toBe(403);
      expect((await get(sessions.s3, `/api/elecciones/${election2}`)).status).toBe(403);
      expect((await get(sessions.s4, `/api/elecciones/${election2}`)).status).toBe(403);

      // El docente asignado y el administrador si acceden.
      expect((await get(sessions.teacher, `/api/secciones/${section2.id}/matriculas`)).status).toBe(200);
      expect((await get(sessions.admin, `/api/elecciones/${election2}`)).status).toBe(200);

      // Los miembros siguen teniendo acceso a su propia seccion.
      expect((await get(sessions.s1, `/api/secciones/${section1.id}/matriculas`)).status).toBe(200);
      expect((await get(sessions.s1, `/api/elecciones/${election1}`)).status).toBe(200);
    });

    it('la gestion de cuentas es del administrador y revoca sesiones (F-009)', async () => {
      // Un docente no gestiona cuentas.
      expect(
        (await patch(sessions.teacher, `/api/usuarios/${students.s4}`, { activa: false }))
          .status
      ).toBe(403);

      // Un administrador no se desactiva a si mismo (sin auto-bloqueo).
      const adminRow = await asAdmin(
        `SELECT id FROM usuarios WHERE correo = 'admin.fase9@utp.edu.pe'`
      );
      const adminId = Number(adminRow.rows[0].id);
      expect(
        (await patch(sessions.admin, `/api/usuarios/${adminId}`, { activa: false })).status
      ).toBe(422);

      // Desactivar revoca la sesion vigente del usuario.
      expect(
        (await patch(sessions.admin, `/api/usuarios/${students.s4}`, { activa: false }))
          .status
      ).toBe(200);
      expect((await get(sessions.s4, '/api/auth/yo')).status).toBe(401);
      expect(
        (await patch(sessions.admin, `/api/usuarios/${students.s4}`, { activa: true }))
          .status
      ).toBe(200);
      expect(
        (await patch(sessions.admin, '/api/usuarios/99999999', { activa: false })).status
      ).toBe(404);
    });

    it('el cambio de contrasena exige la actual e invalida la sesion (F-009)', async () => {
      const wrong = await post(sessions.s1, '/api/auth/cambiar-contrasena', {
        contrasenaActual: 'clave-incorrecta-larga',
        contrasenaNueva: 'una-clave-nueva-muy-segura'
      });
      expect(wrong.status).toBe(422);
      expect(wrong.body.error).toBe('NEGOCIO');

      const changed = await post(sessions.s1, '/api/auth/cambiar-contrasena', {
        contrasenaActual: PASSWORD,
        contrasenaNueva: 'una-clave-nueva-muy-segura'
      });
      expect(changed.status).toBe(200);
      // La sesion queda invalidada en la BD.
      expect((await get(sessions.s1, '/api/auth/yo')).status).toBe(401);
      // Y la nueva contrasena abre sesion.
      const relogin = await request(app)
        .post('/api/auth/login')
        .send({ correo: 'u.fase9.alumno1@utp.edu.pe', contrasena: 'una-clave-nueva-muy-segura' });
      expect(relogin.status).toBe(200);
    });
  }
);
