import { ForbiddenError } from '../../shared/errors';
import * as auditRepo from '../../data/repositories/audit.repo';
import { isAdmin, type SessionUser } from '../policies';

export async function listElectionAudit(user: SessionUser, electionId: number) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Solo los administradores consultan la auditoria');
  }
  return auditRepo.listEvents({ electionId });
}
