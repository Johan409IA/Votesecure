import { BloqueEnConstruccion } from './EnConstruccion';

// PLACEHOLDER — lo reemplaza Dalia (feature/panel-ciclo-evaluaciones).
// Lo inserta Elton dentro de "Gestionar elección": <AccionesCiclo estado={...} eleccion={...} />
// Props:
//   estado    estado de la elección: borrador | programada | activa | cerrada | cancelada
//   eleccion  la elección completa (así Dalia no necesita tocar la página de Elton)
export default function AccionesCiclo() {
  return (
    <BloqueEnConstruccion
      titulo="Acciones del ciclo electoral (programar, activar, cancelar, cerrar)"
      responsable="Dalia Pariachi"
      rama="feature/panel-ciclo-evaluaciones"
    />
  );
}
