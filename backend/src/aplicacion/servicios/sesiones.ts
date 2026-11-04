import { createHash, randomBytes } from 'node:crypto';

export const NOMBRE_COOKIE_SESION = 'votecure_sesion';
export const NOMBRE_COOKIE_CSRF = 'votecure_csrf';

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function generarTokenSesion(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function generarTokenVerificacion(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function generarTokenCsrf(): string {
  return randomBytes(16).toString('base64url');
}
