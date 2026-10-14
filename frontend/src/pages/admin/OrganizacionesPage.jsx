import { useState, useEffect, useCallback } from 'react';
import { listarOrganizaciones, crearOrganizacion, eliminarOrganizacion as apiEliminarOrg } from '../../services/eleccion.service';
import './AdminPages.css';

const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

export default function OrganizacionesPage() {
  const [organizaciones, setOrganizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [form, setForm] = useState({ nombre: '', descripcion: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setOrganizaciones(await listarOrganizaciones());
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    setError(''); setExito('');
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      await crearOrganizacion(form);
      setExito(`Organización "${form.nombre}" creada correctamente.`);
      setForm({ nombre: '', descripcion: '' });
      await cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'Error creando la organización');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (org) => {
    if (!confirm(`¿Eliminar la organización "${org.nombre}"? Solo se puede si no tiene elecciones asociadas.`)) return;
    try {
      await apiEliminarOrg(org._id);
      await cargar();
    } catch (e) {
      alert(e.response?.data?.error || 'Error eliminando la organización');
    }
  };

  return (
    <div>
      <h1>Organizaciones</h1>
      <p className="subtitulo">Crea y administra las organizaciones (cursos, aulas, instituciones) que podrán convocar elecciones.</p>

      <div className="card form-card">
        <h2>Nueva organización</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {exito && <div className="alert alert-success">{exito}</div>}
        <div className="grid-2col">
          <div className="form-group">
            <label>Nombre</label>
            <input type="text" placeholder="Ej: JS Avanzado" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input type="text" placeholder="Ej: Curso de JavaScript Avanzado" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
        <button onClick={crear} disabled={guardando} className="btn btn-primary">{guardando ? 'Creando...' : 'Crear organización'}</button>
      </div>

      <h2 className="titulo-lista">Organizaciones existentes ({organizaciones.length})</h2>

      {cargando ? (
        <div className="spinner">Cargando organizaciones...</div>
      ) : organizaciones.length === 0 ? (
        <div className="card vacio"><p>Aún no hay organizaciones creadas. Crea la primera arriba.</p></div>
      ) : (
        <div className="grid-orgs">
          {organizaciones.map((o) => (
            <div key={o._id} className="card org-card">
              <button onClick={() => eliminar(o)} className="btn-x" aria-label="Eliminar organización">×</button>
              <h3>{o.nombre}</h3>
              <p>{o.descripcion || 'Sin descripción'}</p>
              <div className="org-fecha">Creada el {formatFecha(o.fechaCreacion)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
