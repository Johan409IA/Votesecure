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
