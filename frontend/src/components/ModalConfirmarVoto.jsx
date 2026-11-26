import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { inicialesDeUsuario } from '../utils/cursos';
import './ModalesVoto.css';

export default function ModalConfirmarVoto({
  candidatura,
  nombreCurso,
  codigoSeccion,
  alConfirmar,
  alVolver,
  alRegistrado,
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Escape equivale a "Volver" (salvo mientras se envía el voto).
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !enviando) alVolver();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [enviando, alVolver]);

  const confirmar = async () => {
    if (enviando) return; // evita doble clic: el voto solo se emite una vez
    setError('');
    setEnviando(true);
    try {
      await alConfirmar();
      alRegistrado();
    } catch (err) {
      setError(err?.message ?? 'No se pudo registrar tu voto. Inténtalo de nuevo.');
      setEnviando(false);
    }
  };

  const nombre = candidatura.studentName;

  return (
    <div className="mv-fondo" onClick={() => !enviando && alVolver()} role="presentation">
      <div
        className="mv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mv-confirmar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mv-paso">
          <b>Paso 3 de 3</b> · Confirmación
        </p>
        <button type="button" className="mv-cerrar" onClick={alVolver} disabled={enviando} aria-label="Cerrar">
          <X size={22} />
        </button>

        <h2 id="mv-confirmar-titulo" className="mv-titulo">Confirma tu voto</h2>
        <p className="mv-sub">Revisa tu selección antes de continuar.</p>

        <div className="mv-candidato">
          <div className="mv-avatar" aria-hidden="true">{inicialesDeUsuario(nombre)}</div>
          <div className="mv-candidato-datos">
            <p className="mv-candidato-nombre">{nombre}</p>
            <p className="mv-candidato-rol">Candidato/a a delegado/a</p>
            <p className="mv-candidato-curso">
              {nombreCurso} · Sección {codigoSeccion}
            </p>
          </div>
        </div>

        <div className="mv-alerta" role="note">
          <TriangleAlert size={22} />
          <span>Una vez confirmado, no podrás cambiar tu voto ni volver a votar en esta elección.</span>
        </div>

        {error && (
          <div className="mv-alerta mv-error" role="alert">
            <TriangleAlert size={22} />
            <span>{error}</span>
          </div>
        )}

        <p className="mv-nota">Verifica que tu selección sea correcta antes de confirmar.</p>

        <div className="mv-acciones">
          <button type="button" className="mv-boton mv-boton-claro" onClick={alVolver} disabled={enviando} autoFocus>
            Volver
          </button>
          <button type="button" className="mv-boton mv-boton-rojo" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Confirmar voto'}
          </button>
        </div>
      </div>
    </div>
  );
}