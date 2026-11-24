import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Hammer } from 'lucide-react';
import './Cursos.css';

// Pantalla temporal de las rutas que todavía no se construyen
// (candidatos / votar y resultados en vivo).
export default function ProximamentePage() {
  const { id } = useParams();
  return (
    <div className="cursos-pagina">
      <Link to={`/cursos/${id}`} className="cu-volver">
        <ArrowLeft size={18} /> Volver al curso
      </Link>
      <div className="estado-vacio">
        <Hammer size={40} />
        <h2>Esta pantalla estará disponible pronto</h2>
        <p>Todavía estamos construyendo esta parte de VoteSecure.</p>
      </div>
    </div>
  );
}
