import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Info, Lock, Mail, User } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import ReenviarVerificacion from '../components/ReenviarVerificacion';
import { useAuth } from '../hooks/useAuth';

// Mismas reglas del backend: u + 8 dígitos = estudiante, c + 5 dígitos = docente.
const REGEX_ESTUDIANTE = /^u\d{8}@utp\.edu\.pe$/;
const REGEX_DOCENTE = /^c\d{5}@utp\.edu\.pe$/;
const CONTRASENA_MIN = 15;
const CONTRASENA_MAX = 128;

function validar(form) {
  const nombre = form.nombre.trim();
  if (nombre.length < 3) return 'Escribe tu nombre completo (mínimo 3 letras).';
  if (nombre.length > 120) return 'El nombre es demasiado largo.';
  const correo = form.correo.trim().toLowerCase();
  if (!REGEX_ESTUDIANTE.test(correo) && !REGEX_DOCENTE.test(correo)) {
    return 'Usa tu correo institucional: estudiante (u + 8 dígitos @utp.edu.pe) o docente (c + 5 dígitos @utp.edu.pe).';
  }
  if (form.contrasena.length < CONTRASENA_MIN) {
    return `La contraseña debe tener al menos ${CONTRASENA_MIN} caracteres.`;
  }
  if (form.contrasena.length > CONTRASENA_MAX) {
    return `La contraseña no puede superar los ${CONTRASENA_MAX} caracteres.`;
  }
  if (form.contrasena !== form.confirmar) return 'Las contraseñas no coinciden.';
  return '';
}

export default function RegistroPage() {
  const auth = useAuth();
  const [form, setForm] = useState({ nombre: '', correo: '', contrasena: '', confirmar: '' });
  const [verContrasena, setVerContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const registrar = async (e) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setCargando(true);
    try {
      await auth.registro({
        nombre: form.nombre.trim(),
        correo: form.correo.trim().toLowerCase(),
        contrasena: form.contrasena,
      });
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (enviado) {
    return (
      <AuthLayout>
        <div className="auth-estado">
          <div className="auth-estado-icono ok"><CheckCircle2 size={34} /></div>
          <h2>Revisa tu correo</h2>
          <p className="auth-subtitulo">
            Si el correo es válido, te enviamos un enlace para verificar tu cuenta. El enlace vence en 24 horas.
          </p>
        </div>
        <ReenviarVerificacion correo={form.correo.trim().toLowerCase()} />
        <Link to="/login" className="auth-boton">
          Ir a iniciar sesión <ArrowRight size={19} />
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Crear cuenta</h2>
      <p className="auth-subtitulo">Regístrate con tu correo institucional</p>

      {error && <div className="auth-alerta error" role="alert">{error}</div>}

      <form onSubmit={registrar} noValidate>
        <div className="auth-grupo">
          <label htmlFor="nombre">Nombre completo</label>
          <div className="auth-campo">
            <User size={19} />
            <input
              id="nombre"
              type="text"
              autoComplete="name"
              placeholder="Nombres y apellidos"
              value={form.nombre}
              onChange={cambiar('nombre')}
            />
          </div>
        </div>

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
              <p className="auth-ayuda"><Info size={14} /> Estudiantes: u + 8 dígitos @utp.edu.pe · Docentes: c + 5 dígitos @utp.edu.pe</p>
        </div>

        <div className="auth-grupo">
          <label htmlFor="contrasena">Contraseña</label>
          <div className="auth-campo con-ojo">
            <Lock size={19} />
            <input
              id="contrasena"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 15 caracteres"
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
          <p className="auth-ayuda"><Info size={14} /> Una frase larga es más segura que una clave corta</p>
        </div>

        <div className="auth-grupo">
          <label htmlFor="confirmar">Confirmar contraseña</label>
          <div className="auth-campo">
            <Lock size={19} />
            <input
              id="confirmar"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={form.confirmar}
              onChange={cambiar('confirmar')}
            />
          </div>
        </div>

        <button type="submit" className="auth-boton" disabled={cargando}>
          {cargando ? 'Creando cuenta…' : <>Crear cuenta <ArrowRight size={19} /></>}
        </button>
      </form>

      <p className="auth-pie">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </AuthLayout>
  );
}
