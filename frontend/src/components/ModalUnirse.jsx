import { useState } from 'react';
import { X } from 'lucide-react';
import { unirseConCodigo } from '../services/curso.service';

// Mismo formato que valida el backend: SEC- y 4 caracteres (sin 0, 1, I, L, O).
const REGEX_CODIGO = /^SEC-[A-HJ-KM-NP-Z2-9]{4}$/;

export default function ModalUnirse({ alCerrar, alUnirse }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (!REGEX_CODIGO.test(limpio)) {
      setError('El código tiene el formato SEC-XXXX, por ejemplo SEC-K7M2.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await unirseConCodigo(limpio);
      alUnirse();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={alCerrar} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-unirse-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-cerrar" onClick={alCerrar} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h2 id="modal-unirse-titulo">Unirse a un curso</h2>
        <p className="modal-texto">Escribe el código de sección que te dio tu docente.</p>

        {error && <div className="aviso aviso-error" role="alert">{error}</div>}

        <form onSubmit={enviar} noValidate>
          <label htmlFor="codigo-seccion" className="modal-etiqueta">Código de sección</label>
          <input
            id="codigo-seccion"
            className="modal-input"
            type="text"
            autoFocus
            autoComplete="off"
            placeholder="SEC-XXXX"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <div className="modal-acciones">
            <button type="button" className="boton boton-claro" onClick={alCerrar}>Cancelar</button>
            <button type="submit" className="boton boton-rojo" disabled={enviando}>
              {enviando ? 'Uniéndome…' : 'Unirme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
