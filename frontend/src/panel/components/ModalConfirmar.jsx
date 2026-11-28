import { useEffect } from 'react';
import { X } from 'lucide-react';

// Ventana de confirmación para acciones que no se pueden deshacer a la ligera
// (desactivar una cuenta, cancelar una elección...). Reutilizable por todo el panel.
//   titulo, texto      lo que se pregunta
//   textoConfirmar     texto del botón principal (por defecto "Confirmar")
//   peligro            true: el botón principal va en rojo
//   enviando, error    estado mientras se ejecuta la acción
//   alConfirmar, alCancelar   funciones
export default function ModalConfirmar({
  titulo, texto, textoConfirmar = 'Confirmar', peligro = false,
  enviando = false, error = '', alConfirmar, alCancelar,
}) {
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !enviando) alCancelar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCancelar, enviando]);

  return (
    <div className="panel-modal-fondo" onClick={enviando ? undefined : alCancelar} role="presentation">
      <div
        className="panel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="panel-modal-cerrar" onClick={alCancelar} disabled={enviando} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h2 id="panel-modal-titulo">{titulo}</h2>
        <p className="panel-modal-texto">{texto}</p>
        {error && <div className="panel-aviso panel-aviso-error" role="alert">{error}</div>}
        <div className="panel-modal-acciones">
          <button type="button" className="panel-boton panel-boton-claro" onClick={alCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="button"
            className={`panel-boton ${peligro ? 'panel-boton-rojo' : 'panel-boton-gris'}`}
            onClick={alConfirmar}
            disabled={enviando}
          >
            {enviando ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
