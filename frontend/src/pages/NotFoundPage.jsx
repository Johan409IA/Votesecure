import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="card not-found-card">
        <div className="escudo-grande">
          <svg viewBox="0 0 48 48" width="64" height="64">
            <circle cx="24" cy="24" r="22" fill="none" stroke="#0A1F33" strokeWidth="2" />
            <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="#0A1F33" opacity="0.08" />
            <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="none" stroke="#0A1F33" strokeWidth="1.5" />
            <path d="M18 18 L30 30 M30 18 L18 30" fill="none" stroke="#C8102E" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
        <h1>404</h1>
        <h2>Página no encontrada</h2>
        <p>La dirección que buscas no existe o fue movida.</p>
        <Link to="/elecciones" className="btn btn-primary">Volver a Elecciones</Link>
      </div>
    </div>
  );
}
