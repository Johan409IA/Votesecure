import { NotFoundError, ForbiddenError, BusinessError } from '../../shared/errors';
import * as electionsRepo from '../../data/repositories/election.repo';
import {
  isSectionMember,
  getFinalResult,
  listTiedCandidates
} from '../../data/repositories/result.repo';
import { listEnrollmentsByStudent } from '../../data/repositories/academic.repo';
import type { ResultsPublisher } from '../services/realtime';
import {
  requireCanManageSection,
  isAdmin,
  type SessionUser
} from '../policies';
import { buildResultLoad } from './vote.use-cases';

export async function createElection(
  user: SessionUser,
  data: Omit<electionsRepo.NewElectionData, 'createdByUserId'>
): Promise<electionsRepo.Election> {
  await requireCanManageSection(user, data.sectionId);
  if (data.type === 'desempate') {
    return createTiebreakElection(user, data);
  }
  return electionsRepo.createElection({ ...data, createdByUserId: user.id });
}

// §6.2 "Iniciar Desempate": la eleccion derivada se crea con las
// candidaturas de los candidatos empatados en primer lugar, ya cargadas.
async function createTiebreakElection(
  user: SessionUser,
  data: Omit<electionsRepo.NewElectionData, 'createdByUserId'>
): Promise<electionsRepo.Election> {
  const originId = data.originElectionId;
  if (!originId) {
    throw new BusinessError('El desempate requiere una eleccion de origen');
  }
  const origin = await electionsRepo.getElection(originId);
  if (!origin) throw new NotFoundError('Eleccion de origen no encontrada');
  const result = await getFinalResult(originId);
  if (!result || result.situation !== 'empate') {
    throw new BusinessError(
      'El desempate requiere una eleccion de origen cerrada con empate positivo'
    );
  }
  const tied = await listTiedCandidates(originId);
  return electionsRepo.createElection({
    ...data,
    createdByUserId: user.id,
    candidacyEnrollmentIds: tied.map((candidate) => candidate.enrollmentId)
  });
}

export async function getElection(id: number) {
  const election = await electionsRepo.getElection(id);
  if (!election) throw new NotFoundError('Eleccion no encontrada');
  return election;
}

export async function listElections(
  user: SessionUser,
  sectionId: number
): Promise<electionsRepo.Election[]> {
  if (isAdmin(user) || user.type === 'docente') {
    return electionsRepo.listElectionsBySection(sectionId);
  }
  const member = await isSectionMember(user.id, sectionId);
  if (member) {
    return electionsRepo.listElectionsBySection(sectionId);
  }
  return electionsRepo
    .listElectionsBySection(sectionId)
    .then((list) => list.filter((election) => election.status === 'cerrada'));
}

export async function updateElection(
  user: SessionUser,
  electionId: number,
  changes: { name?: string; startsAt?: Date; endsAt?: Date }
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.updateElection(electionId, changes);
}

export async function addCandidacy(
  user: SessionUser,
  electionId: number,
  enrollmentId: number
): Promise<electionsRepo.Candidacy> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  return electionsRepo.addCandidacy(electionId, enrollmentId);
}

export async function removeCandidacy(
  user: SessionUser,
  electionId: number,
  candidacyId: number
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.removeCandidacy(electionId, candidacyId);
}

export async function addEligibility(
  user: SessionUser,
  electionId: number,
  enrollmentId: number
): Promise<electionsRepo.Eligibility> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  return electionsRepo.addEligibility(electionId, enrollmentId);
}

export async function removeEligibility(
  user: SessionUser,
  electionId: number,
  eligibilityId: number
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.removeEligibility(electionId, eligibilityId);
}

export async function scheduleElection(
  user: SessionUser,
  electionId: number
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.schedule(electionId, user.id);
}

export async function cancelElection(
  user: SessionUser,
  electionId: number,
  reason: string
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.cancel(electionId, user.id, reason);
}

export async function activateElection(
  user: SessionUser,
  electionId: number
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.activate(electionId);
}

export async function closeElection(
  user: SessionUser,
  publisher: ResultsPublisher,
  electionId: number
): Promise<void> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  await electionsRepo.closeAndPublish(electionId, true);
  const load = await buildResultLoad(electionId);
  if (load) {
    await publisher.publish(electionId, load);
  }
}

export async function electionDetail(electionId: number) {
  const election = await getElection(electionId);
  const [candidacies, eligibilities] = await Promise.all([
    electionsRepo.listCandidacies(electionId),
    electionsRepo.listEligibilities(electionId)
  ]);
  return { election, candidacies, eligibilities };
}

export async function activeElectionsForStudent(
  user: SessionUser
): Promise<electionsRepo.Election[]> {
  if (user.type !== 'estudiante') {
    throw new ForbiddenError('Solo aplica para estudiantes');
  }
  const enrollments = await listEnrollmentsByStudent(user.id);
  const active: electionsRepo.Election[] = [];
  for (const enrollment of enrollments) {
    const elections = await electionsRepo.listActiveBySection(enrollment.sectionId);
    active.push(...elections);
  }
  return active;
}

export async function proclaimDelegate(
  user: SessionUser,
  electionId: number,
  startsAt: Date,
  endsAt: Date | null
): Promise<number> {
  const election = await getElection(electionId);
  await requireCanManageSection(user, election.sectionId);
  const result = await getFinalResult(electionId);
  if (!result || result.situation !== 'ganador' || !result.winnerCandidacyId) {
    throw new ForbiddenError('Solo puede delegarse con un ganador unico publicado');
  }
  return electionsRepo.registerDelegation(
    electionId,
    election.sectionId,
    result.winnerCandidacyId,
    startsAt,
    endsAt
  );
}
