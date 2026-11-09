import { logger } from '../../config/logger';

export interface AdaptadorCorreo {
  enviarVerificacion(destinatario: string, enlace: string): Promise<void>;
}

class AdaptadorConsola implements AdaptadorCorreo {
  async enviarVerificacion(destinatario: string, enlace: string): Promise<void> {
    logger.info(
      { destinatario, enlace },
      'Enlace de verificacion (adaptador consola)'
    );
  }
}

class AdaptadorResend implements AdaptadorCorreo {
  constructor(
    private readonly apiKey: string,
    private readonly remitente: string
  ) {}

  async enviarVerificacion(destinatario: string, enlace: string): Promise<void> {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.remitente,
        to: destinatario,
        subject: 'Verifica tu cuenta VoteSecure',
        text: `Abre este enlace para verificar tu cuenta: ${enlace}`,
        html: `<p>Abre este enlace para verificar tu cuenta:</p><p><a href="${enlace}">${enlace}</a></p>`
      })
    });

    if (!respuesta.ok) {
      const errorData = await respuesta.json().catch(() => ({}));
      throw new Error(
        `Resend no pudo enviar el correo (HTTP ${respuesta.status}): ${JSON.stringify(errorData)}`
      );
    }
  }
}

export function crearAdaptadorCorreo(
  apiKey?: string,
  remitente = 'seguridad@votesecureapp.com'
): AdaptadorCorreo {
  return apiKey ? new AdaptadorResend(apiKey, remitente) : new AdaptadorConsola();
}
