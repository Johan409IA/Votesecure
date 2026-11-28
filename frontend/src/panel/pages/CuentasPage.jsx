import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { cambiarEstadoCuenta, listarCuentas } from '../../services/cuentas.panel.service';
import ModalConfirmar from '../components/ModalConfirmar';
import { ETIQUETA_ROL } from '../formato';
import '../panel.css';

const TIPOS = [
  { clave: '', etiqueta: 'Todas' },
  { clave: 'estudiante', etiqueta: 'Estudiantes' },
  { clave: 'docente', etiqueta: 'Docentes' },
  { clave: 'administrador', etiqueta: 'Administradores' },
];
const TONO_ROL = { estudiante: 'azul', docente: 'verde', administrador: 'rojo' };
const TOPE_BACKEND = 500;

// Ruta /panel/cuentas — solo administrador.
export default function CuentasPage() {
  const { usuario } = useAuth();
  const [todas, setTodas] = useState(null); // sin filtros: para el resumen y los contadores
  const [lista, setLista] = useState(null); // con el buscador y el filtro aplicados
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [aConfirmar, setAConfirmar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const todasRef = useRef(null);

  useEffect(() => {
    todasRef.current = todas;
  }, [todas]);

  // Carga inicial: todas las cuentas.
  useEffect(() => {
    let activo = true;
    listarCuentas()
      .then((datos) => {
        if (!activo) return;
        setTodas(datos);
        setLista(datos);
      })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  const listo = todas !== null;

  // Buscador y filtro por rol: se consultan al backend (espera 300 ms al escribir).
  useEffect(() => {
    if (!listo) return undefined;
    if (!busqueda.trim() && !tipo) {
      setLista(todasRef.current);
      return undefined;
    }
    let activo = true;
    const espera = setTimeout(() => {
      setBuscando(true);
      listarCuentas({ busqueda: busqueda.trim(), tipo })
        .then((datos) => { if (activo) setLista(datos); })
        .catch((err) => { if (activo) setAviso({ tipo: 'error', texto: err.message }); })
        .finally(() => { if (activo) setBuscando(false); });
    }, busqueda.trim() ? 300 : 0);
    return () => { activo = false; clearTimeout(espera); };
  }, [busqueda, tipo, listo]);

  const conteo = useMemo(() => {
    const base = todas ?? [];
    return {
      total: base.length,
      estudiante: base.filter((c) => c.tipo === 'estudiante').length,
      docente: base.filter((c) => c.tipo === 'docente').length,
      administrador: base.filter((c) => c.tipo === 'administrador').length,
      sinVerificar: base.filter((c) => !c.correoVerificado).length,
      desactivadas: base.filter((c) => !c.activa).length,
    };
  }, [todas]);

  const aplicarEstado = useCallback((cuenta, activa) => {
    const cambiar = (l) => (l ? l.map((c) => (c.id === cuenta.id ? { ...c, activa } : c)) : l);
    setTodas(cambiar);
    setLista(cambiar);
  }, []);

  const cambiar = async (cuenta, activa) => {
    setEnviando(true);
    setErrorModal('');
    setAviso(null);
    try {
      await cambiarEstadoCuenta(cuenta.id, activa);
      aplicarEstado(cuenta, activa);
      setAConfirmar(null);
      setAviso({
        tipo: 'ok',
        texto: activa
          ? `La cuenta de ${cuenta.nombre} fue activada.`
          : `La cuenta de ${cuenta.nombre} fue desactivada y su sesión se cerró.`,
      });
    } catch (err) {
      if (activa) setAviso({ tipo: 'error', texto: err.message });
      else setErrorModal(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Desactivar pide confirmación (cierra la sesión al instante); activar no.
  const pedirCambio = (cuenta) => {
    if (cuenta.activa) {
      setErrorModal('');
      setAConfirmar(cuenta);
    } else {
      cambiar(cuenta, true);
    }
  };

  let contenido;
  if (error) {
    contenido = <div className="panel-aviso panel-aviso-error" role="alert">{error}</div>;
  } else if (lista === null) {
    contenido = <p className="panel-cargando">Cargando cuentas…</p>;
  } else if (lista.length === 0) {
    contenido = (
      <div className="panel-vacio">
        <Search size={36} />
        <p>{buscando ? 'Buscando…' : 'No hay cuentas que coincidan con la búsqueda.'}</p>
      </div>
    );
  } else {
    contenido = (
      <div className="panel-tabla-caja">
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Rol</th>
              <th>Correo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((cuenta) => {
              const esYo = cuenta.id === usuario.id;
              return (
                <tr key={cuenta.id} className={cuenta.activa ? '' : 'fila-inactiva'}>
                  <td>
                    <div className="panel-persona">
                      <Avatar nombre={cuenta.nombre} tamano={42} />
                      <div>
                        <strong>{cuenta.nombre}{esYo && <span className="panel-yo"> (tú)</span>}</strong>
                        <span>{cuenta.correo}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`panel-pildora tono-${TONO_ROL[cuenta.tipo] ?? 'gris'}`}>
                      {ETIQUETA_ROL[cuenta.tipo] ?? cuenta.tipo}
                    </span>
                  </td>
                  <td>
                    <span className={`panel-pildora ${cuenta.correoVerificado ? 'tono-verde' : 'tono-amarillo'}`}>
                      {cuenta.correoVerificado ? 'Verificado' : 'Sin verificar'}
                    </span>
                  </td>
                  <td>
                    <span className={`panel-pildora ${cuenta.activa ? 'tono-verde' : 'tono-gris'}`}>
                      {cuenta.activa ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {cuenta.activa ? 'Activa' : 'Desactivada'}
                    </span>
                  </td>
                  <td className="panel-derecha">
                    <button
                      type="button"
                      className={`panel-boton panel-boton-chico ${cuenta.activa ? 'panel-boton-peligro' : 'panel-boton-gris'}`}
                      onClick={() => pedirCambio(cuenta)}
                      disabled={esYo || enviando}
                      title={esYo ? 'No puedes desactivar tu propia cuenta' : undefined}
                    >
                      {cuenta.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="panel-pagina">
      <div className="panel-cabecera">
        <h1>Cuentas</h1>
        <p>Busca cuentas y activa o desactiva el acceso al sistema.</p>
      </div>

      {todas && (
        <div className="panel-resumen">
          <div className="panel-dato"><strong>{conteo.total}</strong><span>Cuentas en total</span></div>
          <div className="panel-dato"><strong>{conteo.estudiante}</strong><span>Estudiantes</span></div>
          <div className="panel-dato"><strong>{conteo.docente}</strong><span>Docentes</span></div>
          <div className="panel-dato"><strong>{conteo.administrador}</strong><span>Administradores</span></div>
          <div className="panel-dato"><strong>{conteo.sinVerificar}</strong><span>Sin verificar</span></div>
          <div className="panel-dato"><strong>{conteo.desactivadas}</strong><span>Desactivadas</span></div>
        </div>
      )}

      {aviso && (
        <div className={`panel-aviso panel-aviso-${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
          {aviso.texto}
        </div>
      )}

      {todas && (
        <div className="panel-barra">
          <div className="panel-busqueda">
            <Search size={19} />
            <input
              type="search"
              placeholder="Buscar por nombre o correo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar cuentas"
            />
          </div>
          <div className="panel-filtros" role="tablist" aria-label="Filtrar por rol">
            {TIPOS.map((t) => (
              <button
                key={t.clave || 'todas'}
                type="button"
                role="tab"
                aria-selected={tipo === t.clave}
                className={`panel-filtro${tipo === t.clave ? ' activo' : ''}`}
                onClick={() => setTipo(t.clave)}
              >
                {t.etiqueta}
                <span className="cuenta">{t.clave ? conteo[t.clave] : conteo.total}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {contenido}

      {todas && todas.length >= TOPE_BACKEND && (
        <div className="panel-aviso panel-aviso-info" style={{ marginTop: '1rem' }}>
          <Info size={16} style={{ verticalAlign: '-3px' }} /> El listado muestra como máximo {TOPE_BACKEND} cuentas.
          Usa el buscador para encontrar a una persona en particular.
        </div>
      )}

      {aConfirmar && (
        <ModalConfirmar
          titulo="Desactivar cuenta"
          texto={`¿Desactivar la cuenta de ${aConfirmar.nombre}? Su sesión se cerrará de inmediato y no podrá iniciar sesión hasta que la actives de nuevo.`}
          textoConfirmar="Desactivar cuenta"
          peligro
          enviando={enviando}
          error={errorModal}
          alConfirmar={() => cambiar(aConfirmar, false)}
          alCancelar={() => setAConfirmar(null)}
        />
      )}
    </div>
  );
}
