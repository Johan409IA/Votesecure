import { logger } from '../../config/logger';

export interface MailAdapter {
  sendVerification(recipient: string, link: string): Promise<void>;
}

const NOMBRE_REMITENTE = 'VoteSecure';
const ASUNTO_VERIFICACION = 'Confirma tu correo para activar tu cuenta en VoteSecure';

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

  // Nombre visible + direccion: REMITENTE_CORREO llega validado como correo
  // plano (env.ts usa z.email()), el nombre se compone aqui.
  private remitente(): string {
    return `${NOMBRE_REMITENTE} <${this.sender}>`;
  }

  private html(link: string): string {
    return `<!doctype html>
<html lang="es">
  <body style="margin:0; padding:24px; background:#f5f6f8; font-family:Arial,Helvetica,sans-serif; font-size:16px; color:#222222; line-height:1.5;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:8px; padding:32px;">
      <p style="margin:0 0 16px;">Hola,</p>
      <p style="margin:0 0 16px;">Recibimos una solicitud para crear una cuenta en <strong>VoteSecure</strong> con este correo. Confírmalo para poder iniciar sesión:</p>
      <p style="margin:24px 0; text-align:center;">
        <a href="${link}" style="display:inline-block; background:#c8102e; color:#ffffff; text-decoration:none; font-weight:bold; padding:12px 28px; border-radius:6px;">Confirmar mi correo</a>
      </p>
      <p style="margin:0 0 16px;">El enlace vence en 24 horas y solo se puede usar una vez.</p>
      <p style="margin:0 0 16px;">Si no creaste una cuenta, ignora este mensaje: nadie podrá usarla sin confirmar el correo.</p>
      <p style="margin:24px 0 0; color:#767676; font-size:14px;">El equipo de VoteSecure<br>votesecureapp.com</p>
    </div>
  </body>
</html>`;
  }

  private texto(link: string): string {
    return `Hola,

Recibimos una solicitud para crear una cuenta en VoteSecure con este correo. Confírmalo para poder iniciar sesión:

${link}

El enlace vence en 24 horas y solo se puede usar una vez.
Si no creaste una cuenta, ignora este mensaje: nadie podrá usarla sin confirmar el correo.

El equipo de VoteSecure
votesecureapp.com`;
  }

  async sendVerification(recipient: string, link: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.remitente(),
        to: recipient,
        subject: ASUNTO_VERIFICACION,
        text: this.texto(link),
        html: this.html(link)
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
  nodeEnv = 'development',
  realInDev = false
): MailAdapter {
  // Bypass de desarrollo (§2.1): por defecto se registra el enlace en el log
  // aunque exista RESEND_API_KEY, para que smoke y pruebas nunca envien
  // correos reales. El envio real en local exige el interruptor
  // CORREO_REAL_EN_LOCAL=true; en test nunca se envia, ni con el interruptor.
  const realMail =
    apiKey && (nodeEnv === 'production' || (nodeEnv === 'development' && realInDev));
  return realMail ? new ResendMailAdapter(apiKey!, sender) : new ConsoleMailAdapter();
}
