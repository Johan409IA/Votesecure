import type { ServerEnv } from '../config/env';
import type { MailAdapter } from '../application/services/mail';
import { createMailAdapter } from '../application/services/mail';
import type { ResultsPublisher } from '../application/services/realtime';
import { ResultsPublisher as Publisher } from '../application/services/realtime';

export interface ApiContext {
  env: ServerEnv;
  mail: MailAdapter;
  publisher: ResultsPublisher;
}

export function createContext(env: ServerEnv): ApiContext {
  return {
    env,
    mail: createMailAdapter(env.RESEND_API_KEY, env.REMITENTE_CORREO, env.NODE_ENV),
    publisher: new Publisher(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.REALTIME_CANAL_SECRETO
    )
  };
}
