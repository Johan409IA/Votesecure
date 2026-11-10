import { withTransaction } from '../db';
import type { UserType } from '../../application/services/roles';

export interface User {
  id: number;
  name: string;
  email: string;
  userType: UserType;
  passwordHash: string;
  active: boolean;
  emailVerifiedAt: Date | null;
  sessionExpiresAt: Date | null;
  sessionRevokedAt: Date | null;
}

interface UserRow {
  id: string;
  nombre: string;
  correo: string;
  tipo_usuario: string;
  hash_contrasena: string;
  activo: boolean;
  correo_verificado_en: Date | null;
  sesion_expira_en: Date | null;
  sesion_revocada_en: Date | null;
}

function mapUser(row: UserRow): User {
  return {
    id: Number(row.id),
    name: row.nombre,
    email: row.correo,
    userType: row.tipo_usuario as UserType,
    passwordHash: row.hash_contrasena,
    active: row.activo,
    emailVerifiedAt: row.correo_verificado_en,
    sessionExpiresAt: row.sesion_expira_en,
    sessionRevokedAt: row.sesion_revocada_en
  };
}

const COLUMNS = `id, nombre, correo, tipo_usuario, hash_contrasena, activo,
  correo_verificado_en, sesion_expira_en, sesion_revocada_en`;

export async function getByEmail(email: string): Promise<User | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRow>(
      `SELECT ${COLUMNS} FROM usuarios WHERE correo = $1`,
      [email]
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  });
}

export async function getById(id: number): Promise<User | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRow>(
      `SELECT ${COLUMNS} FROM usuarios WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  });
}

export async function getBySession(
  sessionHash: Buffer
): Promise<User | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRow>(
      `SELECT ${COLUMNS} FROM usuarios
       WHERE sesion_hash = $1::bytea
         AND sesion_revocada_en IS NULL
         AND sesion_expira_en > now()
         AND activo`,
      [sessionHash]
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  });
}

export interface NewUserData {
  name: string;
  email: string;
  type: 'estudiante' | 'docente';
  passwordHash: string;
  verificationHash: Buffer;
  verificationExpiresAt: Date;
}

export async function createUser(data: NewUserData): Promise<number> {
  return withTransaction(async (client) => {
    const result = await client.query<{ crear_usuario: string }>(
      `SELECT crear_usuario($1, $2, $3, $4, $5, $6) AS crear_usuario`,
      [
        data.name,
        data.email,
        data.type,
        data.passwordHash,
        data.verificationHash,
        data.verificationExpiresAt
      ]
    );
    return Number(result.rows[0]?.crear_usuario);
  });
}

export async function updateSession(
  userId: number,
  sessionHash: Buffer,
  expiresAt: Date
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE usuarios
         SET sesion_hash = $1::bytea, sesion_expira_en = $2, sesion_revocada_en = NULL
       WHERE id = $3`,
      [sessionHash, expiresAt, userId]
    );
  });
}

export async function endSession(userId: number): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE usuarios
         SET sesion_hash = NULL, sesion_expira_en = NULL, sesion_revocada_en = NULL
       WHERE id = $1`,
      [userId]
    );
  });
}

export async function confirmEmail(
  email: string,
  tokenHash: Buffer
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<{ confirmar_correo: boolean }>(
      `SELECT confirmar_correo($1, $2) AS confirmar_correo`,
      [email, tokenHash]
    );
    return result.rows[0]?.confirmar_correo === true;
  });
}
