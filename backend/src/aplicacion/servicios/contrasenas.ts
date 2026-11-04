import { hash, verify } from '@node-rs/argon2';

export const LIMITES_CONTRASENA = { min: 15, max: 128 } as const;

const OPCIONES_ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

export function hashearContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, OPCIONES_ARGON2);
}

export function verificarContrasena(
  hashAlmacenado: string,
  contrasena: string
): Promise<boolean> {
  return verify(hashAlmacenado, contrasena);
}
