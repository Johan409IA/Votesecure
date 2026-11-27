import { useEffect, useState } from 'react';
import { reenviarVerificacion } from '../services/auth.service';

// Botón de reenvío del enlace de verificación. Tras un envío se deshabilita
// 60 s (cooldown que también aplica la BD por cuenta).
const COOLDOWN_SEGUNDOS = 60;

export default function ReenviarVerificacion({ correo }) {
  const [espera, setEspera] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const reenviar = async () => {
    setEnviando(true);
    setMensaje('');
    try {
      // El backend responde igual exista o no la cuenta; no filtramos códigos.
      await reenviarVerificacion(correo);
      setEspera(COOLDOWN_SEGUNDOS);
      setMensaje(`Si tu cuenta aún no está verificada, te enviamos un nuevo enlace a ${correo}.`);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const deshabilitado = enviando || espera > 0;

  return (
    <div className="reenvio-caja">
      <button type="button" className="reenvio-boton" onClick={reenviar} disabled={deshabilitado}>
        {espera > 0
          ? `Podrás reenviar en ${espera} s`
          : enviando
            ? 'Reenviando…'
            : '¿No te llegó el correo? Reenviar enlace'}
      </button>
      {mensaje && <p className="reenvio-mensaje">{mensaje}</p>}
    </div>
  );
}
