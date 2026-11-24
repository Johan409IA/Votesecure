import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Info, Lock, Mail } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const auth = useAuth();
  const [form, setForm] = useState({ correo: '', contrasena: '' });
  const [verContrasena, setVerContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  // Aviso que deja una sesión caducada; se muestra una sola vez.
  const [aviso] = useState(() => sessionStorage.getItem('mensajeLogin') ?? '');
  useEffect(() => {
    sessionStorage.removeItem('mensajeLogin');
  }, []);

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const ingresar = async (e) => {
    e.preventDefault();
    setError('');
    if (!REGEX_CORREO.test(form.correo.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    if (!form.contrasena) {
      setError('Escribe tu contraseña.');
      return;
    }
    setCargando(true);
    try {
      // Al iniciar sesión, RutaPublica redirige sola a la página de destino.
      await auth.login(form.correo.trim(), form.contrasena);
    } catch (err) {
      setError(err.status === 401 ? 'Correo o contraseña incorrectos.' : err.message);
      setCargando(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Iniciar sesión</h2>
      <p className="auth-subtitulo">Ingresa con tu cuenta institucional</p>

      {aviso && <div className="auth-alerta info">{aviso}</div>}
      {error && <div className="auth-alerta error" role="alert">{error}</div>}

      <form onSubmit={ingresar} noValidate>
        <div className="auth-grupo">
          <label htmlFor="correo">Correo institucional</label>
          <div className="auth-campo">
            <Mail size={19} />
            <input
              id="correo"
              type="email"
              autoComplete="username"
              placeholder="correo@utp.edu.pe"
              value={form.correo}
              onChange={cambiar('correo')}
            />
          </div>
          <p className="auth-ayuda"><Info size={14} /> Usa tu correo institucional asignado</p>
        </div>

        <div className="auth-grupo">
          <label htmlFor="contrasena">Contraseña</label>
          <div className="auth-campo con-ojo">
            <Lock size={19} />
            <input
              id="contrasena"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={form.contrasena}
              onChange={cambiar('contrasena')}
            />
            <button
              type="button"
              className="auth-ojo"
              onClick={() => setVerContrasena(!verContrasena)}
              aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verContrasena ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <button type="submit" className="auth-boton" disabled={cargando}>
          {cargando ? 'Ingresando…' : <>Iniciar sesión <ArrowRight size={19} /></>}
        </button>
      </form>

      <p className="auth-pie">¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </AuthLayout>
  );
}
