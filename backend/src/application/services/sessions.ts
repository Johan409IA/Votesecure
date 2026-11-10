import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'votecure_sesion';
export const CSRF_COOKIE_NAME = 'votecure_csrf';

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function generateSessionToken(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function generateVerificationToken(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function generateCsrfToken(): string {
  return randomBytes(16).toString('base64url');
}
