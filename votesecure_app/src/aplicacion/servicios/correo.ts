import nodemailer, { type Transporter } from 'nodemailer';
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

class AdaptadorSmtp implements AdaptadorCorreo {
  private transporte: Transporter;
  constructor(url: string) {
    this.transporte = nodemailer.createTransport(url);
  }
  async enviarVerificacion(destinatario: string, enlace: string): Promise<void> {
    await this.transporte.sendMail({
      from: process.env.REMITENTE_CORREO ?? 'no-reply@votesecure.local',
      to: destinatario,
      subject: 'Verifica tu cuenta VoteSecure',
      text: `Abre este enlace para verificar tu cuenta: ${enlace}`,
      html: `<p>Abre este enlace para verificar tu cuenta:</p><p><a href="${enlace}">${enlace}</a></p>`
    });
  }
}

export function crearAdaptadorCorreo(smtpUrl?: string): AdaptadorCorreo {
  return smtpUrl ? new AdaptadorSmtp(smtpUrl) : new AdaptadorConsola();
}
