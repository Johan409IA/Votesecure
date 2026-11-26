import { Check } from 'lucide-react';
import Avatar from './Avatar';

// Tarjeta de un candidato (idea original de Elton, ahora con el estilo del mockup).
// `candidatura` es un elemento de `candidacies` de GET /elecciones/:id.
export default function CandidatoCard({ candidatura, seleccionado, onSelect }) {
  return (
    <button
      type="button"
      className={`ca-tarjeta${seleccionado ? ' activa' : ''}`}
      onClick={() => onSelect(candidatura)}
      aria-pressed={seleccionado}
    >
      <Avatar nombre={candidatura.studentName} fotoUrl={candidatura.studentPhotoUrl} tamano={84} />
      <span className="ca-tarjeta-info">
        <strong>{candidatura.studentName}</strong>
        <small>Candidato/a a delegado/a</small>
        {seleccionado && (
          <span className="ca-chip"><Check size={14} strokeWidth={3} /> Seleccionado</span>
        )}
      </span>
      <span className="ca-radio" aria-hidden="true" />
    </button>
  );
}