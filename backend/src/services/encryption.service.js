const crypto = require('crypto');

const ALGORITHM  = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH  = 16;

// Derivar clave de 32 bytes desde la variable de entorno
const getKey = () => {
  const raw = process.env.ENCRYPTION_KEY || 'clave_default_insegura_cambiar!!';
  return Buffer.from(raw.padEnd(KEY_LENGTH, '0').slice(0, KEY_LENGTH));
};

/**
 * Encripta el candidato_id usando AES-256-CBC.
 * El resultado es un string "iv:encrypted" en hex.
 */
const encriptarVoto = (candidatoId) => {
  const iv  = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(candidatoId), 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Desencripta un voto (solo para auditoría interna con permisos especiales).
 */
const desencriptarVoto = (votoEncriptado) => {
  const [ivHex, encHex] = votoEncriptado.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const key       = getKey();
  const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Genera SHA-256 del voto para verificar integridad (no revela el candidato).
 * Input: candidatoId + eleccionId + timestamp + salt aleatorio
 */
const generarHashVoto = (candidatoId, eleccionId, timestamp, salt) => {
  const data = `${candidatoId}:${eleccionId}:${timestamp}:${salt}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Hash público para el comprobante del votante.
 * No contiene info del candidato, solo prueba de participación.
 */
const generarHashComprobante = (usuarioId, eleccionId, timestamp) => {
  const data = `${usuarioId}:${eleccionId}:${timestamp}:${process.env.JWT_SECRET}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Verifica que un hash de voto sea consistente (integridad blockchain-like).
 */
const verificarIntegridadVoto = (candidatoId, eleccionId, timestamp, salt, hashEsperado) => {
  const hashCalculado = generarHashVoto(candidatoId, eleccionId, timestamp, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hashCalculado, 'hex'),
    Buffer.from(hashEsperado,  'hex')
  );
};

module.exports = {
  encriptarVoto,
  desencriptarVoto,
  generarHashVoto,
  generarHashComprobante,
  verificarIntegridadVoto,
};
