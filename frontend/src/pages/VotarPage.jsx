import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { obtenerEleccion } from '../services/eleccion.service';
import { emitirVoto } from '../services/voto.service';
import './VotarPage.css';

export default function VotarPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const [eleccion, setEleccion] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [yaVoto, setYaVoto] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const candidatoNombre = useMemo(
    () => candidatos.find((c) => c._id === candidatoSeleccionado)?.nombre || '',
    [candidatos, candidatoSeleccionado]
  );

  const perteneceAOrg = useMemo(() => {
    if (auth.esAdmin) return true;
    if (!eleccion) return true;
    const orgEleccion = eleccion.organizacion_id?._id || eleccion.organizacion_id;
    return orgEleccion === auth.usuario?.organizacion_id;
  }, [eleccion, auth]);

  useEffect(() => {
    obtenerEleccion(id)
      .then((data) => { setEleccion(data); setCandidatos(data.candidatos || []); })
      .catch(() => setError('Error cargando la elección'))
      .finally(() => setCargando(false));
  }, [id]);

  const confirmarVoto = () => {
    if (!candidatoSeleccionado) return;
    setMostrarConfirmacion(true);
  };

  const emitir = async () => {
    setEnviando(true);
    setMostrarConfirmacion(false);
    setError('');
    try {
      const data = await emitirVoto(id, candidatoSeleccionado);
      const hashPublico = data.comprobante.hashPublico;
      localStorage.setItem(`comprobante_${id}`, hashPublico);
      setYaVoto(true);
      setExito('Voto emitido correctamente. Redirigiendo a tu comprobante...');
      setTimeout(() => navigate(`/mi-comprobante?hash=${hashPublico}`), 2000);
    } catch (e) {
      if (e.response?.status === 409) setYaVoto(true);
      setError(e.response?.data?.error || 'Error al emitir el voto');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <div className="spinner">Cargando elección...</div>;
  if (!eleccion) return null;

  return (
    <div className="votar-container">
      <div className="card votar-header">
        <div className="header-top">
          <Link to={`/elecciones/${id}`} className="btn btn-outline" style={{ padding: '.4rem .8rem', fontSize: '.85rem' }}>← Volver</Link>
          <span className={`badge-estado badge-${eleccion.estado}`}>{eleccion.estado}</span>
        </div>
        <h1>{eleccion.titulo}</h1>
        <p>{eleccion.descripcion}</p>
        <div className="seguridad-info">
          <span>Cifrado AES-256 de extremo a extremo</span>
          <span>Anonimato garantizado — nadie sabrá a quién votaste</span>
        </div>
      </div>

      {yaVoto ? (
        <div className="card ya-voto">
          <div className="ya-voto-check">
            <svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" fill="none" stroke="#1C7A4E" strokeWidth="2.5" /><path d="M14 25 L20 31 L34 16" fill="none" stroke="#1C7A4E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2>Ya emitiste tu voto</h2>
          <p>{exito || 'Tu participación fue registrada de forma anónima y segura.'}</p>
          <Link to={`/elecciones/${id}/resultados`} className="btn btn-primary">Ver resultados en tiempo real</Link>
        </div>
      ) : !perteneceAOrg ? (
        <div className="card vacio"><p>Esta elección pertenece a otra organización. Solo puedes votar en elecciones de tu propia organización.</p></div>
      ) : eleccion.estado === 'activa' ? (
        <>
          {error && <div className="alert alert-error">{error}</div>}
          <h2 className="candidatos-titulo">Selecciona tu candidato</h2>
          <div className="grid-candidatos">
            {candidatos.map((c) => (
              <div key={c._id}
                className={`candidato-card card ${candidatoSeleccionado === c._id ? 'seleccionado' : ''}`}
                onClick={() => setCandidatoSeleccionado(c._id)}>
                <div className="candidato-foto">
                  {c.foto ? <img src={c.foto} alt={c.nombre} /> : <div className="foto-placeholder">{c.nombre[0]}</div>}
                </div>
                <div className="candidato-info"><h3>{c.nombre}</h3><p>{c.descripcion}</p></div>
                {candidatoSeleccionado === c._id && <div className="check-icon">✓</div>}
              </div>
            ))}
          </div>
          <div className="votar-actions">
            <button onClick={confirmarVoto} disabled={!candidatoSeleccionado || enviando} className="btn btn-primary btn-votar">
              {enviando ? 'Procesando voto...' : 'Emitir mi voto'}
            </button>
          </div>
        </>
      ) : (
        <div className="card vacio"><p>Esta elección no está activa.</p></div>
      )}

      {mostrarConfirmacion && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMostrarConfirmacion(false)}>
          <div className="modal card">
            <h2>Confirmar voto</h2>
            <p>Estás a punto de votar por <strong>{candidatoNombre}</strong>.</p>
            <div className="modal-info">
              <p>El voto se cifrará con AES-256 antes de guardarse</p>
              <p>No se registrará a quién votaste</p>
              <p>Esta acción es <strong>irreversible</strong></p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setMostrarConfirmacion(false)} className="btn btn-outline">Cancelar</button>
              <button onClick={emitir} disabled={enviando} className="btn btn-success">
                {enviando ? 'Procesando...' : 'Confirmar voto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
