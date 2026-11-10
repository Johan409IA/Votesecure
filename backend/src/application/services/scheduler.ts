import { logger } from '../../config/logger';
import * as electionsRepo from '../../data/repositories/election.repo';

export class ElectionScheduler {
  private timer?: NodeJS.Timeout;

  constructor(private intervalMs: number) {}

  start(): void {
    void this.runCycle();
    this.timer = setInterval(() => void this.runCycle(), this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async runCycle(): Promise<void> {
    try {
      const toActivate = await electionsRepo.listScheduledToActivate();
      for (const election of toActivate) {
        try {
          await electionsRepo.activate(election.id);
          logger.info({ electionId: election.id }, 'Eleccion activada por el planificador');
        } catch (error) {
          logger.warn({ electionId: election.id, error: String(error) }, 'No se pudo activar la eleccion');
        }
      }
      const toClose = await electionsRepo.listActiveToClose();
      for (const election of toClose) {
        try {
          await electionsRepo.closeAndPublish(election.id);
          logger.info({ electionId: election.id }, 'Eleccion cerrada y publicada por el planificador');
        } catch (error) {
          logger.warn({ electionId: election.id, error: String(error) }, 'No se pudo cerrar la eleccion');
        }
      }
    } catch (error) {
      logger.error({ error: String(error) }, 'Fallo el ciclo del planificador electoral');
    }
  }
}
