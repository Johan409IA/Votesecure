import { QRCodeSVG } from 'qrcode.react';

/**
 * Genera un QR a partir del hash público del comprobante de voto.
 * El QR codifica una URL de verificación (/mi-comprobante?hash=...) para
 * que, al escanearlo, cualquier dispositivo pueda abrir la app y verificar
 * automáticamente que el voto fue contado — sin revelar nunca al candidato.
 */
export default function QRComprobante({ hash, tamano = 168 }) {
  if (!hash) return null;
  const url = `${window.location.origin}/mi-comprobante?hash=${hash}`;

  return (
    <div className="qr-box">
      <QRCodeSVG value={url} size={tamano} fgColor="#0A1F33" level="M" />
      <p style={{ fontSize: '.75rem', color: 'var(--gris-piedra)', textAlign: 'center' }}>
        Escanea para verificar tu voto desde otro dispositivo
      </p>
    </div>
  );
}
