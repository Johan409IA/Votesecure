import { cargarEntornoServidor } from './config/env';
import { logger } from './config/logger';
import { crearApp } from './app';
import { cerrarPool } from './datos/db';
import { PlanificadorElectoral } from './aplicacion/servicios/planificador';
import { crearContexto } from './presentacion/contexto';

async function main(): Promise<void> {
  const entorno = cargarEntornoServidor();
  const contexto = crearContexto(entorno);
  const app = crearApp(entorno, contexto);
  const servidor = app.listen(entorno.PORT, () => {
    logger.info(`Backend VoteSecure escuchando en el puerto ${entorno.PORT}`);
  });

  const planificador = new PlanificadorElectoral(20_000);
  planificador.iniciar();

  let cerrando = false;
  const cerrar = async (senal: string): Promise<void> => {
    if (cerrando) return;
    cerrando = true;
    logger.info(`Senal ${senal}: cierre ordenado en curso`);
    await planificador.detener();
    await contexto.publicador.detener();
    servidor.close(() => {
      void cerrarPool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => void cerrar('SIGINT'));
  process.on('SIGTERM', () => void cerrar('SIGTERM'));
}

main().catch((error) => {
  logger.error({ error: String(error) }, 'Fallo el arranque del backend');
  process.exit(1);
});
