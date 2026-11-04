import { logger } from '../../config/logger';
import * as eleccionesRepo from '../../datos/repositorios/elecciones.repo';

export class PlanificadorElectoral {
  private temporizador?: NodeJS.Timeout;

  constructor(private intervaloMs: number) {}

  iniciar(): void {
    void this.ejecutarCiclo();
    this.temporizador = setInterval(() => void this.ejecutarCiclo(), this.intervaloMs);
  }

  async detener(): Promise<void> {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = undefined;
    }
  }

  private async ejecutarCiclo(): Promise<void> {
    try {
      const paraActivar = await eleccionesRepo.listarProgramadasParaActivar();
      for (const eleccion of paraActivar) {
        try {
          await eleccionesRepo.activar(eleccion.id);
          logger.info({ eleccionId: eleccion.id }, 'Eleccion activada por el planificador');
        } catch (error) {
          logger.warn({ eleccionId: eleccion.id, error: String(error) }, 'No se pudo activar la eleccion');
        }
      }
      const paraCerrar = await eleccionesRepo.listarActivasParaCerrar();
      for (const eleccion of paraCerrar) {
        try {
          await eleccionesRepo.cerrarYPublicar(eleccion.id);
          logger.info({ eleccionId: eleccion.id }, 'Eleccion cerrada y publicada por el planificador');
        } catch (error) {
          logger.warn({ eleccionId: eleccion.id, error: String(error) }, 'No se pudo cerrar la eleccion');
        }
      }
    } catch (error) {
      logger.error({ error: String(error) }, 'Fallo el ciclo del planificador electoral');
    }
  }
}
