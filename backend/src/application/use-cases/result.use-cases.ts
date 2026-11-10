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

export async function getResults(
  user: SessionUser,
  electionId: number
) {
  const election = await electionsRepo.getElection(electionId);
  if (!election) throw new NotFoundError('Eleccion no encontrada');

  if (election.status === 'activa') {
    if (user.type !== 'estudiante') {
      throw new ForbiddenError('Los resultados en vivo son solo para estudiantes habilitados');
    }
    const eligible = await resultsRepo.isEligible(electionId, user.id);
    if (!eligible) {
      throw new ForbiddenError('No estas habilitado en esta eleccion');
    }
    const load = await buildResultLoad(electionId);
    if (!load) throw new NotFoundError('Eleccion no encontrada');
    return {
      tipo: 'en_vivo' as const,
      ...load,
      yaVoto: await resultsRepo.hasVoted(electionId, user.id)
    };
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
): Promise<{ canal: string; eleccionId: number }> {
  const election = await electionsRepo.getElection(electionId);
  if (!election) throw new NotFoundError('Eleccion no encontrada');
  if (election.status !== 'activa') {
    throw new ForbiddenError('La eleccion no esta activa');
  }
  if (user.type !== 'estudiante') {
    throw new ForbiddenError('Solo los estudiantes habilitados pueden suscribirse');
  }
  const eligible = await resultsRepo.isEligible(electionId, user.id);
  if (!eligible) {
    throw new ForbiddenError('No estas habilitado en esta eleccion');
  }
  return { canal: publisher.channelName(electionId), eleccionId: electionId };
}
