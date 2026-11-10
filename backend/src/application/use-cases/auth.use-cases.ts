import { UnauthenticatedError, BusinessError } from '../../shared/errors';
import * as usersRepo from '../../data/repositories/user.repo';
import {
  PASSWORD_LIMITS,
  hashPassword,
  verifyPassword
} from '../services/passwords';
import {
  deriveUserTypeFromEmail,
  normalizeEmail,
  type UserType
} from '../services/roles';
import {
  generateCsrfToken,
  generateSessionToken,
  generateVerificationToken,
  hashToken
} from '../services/sessions';
import type { MailAdapter } from '../services/mail';

const VERIFICATION_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_MESSAGE = 'Credenciales invalidas';

interface LoginAttempts {
  failures: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempts>();

export interface SessionResult {
  user: {
    id: number;
    name: string;
    email: string;
    type: UserType;
    emailVerified: boolean;
  };
  sessionToken: string;
  csrfToken: string;
}

export async function registerUser(
  data: { name: string; email: string; password: string },
  mail: MailAdapter,
  frontendUrl: string
): Promise<void> {
  const normalizedEmail = normalizeEmail(data.email);
  const type = deriveUserTypeFromEmail(normalizedEmail);
  if (!type) {
    throw new BusinessError(
      'El correo debe ser institucional UTP: estudiante (u...@utp.edu.pe) o docente (c...@utp.edu.pe)'
    );
  }
  if (
    data.password.length < PASSWORD_LIMITS.min ||
    data.password.length > PASSWORD_LIMITS.max
  ) {
    throw new BusinessError(
      `La contrasena debe tener entre ${PASSWORD_LIMITS.min} y ${PASSWORD_LIMITS.max} caracteres`
    );
  }

  const existing = await usersRepo.getByEmail(normalizedEmail);
  if (existing) {
    // Sin error discernible: se evita la enumeracion de cuentas.
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const { token, hash: verificationHash } = generateVerificationToken();
  await usersRepo.createUser({
    name: data.name,
    email: normalizedEmail,
    type,
    passwordHash,
    verificationHash,
    verificationExpiresAt: new Date(Date.now() + VERIFICATION_EXPIRATION_MS)
  });

  const link = `${frontendUrl}/verificar-correo?correo=${encodeURIComponent(normalizedEmail)}&token=${encodeURIComponent(token)}`;
  await mail.sendVerification(normalizedEmail, link);
}

export async function verifyEmail(
  email: string,
  token: string
): Promise<void> {
  const confirmed = await usersRepo.confirmEmail(
    normalizeEmail(email),
    hashToken(token)
  );
  if (!confirmed) {
    throw new BusinessError('El enlace de verificacion es invalido o expiro');
  }
}

export async function login(
  data: { email: string; password: string },
  ttlHours: number
): Promise<SessionResult> {
  const normalizedEmail = normalizeEmail(data.email);
  const attempt = loginAttempts.get(normalizedEmail);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw new UnauthenticatedError(GENERIC_MESSAGE);
  }

  const user = await usersRepo.getByEmail(normalizedEmail);
  if (!user || !user.active) {
    recordFailure(normalizedEmail);
    throw new UnauthenticatedError(GENERIC_MESSAGE);
  }

  const valid = await verifyPassword(user.passwordHash, data.password);
  if (!valid) {
    recordFailure(normalizedEmail);
    throw new UnauthenticatedError(GENERIC_MESSAGE);
  }

  loginAttempts.delete(normalizedEmail);
  const { token, hash } = generateSessionToken();
  await usersRepo.updateSession(
    user.id,
    hash,
    new Date(Date.now() + ttlHours * 60 * 60 * 1000)
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.userType,
      emailVerified: user.emailVerifiedAt !== null
    },
    sessionToken: token,
    csrfToken: generateCsrfToken()
  };
}

export async function userFromSession(sessionHash: Buffer) {
  const user = await usersRepo.getBySession(sessionHash);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    type: user.userType,
    emailVerified: user.emailVerifiedAt !== null
  };
}

export async function logout(userId: number): Promise<void> {
  await usersRepo.endSession(userId);
}

function recordFailure(email: string): void {
  const attempt = loginAttempts.get(email) ?? { failures: 0 };
  attempt.failures += 1;
  if (attempt.failures >= MAX_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + LOCKOUT_MS;
    attempt.failures = 0;
  }
  loginAttempts.set(email, attempt);
}
