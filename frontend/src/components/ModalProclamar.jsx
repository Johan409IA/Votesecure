import { useState } from 'react';
import { BadgeCheck, CalendarClock, X } from 'lucide-react';
import { proclamarDelegado } from '../services/resultado.service';
import './ModalesVoto.css';

// Valor "YYYY-MM-DDTHH:mm" para <input type="datetime-local">, en hora local.
function valorFecha(fecha) {
  const d = new Date(fecha);
  const ajuste = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return ajuste.toISOString().slice(0, 16);
}

// Proclama al delegado electo: define la vigencia de la delegación.
export default function ModalProclamar({ eleccionId, nombreGanador, alCerrar, alProclamar }) {
  const [iniciaEn, setIniciaEn] = useState(() => valorFecha(Date.now()));
  const [terminaEn, setTerminaEn] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await proclamarDelegado(eleccionId, {
        iniciaEn: new Date(iniciaEn).toISOString(),
        terminaEn: terminaEn ? new Date(terminaEn).toISOString() : undefined,
      });
      alProclamar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="mv-fondo" role="dialog" aria-modal="true" aria-labelledby="proclamar-titulo">
      <form className="mv-modal" onSubmit={enviar}>
        <button type="button" className="mv-cerrar" onClick={alCerrar} disabled={enviando} aria-label="Cerrar">
          <X size={22} />
        </button>
        <p className="mv-paso">Paso final · <b>Proclamación oficial</b></p>
        <h2 id="proclamar-titulo" className="mv-titulo">Proclamar delegado</h2>
        <p className="mv-sub">
          Con esto <strong>{nombreGanador}</strong> queda proclamado como delegado de la
          sección y comienza su vigencia en el ciclo académico.
        </p>

        <div className="mp-campos">
          <label className="mp-campo">
            <CalendarClock size={17} />
            <span>Inicio de la delegación</span>
            <input
              type="datetime-local"
              required
              value={iniciaEn}
              onChange={(e) => setIniciaEn(e.target.value)}
              disabled={enviando}
            />
          </label>
          <label className="mp-campo">
            <CalendarClock size={17} />
            <span>Fin (opcional)</span>
            <input
              type="datetime-local"
              value={terminaEn}
              onChange={(e) => setTerminaEn(e.target.value)}
              disabled={enviando}
            />
          </label>
        </div>

        <div className="mv-alerta">
          <BadgeCheck size={20} />
          Solo puede proclamarse al ganador único de la elección cerrada. Esta acción
          queda registrada en la bitácora electoral.
        </div>
        {error && <div className="mv-alerta mv-error" role="alert">{error}</div>}

        <div className="mv-acciones">
          <button type="button" className="mv-boton mv-boton-claro" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="mv-boton mv-boton-rojo" disabled={enviando}>
            {enviando ? 'Proclamando…' : 'Confirmar proclamación'}
          </button>
        </div>
      </form>
    </div>
  );
}
