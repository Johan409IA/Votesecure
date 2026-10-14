import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { obtenerResultados } from '../services/eleccion.service';
import { useResultadosSocket } from '../hooks/useResultadosSocket';
import './ResultadosPage.css';

const colores = ['#C8102E', '#0A1F33', '#C9A646', '#1C7A4E', '#5A6472', '#7C3AED'];
const horaActual = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function ResultadosPage() {
  const { id } = useParams();
  const [eleccion, setEleccion] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('--:--');

  const resultadosOrdenados = useMemo(
    () => [...resultados].sort((a, b) => b.cantidadVotos - a.cantidadVotos),
    [resultados]
  );
  const ganador = resultadosOrdenados[0] || null;

  useEffect(() => {
    obtenerResultados(id)
      .then((data) => { setEleccion(data.eleccion); setResultados(data.resultados); setUltimaActualizacion(horaActual()); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [id]);

  const onResultados = useCallback((datos) => {
    setEleccion((prev) => ({
      ...prev,
      totalVotos: datos.totalVotos,
      totalParticipantes: datos.totalParticipantes,
      porcentajeParticipacion: datos.porcentajeParticipacion,
    }));
    setResultados(datos.candidatos);
    setUltimaActualizacion(horaActual());
  }, []);

  const onCambioEstado = useCallback((datos) => {
    setEleccion((prev) => (prev ? { ...prev, estado: datos.estado } : prev));
  }, []);

  const { conectado } = useResultadosSocket(id, onResultados, onCambioEstado);

  if (cargando) return <div className="spinner">Cargando resultados...</div>;

  return (
    <div className="resultados-container">
      <div className="card resultado-header">
        <div className="header-top">
          <Link to={`/elecciones/${id}`} className="btn btn-outline" style={{ fontSize: '.85rem' }}>← Volver</Link>
          <div className={`ws-status ${conectado ? 'conectado' : 'desconectado'}`}>
            <span className="ws-dot"></span>{conectado ? 'En vivo' : 'Desconectado'}
          </div>
        </div>
        <h1>{eleccion?.titulo}</h1>
        <div className="stats-globales">
          <div className="stat-global"><span className="stat-num">{eleccion?.totalVotos ?? 0}</span><span className="stat-lbl">Total votos</span></div>
          <div className="stat-global"><span className="stat-num">{eleccion?.totalParticipantes ?? 0}</span><span className="stat-lbl">Participantes</span></div>
          <div className="stat-global"><span className="stat-num">{(eleccion?.porcentajeParticipacion ?? 0).toFixed(1)}%</span><span className="stat-lbl">Participación</span></div>
          <div className="stat-global"><span className="stat-num">{ultimaActualizacion}</span><span className="stat-lbl">Actualizado</span></div>
        </div>
      </div>

      <div className="card">
        <h2>Resultados por candidato</h2>
        {resultados.length === 0 ? (
          <div className="vacio">Sin votos registrados aún.</div>
        ) : (
          <div className="panel-candidatos">
            {resultadosOrdenados.map((r, i) => {
              const pct = r.porcentaje || 0;
              const radio = 54;
              const circunferencia = 2 * Math.PI * radio;
              const dash = (pct / 100) * circunferencia;
              const color = colores[i % colores.length];
              return (
                <div key={r.candidato_id} className="panel-candidato">
                  <div className="donut-wrapper">
                    <svg viewBox="0 0 120 120" width="160" height="160">
                      <circle cx="60" cy="60" r={radio} fill="none" stroke="#E8E6E0" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r={radio}
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeDasharray={`${dash} ${circunferencia - dash}`}
                        strokeDashoffset={circunferencia / 4}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
                      />
                      <circle cx="60" cy="60" r="36" fill={color} />
                      <text x="60" y="67" textAnchor="middle" fill="white"
                        fontSize="22" fontWeight="700" fontFamily="Georgia, serif">
                        {r.nombre[0].toUpperCase()}
                      </text>
                    </svg>
                    <div className="donut-pct" style={{ color }}>
                      {pct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="panel-candidato-info">
                    <div className="panel-candidato-pos" style={{ color }}>{i + 1}°</div>
                    <div className="panel-candidato-nombre">{r.nombre}</div>
                    <div className="panel-candidato-votos">{r.cantidadVotos.toLocaleString('es-PE')} votos</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ganador && eleccion?.totalVotos > 0 && (
        <div className="card ganador">
          <div className="ganador-icono">
            <svg viewBox="0 0 48 48" width="40" height="40"><path d="M8 18 L14 30 L24 16 L34 30 L40 18 L36 34 L12 34 Z" fill="#C9A646" stroke="#9A7A2E" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="8" cy="16" r="3" fill="#C9A646" /><circle cx="24" cy="13" r="3" fill="#C9A646" /><circle cx="40" cy="16" r="3" fill="#C9A646" /></svg>
          </div>
          <h2>{eleccion?.estado === 'finalizada' ? 'Ganador' : 'Líder provisional'}</h2>
          <div className="ganador-nombre">{ganador.nombre}</div>
          <div className="ganador-stats">
            <span>{ganador.cantidadVotos} votos</span>
            <span>{ganador.porcentaje.toFixed(1)}% del total</span>
          </div>
        </div>
      )}
    </div>
  );
}
