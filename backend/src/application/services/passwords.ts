import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

export const PASSWORD_LIMITS = { min: 15, max: 128 } as const;

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(
  storedHash: string,
  password: string
): Promise<boolean> {
  return verify(storedHash, password);
}

let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHash ??= hash(randomBytes(16).toString('hex'), ARGON2_OPTIONS);
  return dummyHash;
}

// F-014: verificar contra un hash senuelo con los mismos parametros de Argon2
// cuando la cuenta no existe, para que ambos caminos cuesten lo mismo y el
// login no revele la existencia de la cuenta por diferencia de tiempos.
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  await verify(await getDummyHash(), password).catch(() => false);
}
