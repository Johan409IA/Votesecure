import type { EntornoServidor } from '../config/env';
import type { AdaptadorCorreo } from '../aplicacion/servicios/correo';
import { crearAdaptadorCorreo } from '../aplicacion/servicios/correo';
import type { PublicadorResultados } from '../aplicacion/servicios/realtime';
import { PublicadorResultados as Publicador } from '../aplicacion/servicios/realtime';

export interface ContextoApi {
  entorno: EntornoServidor;
  correo: AdaptadorCorreo;
  publicador: PublicadorResultados;
}

export function crearContexto(entorno: EntornoServidor): ContextoApi {
  return {
    entorno,
    correo: crearAdaptadorCorreo(entorno.SMTP_URL),
    publicador: new Publicador(
      entorno.SUPABASE_URL,
      entorno.SUPABASE_SERVICE_ROLE_KEY,
      entorno.REALTIME_CANAL_SECRETO
    )
  };
}
