import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { Client, type PoolClient } from 'pg';
import request from 'supertest';
import type { Express } from 'express';
import { loadServerEnv, type ServerEnv } from '../../src/config/env';
import { createApp } from '../../src/app';
import { createContext, type ApiContext } from '../../src/presentation/context';
import * as db from '../../src/data/db';
import { hashPassword } from '../../src/application/services/passwords';
import type { MailAdapter } from '../../src/application/services/mail';
import type {
  ResultsPublisher,
  ResultLoad
} from '../../src/application/services/realtime';
import { createSavepointPool } from '../../tests/helpers/transactional-pool';

// Smoke de humo: recorre el flujo completo de §10 contra la BD de prueba
// (TEST_DATABASE_URL, con respaldo en DATABASE_API_URL) y revierte todo con
// ROLLBACK al final, incluidos los votos, que son inmutables: nada queda
// persistido. El orden sigue el plan de verificacion: registro ->
// verificacion (bypass dev) -> login -> crear seccion (codigo auto) ->
// unirse por codigo -> candidaturas -> programar -> activar -> votar ->
// resultados en vivo -> cerrar -> proclamar -> evaluar -> auditoria.

const PASSWORD = 'clave-smoke-fase-nueve';
const STAMP = Date.now();
const EMAILS = {
  teacher: `c.smoke${STAMP}@utp.edu.pe`,
  studentA: `u.smoke${STAMP}a@utp.edu.pe`,
  studentB: `u.smoke${STAMP}b@utp.edu.pe`,
  admin: `admin.smoke${STAMP}@utp.edu.pe`
};

interface Session {
  cookie: string;
  csrf: string;
}

interface SectionRef {
  id: number;
  code: string;
}

class CapturingMailAdapter implements MailAdapter {
  readonly links = new Map<string, string>();

  async sendVerification(recipient: string, link: string): Promise<void> {
    this.links.set(recipient, link);
    console.log(`  [bypass dev] enlace de verificacion capturado para ${recipient}`);
  }
}

class Smoke {
  private step = 0;
  private readonly total = 18;
  private adminToken = '';
  private delegation = 0;

  constructor(
    private readonly env: ServerEnv,
    private readonly app: Express,
    private readonly client: PoolClient,
    private readonly mail: CapturingMailAdapter
  ) {}

  private report(name: string, detail = ''): void {
    this.step += 1;
    console.log(`[${this.step}/${this.total}] OK - ${name}${detail ? ` (${detail})` : ''}`);
  }

  private check(condition: boolean, name: string, detail: string): void {
    if (!condition) {
      throw new Error(`${name}: ${detail}`);
    }
  }

  private raw(sql: string, values: unknown[] = []) {
    return this.client.query(sql, values);
  }

  private async asProvisioning(sql: string, values: unknown[] = []) {
    await this.client.query('SAVEPOINT sp_admin');
    await this.client.query('SET ROLE votesecure_provisionamiento');
    try {
      const result = await this.client.query(sql, values);
      await this.client.query('RESET ROLE');
      await this.client.query('RELEASE SAVEPOINT sp_admin');
      return result;
    } catch (error) {
      await this.client.query('ROLLBACK TO SAVEPOINT sp_admin');
      await this.client.query('RESET ROLE');
      throw error;
    }
  }

  private send(
    method: 'get' | 'post',
    path: string,
    session?: Session,
    body?: string | object
  ) {
    let req = request(this.app)[method](path);
    if (session) {
      req = req.set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf);
    }
    return body === undefined ? req : req.send(body);
  }

  async run(): Promise<void> {
    await this.provisionAdmin();
    await this.registerAccounts();
    await this.verifyEmails();
    const sessions = await this.loginAll();
    const section = await this.createSection(sessions.teacher);
    const enrollments = await this.joinByCode(section, sessions.studentA, sessions.studentB);
    const election = await this.createElection(sessions.teacher, section);
    const candidacies = await this.addCandidacies(
      sessions.teacher,
      election,
      enrollments
    );
    await this.scheduleElection(sessions.teacher, election);
    await this.activateElection(sessions.teacher, election);
    await this.castVote(sessions.studentA, election, candidacies);
    await this.liveResults(sessions.studentA, election);
    await this.closeElection(sessions.teacher, election);
    await this.proclaimDelegate(sessions.teacher, election);
    await this.openEvaluationPeriod(sessions.teacher);
    await this.evaluate(sessions.studentA, sessions.teacher, section);
    await this.audit(sessions.admin, election);
    this.report('flujo completo §10 verificado');
  }

  private async provisionAdmin(): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest();
    const passwordHash = await hashPassword(PASSWORD);
    await this.asProvisioning(
      `INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena,
         verificacion_hash, verificacion_expira_en)
       VALUES ($1,$2,'administrador',$3,$4::bytea, now() + interval '1 day')`,
      ['Admin Smoke', EMAILS.admin, passwordHash, tokenHash]
    );
    this.adminToken = token;
    this.report(
      'administrador aprovisionado (rol votesecure_provisionamiento)',
      EMAILS.admin
    );
  }

  private async registerAccounts(): Promise<void> {
    const accounts: Array<[string, string]> = [
      ['Docente Smoke', EMAILS.teacher],
      ['Alumna Smoke A', EMAILS.studentA],
      ['Alumno Smoke B', EMAILS.studentB]
    ];
    for (const [nombre, correo] of accounts) {
      const response = await this.send('post', '/api/auth/registro', undefined, {
        nombre,
        correo,
        contrasena: PASSWORD
      });
      this.check(response.status === 201, 'registro', `${correo} -> ${response.status}`);
    }
    this.report('registro de docente y estudiantes con correo UTP');
  }

  private async verifyEmails(): Promise<void> {
    for (const correo of [EMAILS.teacher, EMAILS.studentA, EMAILS.studentB]) {
      const link = this.mail.links.get(correo);
      this.check(link !== undefined, 'verificacion', `sin enlace para ${correo}`);
      const search = new URL(link as string).searchParams.toString();
      const response = await this.send('get', `/api/auth/verificar?${search}`);
      this.check(
        response.status === 302 &&
          String(response.headers.location).includes('estado=ok'),
        'verificacion',
        `${correo} -> ${response.status}`
      );
    }
    const adminSearch = new URL(
      `${this.env.FRONTEND_URL}/verificar-correo?correo=${encodeURIComponent(EMAILS.admin)}&token=${encodeURIComponent(this.adminToken)}`
    ).searchParams.toString();
    const response = await this.send('get', `/api/auth/verificar?${adminSearch}`);
    this.check(response.status === 302, 'verificacion del admin', String(response.status));
    this.report('verificacion de correo completada (bypass dev)');
  }

  private async loginAll(): Promise<{
    teacher: Session;
    studentA: Session;
    studentB: Session;
    admin: Session;
  }> {
    const login = async (correo: string): Promise<Session> => {
      const response = await this.send('post', '/api/auth/login', undefined, {
        correo,
        contrasena: PASSWORD
      });
      this.check(response.status === 200, 'login', `${correo} -> ${response.status}`);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      const value = (name: string): string => {
        const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
        return found ? (found.split(';')[0] ?? '') : '';
      };
      return {
        cookie: [value('votecure_sesion'), value('votecure_csrf')].join('; '),
        csrf: value('votecure_csrf').split('=')[1] ?? ''
      };
    };
    const sessions = {
      teacher: await login(EMAILS.teacher),
      studentA: await login(EMAILS.studentA),
      studentB: await login(EMAILS.studentB),
      admin: await login(EMAILS.admin)
    };
    this.report('login con cookies de sesion y CSRF');
    return sessions;
  }

  private async createSection(teacher: Session): Promise<SectionRef> {
    const response = await this.send('post', '/api/secciones', teacher, {
      codigoCurso: `IF9${STAMP % 1000}`,
      nombreCurso: 'Curso Smoke',
      periodoAcademico: '2026-2'
    });
    this.check(response.status === 201, 'crear seccion', String(response.status));
    const code = response.body.seccion.code as string;
    this.check(/^SEC-[A-HJ-KM-NP-Z2-9]{4}$/.test(code), 'codigo SEC-XXXX', code);
    const assigned = await this.raw(
      `SELECT 1 FROM asignaciones_docentes
        WHERE seccion_id = $1 AND activa
          AND docente_id = (SELECT id FROM usuarios WHERE correo = $2)`,
      [response.body.seccion.id, EMAILS.teacher]
    );
    this.check(
      (assigned.rowCount ?? 0) === 1,
      'auto-asignacion del docente',
      'sin asignacion'
    );
    this.report('seccion creada por el docente con codigo auto-generado', code);
    return { id: response.body.seccion.id as number, code };
  }

  private async joinByCode(
    section: SectionRef,
    studentA: Session,
    studentB: Session
  ): Promise<{ a: number; b: number }> {
    for (const session of [studentA, studentB]) {
      const response = await this.send('post', '/api/secciones/unirse', session, {
        codigo: section.code
      });
      this.check(response.status === 200, 'unirse por codigo', String(response.status));
    }
    const rows = await this.raw(
      `SELECT m.id, u.correo FROM matriculas m
        JOIN usuarios u ON u.id = m.estudiante_id
       WHERE m.seccion_id = $1 AND u.correo IN ($2, $3)`,
      [section.id, EMAILS.studentA, EMAILS.studentB]
    );
    this.check(rows.rowCount === 2, 'matriculas por codigo', `hay ${rows.rowCount}`);
    const byEmail = new Map<string, number>(
      rows.rows.map((row: { correo: string; id: string }) => [
        row.correo,
        Number(row.id)
      ])
    );
    this.report('estudiantes enrolados por codigo de acceso');
    return {
      a: byEmail.get(EMAILS.studentA) ?? 0,
      b: byEmail.get(EMAILS.studentB) ?? 0
    };
  }

  private async createElection(teacher: Session, section: SectionRef): Promise<number> {
    const response = await this.send('post', '/api/elecciones', teacher, {
      seccionId: section.id,
      nombre: 'Delegado Smoke',
      iniciaEn: new Date(Date.now() - 60_000).toISOString(),
      cierraEn: new Date(Date.now() + 30 * 60_000).toISOString()
    });
    this.check(response.status === 201, 'crear eleccion', String(response.status));
    this.check(
      response.body.eleccion.status === 'borrador',
      'estado inicial',
      'no borrador'
    );
    this.report('eleccion principal creada en borrador');
    return response.body.eleccion.id as number;
  }

  private async addCandidacies(
    teacher: Session,
    election: number,
    enrollments: { a: number; b: number }
  ): Promise<number[]> {
    const ids: number[] = [];
    for (const matriculaId of [enrollments.a, enrollments.b]) {
      const response = await this.send(
        'post',
        `/api/elecciones/${election}/candidaturas`,
        teacher,
        { matriculaId }
      );
      this.check(response.status === 201, 'candidatura', String(response.status));
      ids.push(response.body.candidatura.id as number);
    }
    this.report('candidaturas registradas por el docente (minimo 2)');
    return ids;
  }

  private async scheduleElection(teacher: Session, election: number): Promise<void> {
    const response = await this.send(
      'post',
      `/api/elecciones/${election}/programar`,
      teacher
    );
    this.check(response.status === 200, 'programar', String(response.status));
    this.report('eleccion programada');
  }

  private async activateElection(teacher: Session, election: number): Promise<void> {
    const response = await this.send(
      'post',
      `/api/elecciones/${election}/activar`,
      teacher
    );
    this.check(response.status === 200, 'activar', String(response.status));
    const electorate = await this.raw(
      `SELECT count(*) AS total FROM habilitaciones_voto WHERE eleccion_id = $1`,
      [election]
    );
    this.check(
      Number(electorate.rows[0].total) === 2,
      'padron congelado (§3.2)',
      `hay ${electorate.rows[0].total} habilitaciones`
    );
    this.report('eleccion activa: padron congelado con matriculas activas');
  }

  private async castVote(
    studentA: Session,
    election: number,
    candidacies: number[]
  ): Promise<void> {
    const response = await this.send(
      'post',
      `/api/elecciones/${election}/votar`,
      studentA,
      { candidaturaId: candidacies[1] }
    );
    this.check(response.status === 201, 'votar', String(response.status));
    this.check(response.body.confirmed === true, 'confirmacion de voto', 'sin confirmar');
    this.report('voto emitido de forma anonima e irrevocable');
  }

  private async liveResults(studentA: Session, election: number): Promise<void> {
    const results = await this.send(
      'get',
      `/api/elecciones/${election}/resultados`,
      studentA
    );
    this.check(results.status === 200, 'resultados en vivo', String(results.status));
    this.check(results.body.tipo === 'en_vivo', 'tipo de resultado', results.body.tipo);
    this.check(
      results.body.totalVotos === 1,
      'conteo en vivo',
      `${results.body.totalVotos}`
    );
    const subscription = await this.send(
      'post',
      `/api/resultados/${election}/suscripcion`,
      studentA
    );
    this.check(subscription.status === 200, 'suscripcion', String(subscription.status));
    const { canal, expiraEn } = subscription.body as { canal: string; expiraEn: number };
    this.check(
      new RegExp(`^resultados:${election}:[0-9a-f]{64}$`).test(canal),
      'canal con ticket HMAC',
      canal
    );
    const vigencia = expiraEn - Math.floor(Date.now() / 1000);
    this.check(vigencia > 0 && vigencia <= 60, 'vigencia de 60 s', `${vigencia} s`);
    this.report('resultados en vivo y ticket efimero de suscripcion', canal);
  }

  private async closeElection(teacher: Session, election: number): Promise<void> {
    const response = await this.send(
      'post',
      `/api/elecciones/${election}/cerrar`,
      teacher
    );
    this.check(response.status === 200, 'cierre anticipado', String(response.status));
    const results = await this.send(
      'get',
      `/api/elecciones/${election}/resultados`,
      teacher
    );
    this.check(results.body.tipo === 'final', 'resultados definitivos', results.body.tipo);
    this.check(results.body.situation === 'ganador', 'situacion', results.body.situation);
    this.report('cierre manual anticipado con ganador unico publicado');
  }

  private async proclaimDelegate(teacher: Session, election: number): Promise<void> {
    const response = await this.send(
      'post',
      `/api/elecciones/${election}/proclamar`,
      teacher,
      // Fecha en el pasado: now() de PostgreSQL queda congelado en el inicio
      // de la transaccion del smoke.
      { iniciaEn: new Date(Date.now() - 120 * 60_000).toISOString() }
    );
    this.check(response.status === 201, 'proclamar', String(response.status));
    this.check(
      response.body.delegacionId > 0,
      'delegacion registrada',
      String(response.body.delegacionId)
    );
    this.delegation = response.body.delegacionId as number;
    this.report('delegado proclamado');
  }

  private async openEvaluationPeriod(teacher: Session): Promise<void> {
    const response = await this.send('post', '/api/evaluaciones/periodos', teacher, {
      delegacionId: this.delegation,
      abreEn: new Date(Date.now() - 90 * 60_000).toISOString(),
      cierraEn: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      instrucciones: 'Evalua el desempeno del delegado durante el ciclo.'
    });
    this.check(response.status === 201, 'periodo de evaluacion', String(response.status));
    this.report('periodo de evaluacion abierto con instrucciones');
  }

  private async evaluate(
    studentA: Session,
    teacher: Session,
    section: SectionRef
  ): Promise<void> {
    const byStudent = await this.send('post', '/api/evaluaciones', studentA, {
      seccionId: section.id,
      calificacion: 8,
      comentario: 'Buen trabajo del delegado'
    });
    this.check(
      byStudent.status === 201,
      'evaluacion estudiantil',
      String(byStudent.status)
    );
    const repeated = await this.send('post', '/api/evaluaciones', studentA, {
      seccionId: section.id,
      calificacion: 5
    });
    this.check(
      repeated.status === 409,
      'envio unico de evaluacion (§7.1)',
      String(repeated.status)
    );
    const byTeacher = await this.send('post', '/api/evaluaciones', teacher, {
      seccionId: section.id,
      calificacion: 9,
      comentario: 'Buen liderazgo y organizacion del grupo de trabajo.'
    });
    this.check(byTeacher.status === 201, 'evaluacion docente', String(byTeacher.status));
    this.report('delegado evaluado por estudiante y docente (envio unico)');
  }

  private async audit(admin: Session, election: number): Promise<void> {
    const response = await this.send(
      'get',
      `/api/auditoria/elecciones/${election}`,
      admin
    );
    this.check(response.status === 200, 'auditoria', String(response.status));
    const types = response.body.eventos.map(
      (event: { eventType: string }) => event.eventType
    );
    for (const expected of ['creacion', 'activacion', 'cierre_publicacion']) {
      this.check(
        types.includes(expected),
        `auditoria ${expected}`,
        types.join(',')
      );
    }
    this.report('historial inmutable de auditoria consultado por el admin');
  }
}

function buildTolerantPublisher(real: ResultsPublisher): ResultsPublisher {
  let offline = false;
  return {
    subscription: (electionId: number, now?: number) =>
      real.subscription(electionId, now),
    ticket: (electionId: number, now?: number) => real.ticket(electionId, now),
    ticketFor: (electionId: number, expUnix: number) =>
      real.ticketFor(electionId, expUnix),
    channelName: (electionId: number, now?: number) =>
      real.channelName(electionId, now),
    publish: async (electionId: number, load: ResultLoad) => {
      if (offline) return;
      try {
        await real.publish(electionId, load);
        console.log('  broadcast publicado en Supabase Realtime');
      } catch (error) {
        offline = true;
        console.warn(
          '  broadcast omitido (Supabase Realtime no disponible):',
          error instanceof Error ? error.message : error
        );
      }
    },
    close: (electionId: number) => real.close(electionId),
    stop: () => real.stop()
  } as unknown as ResultsPublisher;
}

async function main(): Promise<void> {
  // El smoke siempre corre como test: un NODE_ENV heredado del shell no debe
  // activar el adaptador de correo real ni los asserts de produccion.
  process.env.NODE_ENV = 'test';
  const env = loadServerEnv();
  const connectionString = process.env.TEST_DATABASE_URL ?? env.DATABASE_API_URL;

  const client = new Client({ connectionString });
  await client.connect();
  await client.query('BEGIN');

  // La capa de datos de la aplicacion debe desviarse a esta transaccion: se
  // reemplaza pg.Pool (paquete CJS con exports mutables) por el pool de
  // SAVEPOINTs; los modulos TS transpilados no admiten reasignacion.
  const savepointPool = createSavepointPool(() => client as unknown as PoolClient);
  const pgRaw = createRequire(__filename)('pg') as { Pool: unknown };
  pgRaw.Pool = function () {
    return savepointPool;
  } as unknown as typeof pgRaw.Pool;
  if (db.getPool() !== savepointPool) {
    throw new Error('El pool transaccional no llego a la capa de datos');
  }

  const mail = new CapturingMailAdapter();
  const base = createContext(env);
  const publisher = buildTolerantPublisher(base.publisher);
  const ctx: ApiContext = { env, mail, publisher };
  const app = createApp(env, ctx);

  const smoke = new Smoke(env, app, client as unknown as PoolClient, mail);
  try {
    await smoke.run();
    await client.query('ROLLBACK');
    const trace = await client.query(
      `SELECT count(*) AS total FROM usuarios
        WHERE correo LIKE '%smoke%@utp.edu.pe'`
    );
    if (Number(trace.rows[0].total) !== 0) {
      throw new Error('El rollback no revirtio todos los datos del smoke');
    }
    console.log('SMOKE OK: flujo completo §10 verificado y revertido (ROLLBACK).');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Fallo el smoke:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
    await publisher.stop();
    await db.closePool();
  }
}

void main().catch((error) => {
  console.error('Fallo el smoke:', error instanceof Error ? error.message : error);
  process.exit(1);
});
