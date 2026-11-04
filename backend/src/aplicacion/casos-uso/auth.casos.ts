import { ErrorNoAutenticado, ErrorNegocio } from '../../compartido/errores';
import * as usuariosRepo from '../../datos/repositorios/usuarios.repo';
import {
  LIMITES_CONTRASENA,
  hashearContrasena,
  verificarContrasena
} from '../servicios/contrasenas';
import {
  derivarTipoPorCorreo,
  normalizarCorreo,
  type TipoUsuario
} from '../servicios/roles';
import {
  generarTokenCsrf,
  generarTokenSesion,
  generarTokenVerificacion,
  hashToken
} from '../servicios/sesiones';
import type { AdaptadorCorreo } from '../servicios/correo';

const EXPIRACION_VERIFICACION_MS = 24 * 60 * 60 * 1000;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const MENSAJE_GENERICO = 'Credenciales invalidas';

interface RegistroIntentos {
  fallos: number;
  bloqueadoHasta?: number;
}

const intentosLogin = new Map<string, RegistroIntentos>();

export interface ResultadoSesion {
  usuario: {
    id: number;
    nombre: string;
    correo: string;
    tipo: TipoUsuario;
    correoVerificado: boolean;
  };
  tokenSesion: string;
  tokenCsrf: string;
}

export async function registrarUsuario(
  datos: { nombre: string; correo: string; contrasena: string },
  correo: AdaptadorCorreo,
  frontendUrl: string
): Promise<void> {
  const correoNormalizado = normalizarCorreo(datos.correo);
  const tipo = derivarTipoPorCorreo(correoNormalizado);
  if (!tipo) {
    throw new ErrorNegocio(
      'El correo debe ser institucional UTP: estudiante (u...@utp.edu.pe) o docente (c...@utp.edu.pe)'
    );
  }
  if (
    datos.contrasena.length < LIMITES_CONTRASENA.min ||
    datos.contrasena.length > LIMITES_CONTRASENA.max
  ) {
    throw new ErrorNegocio(
      `La contrasena debe tener entre ${LIMITES_CONTRASENA.min} y ${LIMITES_CONTRASENA.max} caracteres`
    );
  }

  const existente = await usuariosRepo.obtenerPorCorreo(correoNormalizado);
  if (existente) {
    // Sin error discernible: se evita la enumeracion de cuentas.
    return;
  }

  const hash = await hashearContrasena(datos.contrasena);
  const { token, hash: hashVerificacion } = generarTokenVerificacion();
  await usuariosRepo.crear({
    nombre: datos.nombre,
    correo: correoNormalizado,
    tipo,
    hashContrasena: hash,
    verificacionHash: hashVerificacion,
    verificacionExpiraEn: new Date(Date.now() + EXPIRACION_VERIFICACION_MS)
  });

  const enlace = `${frontendUrl}/verificar-correo?correo=${encodeURIComponent(correoNormalizado)}&token=${encodeURIComponent(token)}`;
  await correo.enviarVerificacion(correoNormalizado, enlace);
}

export async function verificarCorreo(
  correo: string,
  token: string
): Promise<void> {
  const confirmado = await usuariosRepo.confirmarCorreo(
    normalizarCorreo(correo),
    hashToken(token)
  );
  if (!confirmado) {
    throw new ErrorNegocio('El enlace de verificacion es invalido o expiro');
  }
}

export async function iniciarSesion(
  datos: { correo: string; contrasena: string },
  ttlHoras: number
): Promise<ResultadoSesion> {
  const correoNormalizado = normalizarCorreo(datos.correo);
  const registro = intentosLogin.get(correoNormalizado);
  if (registro?.bloqueadoHasta && registro.bloqueadoHasta > Date.now()) {
    throw new ErrorNoAutenticado(MENSAJE_GENERICO);
  }

  const usuario = await usuariosRepo.obtenerPorCorreo(correoNormalizado);
  if (!usuario || !usuario.activo) {
    registrarFallo(correoNormalizado);
    throw new ErrorNoAutenticado(MENSAJE_GENERICO);
  }

  const valida = await verificarContrasena(usuario.hashContrasena, datos.contrasena);
  if (!valida) {
    registrarFallo(correoNormalizado);
    throw new ErrorNoAutenticado(MENSAJE_GENERICO);
  }

  intentosLogin.delete(correoNormalizado);
  const { token, hash } = generarTokenSesion();
  await usuariosRepo.actualizarSesion(
    usuario.id,
    hash,
    new Date(Date.now() + ttlHoras * 60 * 60 * 1000)
  );

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipo: usuario.tipoUsuario,
      correoVerificado: usuario.correoVerificadoEn !== null
    },
    tokenSesion: token,
    tokenCsrf: generarTokenCsrf()
  };
}

export async function usuarioDeSesion(hashSesion: Buffer) {
  const usuario = await usuariosRepo.obtenerPorSesion(hashSesion);
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    tipo: usuario.tipoUsuario,
    correoVerificado: usuario.correoVerificadoEn !== null
  };
}

export async function cerrarSesion(usuarioId: number): Promise<void> {
  await usuariosRepo.cerrarSesion(usuarioId);
}

function registrarFallo(correo: string): void {
  const registro = intentosLogin.get(correo) ?? { fallos: 0 };
  registro.fallos += 1;
  if (registro.fallos >= MAX_INTENTOS) {
    registro.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    registro.fallos = 0;
  }
  intentosLogin.set(correo, registro);
}
