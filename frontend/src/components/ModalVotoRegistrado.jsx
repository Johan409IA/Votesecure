import { useEffect } from 'react';
import { Check } from 'lucide-react';
import './ModalesVoto.css';

export default function ModalVotoRegistrado({ alVolverAlCurso, alVerResultados }) {
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape') alVolverAlCurso();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alVolverAlCurso]);

  return (
    <div className="mv-fondo" role="presentation">
      <div
        className="mv-modal mv-exito"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mv-exito-titulo"
        aria-describedby="mv-exito-texto"
      >
        <div className="mv-exito-icono" aria-hidden="true">
          <span className="mv-exito-aro"><Check size={30} strokeWidth={3} /></span>
        </div>
        <h2 id="mv-exito-titulo">Voto registrado con éxito</h2>
        <p id="mv-exito-texto" className="mv-exito-texto">Tu participación fue registrada correctamente.</p>

        <div className="mv-acciones">
          <button type="button" className="mv-boton mv-boton-claro" onClick={alVolverAlCurso}>
            Volver al curso
          </button>
          <button type="button" className="mv-boton mv-boton-rojo" onClick={alVerResultados} autoFocus>
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}