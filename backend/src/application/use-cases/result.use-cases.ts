import { ForbiddenError, NotFoundError } from '../../shared/errors';
import * as electionsRepo from '../../data/repositories/election.repo';
import * as resultsRepo from '../../data/repositories/result.repo';
import type { ResultsPublisher } from '../services/realtime';
import { isAdmin, type SessionUser } from '../policies';
import { buildResultLoad } from './vote.use-cases';

export async function isSectionMember(
  userId: number,
  sectionId: number
): Promise<boolean> {
  return resultsRepo.isSectionMember(userId, sectionId);
}

// §5.1: en vivo acceden el estudiante habilitado, el docente asignado a la
// seccion (proyector de aula) y el administrador. Los no miembros, no.
async function canViewLiveResults(
  user: SessionUser,
  election: { id: number; sectionId: number }
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.type === 'docente') {
    return resultsRepo.isTeacherOfSection(user.id, election.sectionId);
  }
  if (user.type === 'estudiante') {
    return resultsRepo.isEligible(election.id, user.id);
  }
  return false;
}

export async function getResults(
  user: SessionUser,
  electionId: number
) {
  const election = await electionsRepo.getElection(electionId);
  if (!election) throw new NotFoundError('Eleccion no encontrada');

  if (election.status === 'activa') {
    const allowed = await canViewLiveResults(user, election);
    if (!allowed) {
      throw new ForbiddenError('No tienes acceso a los resultados en vivo de esta eleccion');
    }
    const load = await buildResultLoad(electionId);
    if (!load) throw new NotFoundError('Eleccion no encontrada');
    if (user.type === 'estudiante') {
      return {
        tipo: 'en_vivo' as const,
        ...load,
        yaVoto: await resultsRepo.hasVoted(electionId, user.id)
      };
    }
    return { tipo: 'en_vivo' as const, ...load };
  }

  if (election.status === 'cerrada') {
    const allowed =
      isAdmin(user) ||
      (await resultsRepo.isSectionMember(user.id, election.sectionId));
    if (!allowed) {
      throw new ForbiddenError('No perteneces a la seccion de esta eleccion');
    }
    const final = await resultsRepo.getFinalResult(electionId);
    if (!final) throw new NotFoundError('Resultados no disponibles');
    return { tipo: 'final' as const, ...final };
  }

  throw new ForbiddenError('Los resultados no estan disponibles en este estado');
}

export async function subscriptionTicket(
  user: SessionUser,
  publisher: ResultsPublisher,
  electionId: number
): Promise<{ canal: string; expiraEn: number }> {
  const election = await electionsRepo.getElection(electionId);
  if (!election) throw new NotFoundError('Eleccion no encontrada');
  if (election.status !== 'activa') {
    throw new ForbiddenError('La eleccion no esta activa');
  }
  const allowed = await canViewLiveResults(user, election);
  if (!allowed) {
    throw new ForbiddenError('No tienes acceso a los resultados en vivo de esta eleccion');
  }
  return publisher.subscription(electionId);
}
