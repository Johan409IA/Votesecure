import { useParams } from 'react-router-dom';
import EnConstruccion from '../components/EnConstruccion';

// PLACEHOLDER — lo reemplaza Elton (feature/panel-elecciones).
// Ruta: /panel/secciones/:id/elecciones/nueva  (:id = id de la sección)
export default function NuevaEleccionPage() {
  const { id } = useParams();
  return (
    <EnConstruccion
      titulo={`Nueva elección (sección ${id})`}
      responsable="Elton Vacas"
      rama="feature/panel-elecciones"
    />
  );
}
