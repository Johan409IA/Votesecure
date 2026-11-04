import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { misComprobantes, verificarComprobante } from '../services/voto.service';
import QRComprobante from '../components/QRComprobante';
import './ComprobantePage.css';

const formatFecha = (f) => f ? new Date(f).toLocaleString('es-PE') : '-';

export default function ComprobantePage() {
  const [searchParams] = useSearchParams();
  const [hash, setHash] = useState(searchParams.get('hash') || '');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [listaComprobantes, setListaComprobantes] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const verificar = async (hashParam) => {
    const valor = (hashParam ?? hash).trim();
    if (!valor) return;
    setVerificando(true);
    setError('');
    setResultado(null);
    try {
      const data = await verificarComprobante(valor);
      setResultado(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Comprobante no encontrado');
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    misComprobantes().then(setListaComprobantes).catch(console.error).finally(() => setCargandoLista(false));
    // Si llegamos desde un QR escaneado (?hash=...), verificamos automáticamente
    if (searchParams.get('hash')) verificar(searchParams.get('hash'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1>Verificar mi voto</h1>
      <div className="card">
        <p style={{ color: 'var(--gris-piedra)', marginBottom: '1.5rem' }}>
          Ingresa el hash de tu comprobante (o escanea tu código QR) para verificar que tu voto fue registrado.
          Este proceso <strong>no revela</strong> a quién votaste.
        </p>

        <div className="form-group">
          <label>Hash del comprobante</label>
          <input type="text" placeholder="Pega aquí tu hash de comprobante..." value={hash}
            onChange={(e) => setHash(e.target.value)} />
        </div>

        <button onClick={() => verificar()} disabled={!hash || verificando} className="btn btn-primary">
          {verificando ? 'Verificando...' : 'Verificar'}
        </button>

        {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

        {resultado && (
          <div className="resultado-verificacion">
            <div className="verificado-check">
              <svg viewBox="0 0 48 48" width="42" height="42"><circle cx="24" cy="24" r="22" fill="none" stroke="#1C7A4E" strokeWidth="2.5" /><path d="M14 25 L20 31 L34 16" fill="none" stroke="#1C7A4E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2>Voto verificado</h2>
            <div className="detalles">
              <div className="detalle-row"><span>Elección</span><strong>{resultado.eleccion}</strong></div>
              <div className="detalle-row"><span>Fecha de voto</span><strong>{formatFecha(resultado.fechaVoto)}</strong></div>
              <div className="detalle-row"><span>Hash</span><code>{resultado.hash.slice(0, 32)}...</code></div>
              <div className="detalle-row anonimo"><span>¿A quién votaste?</span><strong>Anónimo — información no almacenada</strong></div>
            </div>

            {/* ── Valor agregado: QR verificable ─────────────────────── */}
            <QRComprobante hash={resultado.hash} />
          </div>
        )}

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--borde)', paddingTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '.8rem' }}>Mis votaciones</h3>
          {cargandoLista ? (
            <p className="spinner" style={{ padding: '1rem' }}>Cargando...</p>
          ) : listaComprobantes.length === 0 ? (
            <p className="sin-comprobantes">Aún no has emitido ningún voto.</p>
          ) : (
            <div>
              {listaComprobantes.map((c, i) => (
                <div key={i} className="comprobante-item">
                  <div>
                    <div className="comprobante-eleccion">{c.eleccion}</div>
                    <div className="comprobante-fecha">{formatFecha(c.fechaVoto)}</div>
                  </div>
                  <button onClick={() => { setHash(c.hash); verificar(c.hash); }} className="btn btn-outline" style={{ fontSize: '.8rem', padding: '.3rem .7rem' }}>
                    Verificar
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="nota-recuperacion">
            Esta lista se obtiene directamente del servidor, así que la verás aunque cambies de dispositivo o borres el caché del navegador.
          </p>
        </div>
      </div>
    </div>
  );
}
