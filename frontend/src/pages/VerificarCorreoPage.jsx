import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';

// El correo trae: /verificar-correo?correo=...&token=...
// Con esos datos se llama al backend (GET /api/auth/verificar), que confirma la
// cuenta y regresa aquí con ?estado=ok o ?estado=error.
export default function VerificarCorreoPage() {
  const [params] = useSearchParams();
  const estado = params.get('estado');
  const correo = params.get('correo');
  const token = params.get('token');
  const iniciado = useRef(false);

  const hayEnlace = !estado && correo && token;

  useEffect(() => {
    if (!hayEnlace || iniciado.current) return;
    iniciado.current = true; // el token es de un solo uso: evita pedirlo dos veces
    const consulta = new URLSearchParams({ correo, token });
    window.location.replace(`/api/auth/verificar?${consulta.toString()}`);
  }, [hayEnlace, correo, token]);

  let contenido;
  if (hayEnlace) {
    contenido = (
      <div className="auth-estado">
        <div className="auth-estado-icono espera"><Loader2 size={34} /></div>
        <h2>Verificando tu correo…</h2>
        <p className="auth-subtitulo">Un momento, estamos confirmando tu cuenta.</p>
      </div>
    );
  } else if (estado === 'ok') {
    contenido = (
      <>
        <div className="auth-estado">
          <div className="auth-estado-icono ok"><CheckCircle2 size={34} /></div>
          <h2>Correo verificado</h2>
          <p className="auth-subtitulo">Tu cuenta quedó confirmada. Ya puedes iniciar sesión.</p>
        </div>
        <Link to="/login" className="auth-boton">Iniciar sesión <ArrowRight size={19} /></Link>
      </>
    );
  } else {
    contenido = (
      <>
        <div className="auth-estado">
          <div className="auth-estado-icono error"><XCircle size={34} /></div>
          <h2>Enlace no válido</h2>
          <p className="auth-subtitulo">
            El enlace de verificación es incorrecto o ya venció. Puedes intentar registrarte de nuevo.
          </p>
        </div>
        <Link to="/registro" className="auth-boton">Ir al registro <ArrowRight size={19} /></Link>
      </>
    );
  }

  return <AuthLayout>{contenido}</AuthLayout>;
}
