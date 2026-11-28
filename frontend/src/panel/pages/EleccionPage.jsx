import { useParams } from 'react-router-dom';
import AccionesCiclo from '../components/AccionesCiclo';
import EnConstruccion from '../components/EnConstruccion';

// PLACEHOLDER — lo reemplaza Elton (feature/panel-elecciones). Ruta: /panel/elecciones/:id
// "Gestionar elección": editar borrador, candidaturas, habilitaciones y, dentro,
// <AccionesCiclo estado={...} eleccion={...} /> que es de Dalia.
export default function EleccionPage() {
  const { id } = useParams();
  return (
    <>
      <EnConstruccion
        titulo={`Gestionar elección ${id}`}
        responsable="Elton Vacas"
        rama="feature/panel-elecciones"
        detalle="Editar borrador, candidaturas y habilitaciones del padrón."
      />
      <div className="panel-pagina">
        <AccionesCiclo />
      </div>
    </>
  );
}
