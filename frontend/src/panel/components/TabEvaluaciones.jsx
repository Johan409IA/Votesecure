import { BloqueEnConstruccion } from './EnConstruccion';

// PLACEHOLDER — lo reemplaza Dalia (feature/panel-ciclo-evaluaciones).
// Lo usa la pestaña "Evaluaciones" del detalle de sección (la página es de Tatiana).
// Props: seccionId — id de la sección (string que viene de la URL).
export default function TabEvaluaciones({ seccionId }) {
  return (
    <BloqueEnConstruccion
      titulo={`Evaluaciones de la sección ${seccionId ?? ''}`}
      responsable="Dalia Pariachi"
      rama="feature/panel-ciclo-evaluaciones"
    />
  );
}
