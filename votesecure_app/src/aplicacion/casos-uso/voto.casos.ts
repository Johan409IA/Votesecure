import { ErrorProhibido } from '../../compartido/errores';
import { logger } from '../../config/logger';
import * as votosRepo from '../../datos/repositorios/votos.repo';
import * as eleccionesRepo from '../../datos/repositorios/elecciones.repo';
import type { PublicadorResultados, CargaResultado } from '../servicios/realtime';
import type { UsuarioSesion } from '../politicas';

export interface ConfirmacionVoto {
  confirmado: boolean;
}

export async function emitirVoto(
  usuario: UsuarioSesion,
  publicador: PublicadorResultados,
  eleccionId: number,
  candidaturaId: number
): Promise<ConfirmacionVoto> {
  if (usuario.tipo !== 'estudiante') {
    throw new ErrorProhibido('Solo los estudiantes habilitados pueden votar');
  }
  await votosRepo.votar(eleccionId, usuario.id, candidaturaId);

  try {
    const carga = await armarCarga(eleccionId);
    if (carga) {
      await publicador.publicar(eleccionId, carga);
    }
  } catch (error) {
    logger.warn(
      { eleccionId, error: String(error) },
      'No se pudo publicar el resultado en vivo tras el voto'
    );
  }

  return { confirmado: true };
}

export async function armarCarga(
  eleccionId: number
): Promise<CargaResultado | null> {
  const eleccion = await eleccionesRepo.obtenerEleccion(eleccionId);
  if (!eleccion) return null;
  const [conteo, participacion, candidaturas] = await Promise.all([
    votosRepo.contarVotosPorCandidatura(eleccionId),
    votosRepo.participacionEleccion(eleccionId),
    eleccionesRepo.listarCandidaturas(eleccionId)
  ]);
  const nombres = new Map(
    candidaturas.map((c) => [c.id, c.nombreEstudiante] as const)
  );
  const votosPorId = new Map(
    conteo.map((c) => [c.candidaturaId, c.votos] as const)
  );
  return {
    eleccionId,
    estado: eleccion.estado,
    totalHabilitados: participacion.totalHabilitados,
    totalParticipantes: participacion.totalParticipantes,
    totalVotos: conteo.reduce((suma, c) => suma + c.votos, 0),
    candidaturas: candidaturas.map((c) => ({
      candidaturaId: c.id,
      nombre: nombres.get(c.id) ?? '',
      votos: votosPorId.get(c.id) ?? 0
    }))
  };
}
