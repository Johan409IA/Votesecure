import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { obtenerEleccion, cambiarEstadoEleccion, eliminarEleccion, eliminarCandidato as apiEliminarCandidato } from '../services/eleccion.service';
import './EleccionDetallePage.css';

const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
const mapaSiguientes = { borrador: ['activa'], activa: ['finalizada', 'cancelada'], finalizada: [], cancelada: [] };

export default function EleccionDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const esAdmin = auth.esAdmin;

  const [eleccion, setEleccion] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarConfirmEliminar, setMostrarConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const estadosSiguientes = useMemo(() => mapaSiguientes[eleccion?.estado] || [], [eleccion]);

  useEffect(() => {
    obtenerEleccion(id)
      .then((data) => { setEleccion(data); setCandidatos(data.candidatos || []); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [id]);

  const cambiarEstado = async (nuevoEstado) => {
    try {
      const data = await cambiarEstadoEleccion(id, nuevoEstado);
      setEleccion((prev) => ({ ...prev, estado: data.estado }));
    } catch (e) {
      alert(e.response?.data?.error || 'Error cambiando estado');
    }
  };

  const confirmarEliminarEleccion = async () => {
    setEliminando(true);
    try {
      await eliminarEleccion(id);
      navigate('/elecciones');
    } catch (e) {
      alert(e.response?.data?.error || 'Error eliminando la elección');
    } finally {
      setEliminando(false);
      setMostrarConfirmEliminar(false);
    }
  };

  const eliminarCandidato = async (candidato) => {
    if (!confirm(`¿Eliminar al candidato "${candidato.nombre}"?`)) return;
    try {
      await apiEliminarCandidato(candidato._id);
      setCandidatos((prev) => prev.filter((c) => c._id !== candidato._id));
    } catch (e) {
      alert(e.response?.data?.error || 'Error eliminando el candidato');
    }
  };

  if (cargando) return <div className="spinner">Cargando...</div>;
  if (!eleccion) return null;

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', marginBottom: '.5rem' }}>
              <span className={`badge-estado badge-${eleccion.estado}`}>{eleccion.estado}</span>
              <span style={{ color: '#64748b', fontSize: '.85rem' }}>{eleccion.organizacion_id?.nombre}</span>
            </div>
            <h1>{eleccion.titulo}</h1>
            <p style={{ color: '#64748b', marginTop: '.5rem' }}>{eleccion.descripcion}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.82rem', color: '#94a3b8' }}>Período de votación</div>
            <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{formatFecha(eleccion.fechaInicio)} → {formatFecha(eleccion.fechaFin)}</div>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-box"><span className="sn">{eleccion.totalVotos ?? 0}</span><span className="sl">Votos</span></div>
          <div className="stat-box"><span className="sn">{eleccion.totalParticipantes ?? 0}</span><span className="sl">Participantes</span></div>
          <div className="stat-box"><span className="sn">{candidatos.length}</span><span className="sl">Candidatos</span></div>
        </div>

        <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {eleccion.estado === 'activa' && <Link to={`/elecciones/${id}/votar`} className="btn btn-primary">Votar ahora</Link>}
          <Link to={`/elecciones/${id}/resultados`} className="btn btn-outline">Ver resultados</Link>
          {esAdmin && (
            <>
              {estadosSiguientes.map((e) => (
                <button key={e} onClick={() => cambiarEstado(e)} className="btn btn-outline" style={{ fontSize: '.85rem' }}>{e}</button>
              ))}
              <button onClick={() => setMostrarConfirmEliminar(true)} className="btn btn-danger" style={{ fontSize: '.85rem', marginLeft: 'auto' }}>
                Eliminar elección
              </button>
            </>
          )}
        </div>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Candidatos ({candidatos.length})</h2>
      <div className="grid-candidatos">
        {candidatos.map((c) => (
          <div key={c._id} className="candidato-card card">
            {esAdmin && <button onClick={() => eliminarCandidato(c)} className="btn-x" aria-label="Eliminar candidato">×</button>}
            <div className="foto-candidato">
              {c.foto ? <img src={c.foto} alt={c.nombre} /> : <div className="foto-placeholder">{c.nombre[0]}</div>}
            </div>
            <h3>{c.nombre}</h3>
            <p>{c.descripcion}</p>
          </div>
        ))}
      </div>

      {mostrarConfirmEliminar && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMostrarConfirmEliminar(false)}>
          <div className="modal card">
            <h2>Eliminar elección</h2>
            <p>Vas a eliminar <strong>"{eleccion.titulo}"</strong> junto con todos sus candidatos, votos y resultados asociados.</p>
            <div className="modal-info"><p>Esta acción <strong>no se puede deshacer</strong>.</p></div>
            <div className="modal-actions">
              <button onClick={() => setMostrarConfirmEliminar(false)} className="btn btn-outline">Cancelar</button>
              <button onClick={confirmarEliminarEleccion} disabled={eliminando} className="btn btn-danger">
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
