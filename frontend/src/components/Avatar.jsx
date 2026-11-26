import './Avatar.css';
import { inicialesDeUsuario } from '../utils/cursos';

// Foto de la persona; si no hay, sus iniciales.
export default function Avatar({ nombre, fotoUrl, tamano = 42, className = '' }) {
  const estilo = { width: tamano, height: tamano, fontSize: tamano * 0.36 };
  if (fotoUrl) {
    return <img className={`avatar avatar-foto ${className}`} style={estilo} src={fotoUrl} alt="" />;
  }
  return (
    <span className={`avatar avatar-iniciales ${className}`} style={estilo} aria-hidden="true">
      {inicialesDeUsuario(nombre)}
    </span>
  );
}