import rateLimit from 'express-rate-limit';

export const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiadas peticiones, intenta mas tarde' }
});

export const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiados intentos de inicio de sesion' }
});

export const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'LIMITE', mensaje: 'Demasiados registros desde esta direccion' }
});
