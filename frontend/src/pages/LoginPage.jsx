import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './AuthPages.css';

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [infoSesion, setInfoSesion] = useState('');
  const [form, setForm] = useState({ correo: '', password: '' });

  useEffect(() => {
    const msg = sessionStorage.getItem('mensajeLogin');
    if (msg) {
      setInfoSesion(msg);
      sessionStorage.removeItem('mensajeLogin');
    }
  }, []);

  const ingresar = async () => {
    if (!form.correo || !form.password) {
      setError('Completa todos los campos');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await auth.login(form.correo, form.password);
      navigate('/elecciones');
    } catch (e) {
      setError(e.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const onKeyUp = (e) => { if (e.key === 'Enter') ingresar(); };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-escudo">
            <svg viewBox="0 0 48 48" width="44" height="44">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#0A1F33" strokeWidth="2" />
              <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="#0A1F33" opacity="0.1" />
              <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="none" stroke="#0A1F33" strokeWidth="1.5" />
              <path d="M18 24 L22 28 L31 18" fill="none" stroke="#C8102E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>VotoSeguro</h1>
          <p>Plataforma de votación digital con cifrado</p>
        </div>

        {infoSesion && <div className="alert alert-info">{infoSesion}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label>Correo electrónico</label>
          <input type="email" placeholder="tu@correo.com" value={form.correo} onKeyUp={onKeyUp}
            onChange={(e) => setForm({ ...form, correo: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input type="password" placeholder="••••••••" value={form.password} onKeyUp={onKeyUp}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        <button onClick={ingresar} disabled={cargando} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="auth-footer">¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
      </div>
    </div>
  );
}
