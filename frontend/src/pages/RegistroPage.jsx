import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReniec } from '../hooks/useReniec';
import { listarOrganizacionesPublico } from '../services/eleccion.service';
import './AuthPages.css';

export default function RegistroPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const reniec = useReniec();

  const [cargando, setCargando] = useState(false);
  const [cargandoOrgs, setCargandoOrgs] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [organizaciones, setOrganizaciones] = useState([]);
  const [dni, setDni] = useState('');
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', organizacion_id: '' });

  useEffect(() => {
    listarOrganizacionesPublico()
      .then(setOrganizaciones)
      .catch(console.error)
      .finally(() => setCargandoOrgs(false));
  }, []);

  const verificarDni = async () => {
    const persona = await reniec.verificar(dni);
    if (persona) {
      setForm((f) => ({ ...f, nombre: persona.nombreCompleto }));
    }
  };

  const registrarse = async () => {
    if (!reniec.persona) {
      setError('Primero verifica tu DNI con RENIEC');
      return;
    }
    if (!form.nombre || !form.correo || !form.password) {
      setError('Completa todos los campos');
      return;
    }
    if (!form.organizacion_id) {
      setError('Debes seleccionar tu organización');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await auth.registro({
        ...form,
        dni: reniec.persona.dni,
        verificadoReniec: true,
      });
      navigate('/elecciones');
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-escudo">
            <svg viewBox="0 0 48 48" width="44" height="44">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#0A1F33" strokeWidth="2" />
              <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="#0A1F33" opacity="0.1" />
              <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="none" stroke="#0A1F33" strokeWidth="1.5" />
            </svg>
          </div>
          <h1>Crear cuenta</h1>
          <p>Regístrate para participar en votaciones</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {exito && <div className="alert alert-success">{exito}</div>}

        {/* ── Paso 1: Verificación RENIEC ────────────────────────── */}
        <div className="dni-row">
          <div className="form-group">
            <label>DNI</label>
            <input
              type="text" maxLength={8} placeholder="8 dígitos"
              value={dni} disabled={!!reniec.persona}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            onClick={verificarDni}
            disabled={reniec.verificando || !!reniec.persona || dni.length !== 8}
            className="btn btn-outline btn-verificar"
          >
            {reniec.verificando ? 'Verificando...' : reniec.persona ? 'Verificado ✓' : 'Verificar con RENIEC'}
          </button>
        </div>
        {reniec.error && <div className="alert alert-error" style={{ marginTop: '.6rem' }}>{reniec.error}</div>}
        {reniec.persona && (
          <div className="dni-verificado">✓ Identidad verificada: {reniec.persona.nombreCompleto}</div>
        )}

        {/* ── Paso 2: Datos de cuenta (solo tras verificar) ───────── */}
        <div style={{ marginTop: '1.4rem', opacity: reniec.persona ? 1 : 0.45, pointerEvents: reniec.persona ? 'auto' : 'none' }}>
          <div className="form-group">
            <label>Nombre completo</label>
            <input
              type="text"
              value={form.nombre}
              readOnly
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              placeholder="Se completará automáticamente con tu DNI"
            />
          </div>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input type="email" placeholder="tu@correo.com" value={form.correo}
              onChange={(e) => setForm({ ...form, correo: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" placeholder="Mínimo 6 caracteres" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Organización (curso/aula)</label>
            <select value={form.organizacion_id} onChange={(e) => setForm({ ...form, organizacion_id: e.target.value })}>
              <option value="">Selecciona tu organización</option>
              {organizaciones.map((o) => <option key={o._id} value={o._id}>{o.nombre}</option>)}
            </select>
            {!cargandoOrgs && organizaciones.length === 0 && (
              <p className="hint-vacio">Aún no hay organizaciones disponibles. Pide a tu administrador que cree una primero.</p>
            )}
          </div>

          <button onClick={registrarse} disabled={cargando} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {cargando ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </div>

        <p className="auth-footer">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </div>
    </div>
  );
}
