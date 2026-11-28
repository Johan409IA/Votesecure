import { BloqueEnConstruccion } from './EnConstruccion';

// PLACEHOLDER — lo reemplaza Elton (feature/panel-elecciones).
// Lo usa la pestaña "Elecciones" del detalle de sección (la página es de Tatiana).
// Props: seccionId — id de la sección (string que viene de la URL).
export default function TabElecciones({ seccionId }) {
  return (
    <BloqueEnConstruccion
      titulo={`Elecciones de la sección ${seccionId ?? ''}`}
      responsable="Elton Vacas"
      rama="feature/panel-elecciones"
    />
  );
}
