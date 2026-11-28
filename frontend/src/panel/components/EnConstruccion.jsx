import { Hammer } from 'lucide-react';

// Marcador de las pantallas y componentes que todavía no se construyen.
// Cada integrante reemplaza el archivo que le toca; quien lo reemplaza ya no lo usa.

// Pantalla completa (para las páginas).
export default function EnConstruccion({ titulo, responsable, rama, detalle }) {
  return (
    <div className="panel-pagina">
      <div className="panel-cabecera">
        <h1>{titulo}</h1>
      </div>
      <div className="panel-en-construccion">
        <Hammer size={36} />
        <h2>Pantalla en construcción</h2>
        <p>Responsable: <strong>{responsable}</strong> · rama <code>{rama}</code></p>
        {detalle && <p>{detalle}</p>}
      </div>
    </div>
  );
}

// Bloque pequeño (para pestañas y secciones dentro de otra pantalla).
export function BloqueEnConstruccion({ titulo, responsable, rama }) {
  return (
    <div className="panel-en-construccion bloque">
      <Hammer size={24} />
      <h3>{titulo}</h3>
      <p>Responsable: <strong>{responsable}</strong> · rama <code>{rama}</code></p>
    </div>
  );
}
