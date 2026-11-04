import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listarOrganizaciones, crearEleccion, crearCandidato } from '../../services/eleccion.service';
import './AdminPages.css';

const tiposEleccionPorOrg = {
  'JS Avanzado': ['Elección de Delegado de Aula', 'Realizar Proyecto Final de Curso JS Avanzado'],
  'Marco de Desarrollo Web': ['Elección de Delegado de Aula'],
  'Diseño de Productos y Servicios': ['Elección de Delegado de Aula'],
};
const tiposEleccionDefault = ['Elección de Delegado de Aula'];

export default function CrearEleccionPage() {
  const navigate = useNavigate();
  const [organizaciones, setOrganizaciones] = useState([]);
  const [cargandoOrgs, setCargandoOrgs] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoCandidatos, setGuardandoCandidatos] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [eleccionCreada, setEleccionCreada] = useState(null);
  const [candidatos, setCandidatos] = useState([{ nombre: '', descripcion: '' }, { nombre: '', descripcion: '' }]);
  const [tituloSeleccionado, setTituloSeleccionado] = useState('');
  const [form, setForm] = useState({ organizacion_id: '', titulo: '', descripcion: '', fechaInicio: '', fechaFin: '' });

  const organizacionSeleccionada = useMemo(
    () => organizaciones.find((o) => o._id === form.organizacion_id),
    [organizaciones, form.organizacion_id]
  );
  const tiposEleccion = useMemo(
    () => tiposEleccionPorOrg[organizacionSeleccionada?.nombre] || tiposEleccionDefault,
    [organizacionSeleccionada]
  );

  useEffect(() => {
    listarOrganizaciones().then(setOrganizaciones).finally(() => setCargandoOrgs(false));
  }, []);

  const onCambioOrg = (id) => {
    setForm({ ...form, organizacion_id: id });
    setTituloSeleccionado('');
  };

  const onCambioTitulo = (valor) => {
    setTituloSeleccionado(valor);
    setForm((f) => ({ ...f, titulo: valor === '__otro__' ? '' : valor }));
  };

  const guardarEleccion = async () => {
    setError('');
    if (!form.titulo || !form.organizacion_id) { setError('Título y organización son requeridos'); return; }
    if (!form.fechaInicio || !form.fechaFin) { setError('Debes indicar fecha de inicio y fecha de fin'); return; }
    if (new Date(form.fechaFin) <= new Date(form.fechaInicio)) { setError('La fecha de fin debe ser posterior a la fecha de inicio'); return; }

    setGuardando(true);
    try {
      const data = await crearEleccion(form);
      setEleccionCreada(data);
      setExito(`Elección "${data.titulo}" creada. Ahora agrega los candidatos.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error creando la elección');
    } finally {
      setGuardando(false);
    }
  };

  const guardarCandidatos = async () => {
    setError('');
    const validos = candidatos.map((c) => ({ nombre: c.nombre.trim(), descripcion: c.descripcion.trim() })).filter((c) => c.nombre);
    if (validos.length < 2) { setError('Agrega al menos 2 candidatos con nombre'); return; }
    const nombresMin = validos.map((c) => c.nombre.toLowerCase());
    if (nombresMin.some((n, i) => nombresMin.indexOf(n) !== i)) {
      setError('Hay candidatos con el mismo nombre. Usa nombres distintos para diferenciarlos.');
      return;
    }
    setGuardandoCandidatos(true);
    try {
      await Promise.all(validos.map((c) => crearCandidato({ ...c, eleccion_id: eleccionCreada._id })));
      navigate(`/elecciones/${eleccionCreada._id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando candidatos');
    } finally {
      setGuardandoCandidatos(false);
    }
  };

  return (
    <div>
      <h1>Crear nueva elección</h1>
      <div className="card" style={{ maxWidth: 600 }}>
        {error && <div className="alert alert-error">{error}</div>}
        {exito && <div className="alert alert-success">{exito}</div>}
        {!cargandoOrgs && organizaciones.length === 0 && (
          <div className="alert alert-info">
            Aún no tienes ninguna organización creada. <Link to="/admin/organizaciones" style={{ fontWeight: 700 }}>Crea una aquí primero</Link>.
          </div>
        )}

        <div className="form-group">
          <label>Organización</label>
          <select value={form.organizacion_id} onChange={(e) => onCambioOrg(e.target.value)}>
            <option value="">Selecciona una organización</option>
            {organizaciones.map((o) => <option key={o._id} value={o._id}>{o.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Tipo de elección</label>
          <select value={tituloSeleccionado} onChange={(e) => onCambioTitulo(e.target.value)}>
            <option value="">Selecciona el tipo de elección</option>
            {tiposEleccion.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__otro__">Otro (escribir manualmente)</option>
          </select>
        </div>
        {tituloSeleccionado === '__otro__' && (
          <div className="form-group">
            <label>Escribe el título de la elección</label>
            <input type="text" placeholder="Ej: Elección de presidente 2024" value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
        )}
        <div className="form-group">
          <label>Descripción</label>
          <textarea rows={3} placeholder="Descripción de la elección..." value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="grid-2col">
          <div className="form-group">
            <label>Fecha inicio</label>
            <input type="datetime-local" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Fecha fin</label>
            <input type="datetime-local" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </div>
        </div>

        <button onClick={guardarEleccion} disabled={guardando} className="btn btn-primary">
          {guardando ? 'Creando...' : 'Crear elección'}
        </button>

        {eleccionCreada && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--borde)', paddingTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Agregar candidatos</h2>
            {candidatos.map((c, i) => (
              <div key={i} className="grid-2col" style={{ marginBottom: '.8rem' }}>
                <input type="text" placeholder="Nombre del candidato" className="form-input" value={c.nombre}
                  onChange={(e) => setCandidatos((prev) => prev.map((x, idx) => idx === i ? { ...x, nombre: e.target.value } : x))} />
                <input type="text" placeholder="Descripción breve" className="form-input" value={c.descripcion}
                  onChange={(e) => setCandidatos((prev) => prev.map((x, idx) => idx === i ? { ...x, descripcion: e.target.value } : x))} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '.8rem', marginTop: '.5rem' }}>
              <button onClick={() => setCandidatos((prev) => [...prev, { nombre: '', descripcion: '' }])} className="btn btn-outline">+ Agregar candidato</button>
              <button onClick={guardarCandidatos} disabled={guardandoCandidatos} className="btn btn-success">
                {guardandoCandidatos ? 'Guardando...' : 'Guardar candidatos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
