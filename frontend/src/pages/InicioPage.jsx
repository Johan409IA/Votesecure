import { useAuth } from '../hooks/useAuth';

// Pantalla provisional: se reemplaza por "Mis cursos" cuando se construya.
export default function InicioPage() {
  const { usuario } = useAuth();
  const primerNombre = usuario.nombre.split(' ')[0];

  return (
    <div className="card">
      <h1>Hola, {primerNombre}</h1>
      <p>Iniciaste sesión como <strong>{usuario.tipo}</strong> con {usuario.correo}.</p>

      {!usuario.correoVerificado && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          Tu correo aún no está verificado. Revisa tu bandeja y abre el enlace que te enviamos.
        </div>
      )}

      <p style={{ marginTop: '1rem', color: '#5A6472' }}>
        Aquí aparecerán tus cursos y elecciones.
      </p>
    </div>
  );
}
