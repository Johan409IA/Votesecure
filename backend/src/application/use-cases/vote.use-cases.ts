import { ForbiddenError } from '../../shared/errors';
import { logger } from '../../config/logger';
import * as votesRepo from '../../data/repositories/vote.repo';
import * as electionsRepo from '../../data/repositories/election.repo';
import type { ResultsPublisher, ResultLoad } from '../services/realtime';
import type { SessionUser } from '../policies';

export interface VoteConfirmation {
  confirmed: boolean;
}

export async function castVote(
  user: SessionUser,
  publisher: ResultsPublisher,
  electionId: number,
  candidacyId: number
): Promise<VoteConfirmation> {
  if (user.type !== 'estudiante') {
    throw new ForbiddenError('Solo los estudiantes habilitados pueden votar');
  }
  await votesRepo.castVote(electionId, user.id, candidacyId);

  try {
    const load = await buildResultLoad(electionId);
    if (load) {
      await publisher.publish(electionId, load);
    }
  } catch (error) {
    logger.warn(
      { electionId, error: String(error) },
      'No se pudo publicar el resultado en vivo tras el voto'
    );
  }

  return { confirmed: true };
}

export async function buildResultLoad(
  electionId: number
): Promise<ResultLoad | null> {
  const election = await electionsRepo.getElection(electionId);
  if (!election) return null;
  const [count, participation, candidacies] = await Promise.all([
    votesRepo.countVotesByCandidacy(electionId),
    votesRepo.electionParticipation(electionId),
    electionsRepo.listCandidacies(electionId)
  ]);
  const names = new Map(
    candidacies.map((candidacy) => [candidacy.id, candidacy.studentName] as const)
  );
  const votesById = new Map(
    count.map((item) => [item.candidacyId, item.votes] as const)
  );
  return {
    eleccionId: electionId,
    estado: election.status,
    totalHabilitados: participation.totalEligible,
    totalParticipantes: participation.totalParticipants,
    totalVotos: count.reduce((sum, item) => sum + item.votes, 0),
    candidaturas: candidacies.map((candidacy) => ({
      candidaturaId: candidacy.id,
      nombre: names.get(candidacy.id) ?? '',
      votos: votesById.get(candidacy.id) ?? 0
    }))
  };
}
