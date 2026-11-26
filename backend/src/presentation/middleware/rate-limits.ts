import rateLimit from 'express-rate-limit';

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiadas peticiones, intenta mas tarde' }
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiados intentos de inicio de sesion' }
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiados registros desde esta direccion' }
});

// F-003: el codigo de seccion es un secreto corto; sin limite propio, el
// limite general dejaba la fuerza bruta practicamente abierta.
export const joinRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiados intentos de inscripcion, intenta mas tarde' }
});

// Reenvio de verificacion: sin limite propio se podria usar para spamear el
// buzon de terceros rotando direcciones. El cooldown fino (60 s por cuenta)
// vive en regenerar_verificacion (sql/009).
export const resendVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiadas peticiones de reenvio, intenta mas tarde' }
});
