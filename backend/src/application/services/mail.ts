import { logger } from '../../config/logger';

export interface MailAdapter {
  sendVerification(recipient: string, link: string): Promise<void>;
}

class ConsoleMailAdapter implements MailAdapter {
  async sendVerification(recipient: string, link: string): Promise<void> {
    logger.info(
      { recipient, link },
      'Enlace de verificacion (adaptador consola)'
    );
  }
}

class ResendMailAdapter implements MailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly sender: string
  ) {}

  async sendVerification(recipient: string, link: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.sender,
        to: recipient,
        subject: 'Verifica tu cuenta VoteSecure',
        text: `Abre este enlace para verificar tu cuenta: ${link}`,
        html: `<p>Abre este enlace para verificar tu cuenta:</p><p><a href="${link}">${link}</a></p>`
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Resend no pudo enviar el correo (HTTP ${response.status}): ${JSON.stringify(errorData)}`
      );
    }
  }
}

export function createMailAdapter(
  apiKey: string | undefined,
  sender = 'seguridad@votesecureapp.com',
  nodeEnv = 'development'
): MailAdapter {
  // Bypass de desarrollo (§2.1): fuera de produccion se registra el enlace en
  // el log aunque exista RESEND_API_KEY, para que smoke y pruebas nunca
  // envien correos reales.
  return nodeEnv === 'production' && apiKey
    ? new ResendMailAdapter(apiKey, sender)
    : new ConsoleMailAdapter();
}
