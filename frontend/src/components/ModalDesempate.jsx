import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Timer, X } from 'lucide-react';
import { iniciarDesempate } from '../services/resultado.service';
import './ModalesVoto.css';

const DURACIONES = [15, 20, 25, 30];

// Inicia el balotaje entre los candidatos empatados: crea la elección
// derivada, la programa y la activa para que la votación abra de inmediato.
export default function ModalDesempate({ seccion, eleccionOrigenId, alCerrar, alIniciado }) {
  const navigate = useNavigate();
  const [minutos, setMinutos] = useState(20);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      // Pequeño margen inicial para que la activación no pierda por el reloj.
      const iniciaEn = Date.now() + 60_000;
      await iniciarDesempate({
        seccionId: seccion.id,
        nombre: `Desempate — ${seccion.courseName}`,
        iniciaEn: new Date(iniciaEn).toISOString(),
        cierraEn: new Date(iniciaEn + minutos * 60_000).toISOString(),
        eleccionOrigenId,
      });
      alIniciado();
      navigate(`/cursos/${seccion.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="mv-fondo" role="dialog" aria-modal="true" aria-labelledby="desempate-titulo">
      <form className="mv-modal" onSubmit={enviar}>
        <button type="button" className="mv-cerrar" onClick={alCerrar} disabled={enviando} aria-label="Cerrar">
          <X size={22} />
        </button>
        <p className="mv-paso">Regla de la clase · <b>Balotaje</b></p>
        <h2 id="desempate-titulo" className="mv-titulo">Iniciar desempate</h2>
        <p className="mv-sub">
          Se abre una votación corta entre los candidatos empatados de esta sección.
          Los habilitados podrán votar de nuevo desde su pantalla del curso.
        </p>

        <label className="mp-campo mp-duracion">
          <Timer size={17} />
          <span>Duración de la votación</span>
          <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} disabled={enviando}>
            {DURACIONES.map((m) => (
              <option key={m} value={m}>{m} minutos</option>
            ))}
          </select>
        </label>

        <div className="mv-alerta">
          <Scale size={20} />
          La ventana del desempate debe durar entre 15 y 30 minutos. La votación
          comenzará en un minuto y se cerrará sola al terminar el tiempo.
        </div>
        {error && <div className="mv-alerta mv-error" role="alert">{error}</div>}

        <div className="mv-acciones">
          <button type="button" className="mv-boton mv-boton-claro" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="mv-boton mv-boton-rojo" disabled={enviando}>
            {enviando ? 'Iniciando…' : 'Iniciar desempate'}
          </button>
        </div>
      </form>
    </div>
  );
}
