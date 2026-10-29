import { conTransaccion } from '../db';
import type { TipoUsuario } from '../../aplicacion/servicios/roles';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  tipoUsuario: TipoUsuario;
  hashContrasena: string;
  activo: boolean;
  correoVerificadoEn: Date | null;
  sesionExpiraEn: Date | null;
  sesionRevocadaEn: Date | null;
}

interface FilaUsuario {
  id: string;
  nombre: string;
  correo: string;
  tipo_usuario: string;
  hash_contrasena: string;
  activo: boolean;
  correo_verificado_en: Date | null;
  sesion_expira_en: Date | null;
  sesion_revocada_en: Date | null;
}

function mapear(f: FilaUsuario): Usuario {
  return {
    id: Number(f.id),
    nombre: f.nombre,
    correo: f.correo,
    tipoUsuario: f.tipo_usuario as TipoUsuario,
    hashContrasena: f.hash_contrasena,
    activo: f.activo,
    correoVerificadoEn: f.correo_verificado_en,
    sesionExpiraEn: f.sesion_expira_en,
    sesionRevocadaEn: f.sesion_revocada_en
  };
}

const COLUMNAS = `id, nombre, correo, tipo_usuario, hash_contrasena, activo,
  correo_verificado_en, sesion_expira_en, sesion_revocada_en`;

export async function obtenerPorCorreo(correo: string): Promise<Usuario | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaUsuario>(
      `SELECT ${COLUMNAS} FROM usuarios WHERE correo = $1`,
      [correo]
    );
    const fila = r.rows[0];
    return fila ? mapear(fila) : null;
  });
}

export async function obtenerPorId(id: number): Promise<Usuario | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaUsuario>(
      `SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`,
      [id]
    );
    const fila = r.rows[0];
    return fila ? mapear(fila) : null;
  });
}

export async function obtenerPorSesion(
  hashSesion: Buffer
): Promise<Usuario | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaUsuario>(
      `SELECT ${COLUMNAS} FROM usuarios
       WHERE sesion_hash = $1::bytea
         AND sesion_revocada_en IS NULL
         AND sesion_expira_en > now()
         AND activo`,
      [hashSesion]
    );
    const fila = r.rows[0];
    return fila ? mapear(fila) : null;
  });
}

export interface DatosNuevoUsuario {
  nombre: string;
  correo: string;
  tipo: 'estudiante' | 'docente';
  hashContrasena: string;
  verificacionHash: Buffer;
  verificacionExpiraEn: Date;
}

export async function crear(datos: DatosNuevoUsuario): Promise<number> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ crear_usuario: string }>(
      `SELECT crear_usuario($1, $2, $3, $4, $5, $6) AS crear_usuario`,
      [
        datos.nombre,
        datos.correo,
        datos.tipo,
        datos.hashContrasena,
        datos.verificacionHash,
        datos.verificacionExpiraEn
      ]
    );
    return Number(r.rows[0]?.crear_usuario);
  });
}

export async function actualizarSesion(
  usuarioId: number,
  hashSesion: Buffer,
  expiraEn: Date
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query(
      `UPDATE usuarios
         SET sesion_hash = $1::bytea, sesion_expira_en = $2, sesion_revocada_en = NULL
       WHERE id = $3`,
      [hashSesion, expiraEn, usuarioId]
    );
  });
}

export async function cerrarSesion(usuarioId: number): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query(
      `UPDATE usuarios
         SET sesion_hash = NULL, sesion_expira_en = NULL, sesion_revocada_en = NULL
       WHERE id = $1`,
      [usuarioId]
    );
  });
}

export async function confirmarCorreo(
  correo: string,
  hashToken: Buffer
): Promise<boolean> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ confirmar_correo: boolean }>(
      `SELECT confirmar_correo($1, $2) AS confirmar_correo`,
      [correo, hashToken]
    );
    return r.rows[0]?.confirmar_correo === true;
  });
}
