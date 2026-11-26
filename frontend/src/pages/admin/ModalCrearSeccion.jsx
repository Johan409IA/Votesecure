import { useState } from 'react';
import { X } from 'lucide-react';
import { crearSeccion } from '../../services/admin.service';

// Mismos límites que valida el backend.
const LIMITES = { codigoCurso: 30, nombreCurso: 160, periodoAcademico: 30 };

export default function ModalCrearSeccion({ alCerrar, alCrear }) {
  const [form, setForm] = useState({ codigoCurso: '', nombreCurso: '', periodoAcademico: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    const datos = {
      codigoCurso: form.codigoCurso.trim(),
      nombreCurso: form.nombreCurso.trim(),
      periodoAcademico: form.periodoAcademico.trim(),
    };
    if (!datos.codigoCurso || !datos.nombreCurso || !datos.periodoAcademico) {
      setError('Completa los tres campos.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const seccion = await crearSeccion(datos);
      alCrear(seccion);
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
        aria-labelledby="modal-seccion-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-cerrar" onClick={alCerrar} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h2 id="modal-seccion-titulo">Crear sección</h2>
        <p className="modal-texto">
          Al crearla se genera el código <strong>SEC-XXXX</strong> que usarán los estudiantes para unirse.
        </p>

        {error && <div className="aviso aviso-error" role="alert">{error}</div>}

        <form onSubmit={enviar} noValidate>
          <div className="modal-grupo">
            <label htmlFor="codigoCurso" className="modal-etiqueta">Código del curso</label>
            <input
              id="codigoCurso"
              className="modal-input normal"
              type="text"
              autoFocus
              autoComplete="off"
              placeholder="Ej. 1ASI0123"
              maxLength={LIMITES.codigoCurso}
              value={form.codigoCurso}
              onChange={cambiar('codigoCurso')}
            />
          </div>
          <div className="modal-grupo">
            <label htmlFor="nombreCurso" className="modal-etiqueta">Nombre del curso</label>
            <input
              id="nombreCurso"
              className="modal-input normal"
              type="text"
              autoComplete="off"
              placeholder="Ej. Principio de algoritmos"
              maxLength={LIMITES.nombreCurso}
              value={form.nombreCurso}
              onChange={cambiar('nombreCurso')}
            />
          </div>
          <div className="modal-grupo">
            <label htmlFor="periodoAcademico" className="modal-etiqueta">Periodo académico</label>
            <input
              id="periodoAcademico"
              className="modal-input normal"
              type="text"
              autoComplete="off"
              placeholder="Ej. 2026-2"
              maxLength={LIMITES.periodoAcademico}
              value={form.periodoAcademico}
              onChange={cambiar('periodoAcademico')}
            />
          </div>
          <div className="modal-acciones">
            <button type="button" className="boton boton-claro" onClick={alCerrar}>Cancelar</button>
            <button type="submit" className="boton boton-rojo" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear sección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
