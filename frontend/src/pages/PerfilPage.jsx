import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, BookOpen, Camera, Eye, EyeOff, IdCard, Mail, ShieldAlert, Trash2, User, UserCog,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { misSecciones, quitarFoto, subirFoto } from '../services/perfil.service';
import { cambiarContrasena } from '../services/auth.service';
import { prepararFoto } from '../utils/foto';
import './PerfilPage.css';

const ETIQUETA_ROL = { estudiante: 'Estudiante', docente: 'Docente', administrador: 'Administrador' };
const MIN_CLAVE = 15;
const MAX_CLAVE = 128;

// u23225643@utp.edu.pe -> U23225643 (el código institucional va en el correo).
const codigoInstitucional = (correo) => correo.split('@')[0].toUpperCase();

export default function PerfilPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { usuario } = auth;
  const verificado = usuario.correoVerificado === true;

  // ── Cursos ──
  const [cursos, setCursos] = useState(null); // null = cargando
  useEffect(() => {
    if (!verificado) {
      setCursos([]);
      return undefined;
    }
    let activo = true;
    misSecciones()
      .then((lista) => { if (activo) setCursos(lista); })
      .catch(() => { if (activo) setCursos([]); });
    return () => { activo = false; };
  }, [verificado]);

  // ── Foto ──
  const entradaArchivo = useRef(null);
  const [previa, setPrevia] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const [okFoto, setOkFoto] = useState('');

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setErrorFoto('');
    setOkFoto('');
    setProcesando(true);
    try {
      setPrevia(await prepararFoto(archivo));
    } catch (err) {
      setPrevia('');
      setErrorFoto(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const guardarFoto = async () => {
    setGuardando(true);
    setErrorFoto('');
    try {
      await subirFoto(previa);
      await auth.refrescarSesion();
      setPrevia('');
      setOkFoto('Tu foto de perfil se actualizó.');
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarFoto = async () => {
    setGuardando(true);
    setErrorFoto('');
    setOkFoto('');
    try {
      await quitarFoto();
      await auth.refrescarSesion();
      setOkFoto('Quitaste tu foto de perfil.');
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Contraseña ──
  const [clave, setClave] = useState({ actual: '', nueva: '', repetida: '' });
  const [verClave, setVerClave] = useState(false);
  const [errorClave, setErrorClave] = useState('');
  const [cambiando, setCambiando] = useState(false);

  const cambiarClave = async (e) => {
    e.preventDefault();
    if (clave.nueva.length < MIN_CLAVE || clave.nueva.length > MAX_CLAVE) {
      setErrorClave(`La nueva contraseña debe tener entre ${MIN_CLAVE} y ${MAX_CLAVE} caracteres.`);
      return;
    }
    if (clave.nueva !== clave.repetida) {
      setErrorClave('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (clave.nueva === clave.actual) {
      setErrorClave('La nueva contraseña debe ser distinta de la actual.');
      return;
    }
    setErrorClave('');
    setCambiando(true);
    try {
      await cambiarContrasena(clave.actual, clave.nueva);
      // El backend cierra la sesión al cambiar la contraseña: hay que entrar de nuevo.
      sessionStorage.setItem('mensajeLogin', 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
      await auth.logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setErrorClave(err.message);
      setCambiando(false);
    }
  };

  const esEstudiante = usuario.tipo === 'estudiante';
  const fotoMostrada = previa || usuario.fotoUrl || '';

  return (
    <div className="pf-pagina">
      <header className="pf-titulo">
        <h1>Mi perfil</h1>
        <p>Tu información personal y la seguridad de tu cuenta.</p>
      </header>

      <div className="pf-rejilla">
        {/* ── Columna izquierda: foto ── */}
        <aside className="pf-tarjeta pf-foto">
          <Avatar nombre={usuario.nombre} fotoUrl={fotoMostrada} tamano={150} />
          <h2>{usuario.nombre}</h2>
          <div className="pf-pildoras">
            <span className="pf-pildora tono-azul">{ETIQUETA_ROL[usuario.tipo] ?? usuario.tipo}</span>
            <span className={`pf-pildora ${verificado ? 'tono-verde' : 'tono-rojo'}`}>
              {verificado ? 'Correo verificado' : 'Correo sin verificar'}
            </span>
          </div>

          <input
            ref={entradaArchivo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={elegirArchivo}
            hidden
          />

          {previa ? (
            <div className="pf-foto-acciones">
              <button type="button" className="pf-boton pf-boton-rojo" onClick={guardarFoto} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar foto'}
              </button>
              <button type="button" className="pf-boton pf-boton-claro" onClick={() => setPrevia('')} disabled={guardando}>
                Cancelar
              </button>
            </div>
          ) : (
            <div className="pf-foto-acciones">
              <button
                type="button"
                className="pf-boton pf-boton-claro"
                onClick={() => entradaArchivo.current?.click()}
                disabled={procesando || guardando || !verificado}
              >
                <Camera size={18} /> {procesando ? 'Preparando…' : usuario.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {usuario.fotoUrl && (
                <button type="button" className="pf-boton pf-boton-texto" onClick={eliminarFoto} disabled={guardando}>
                  <Trash2 size={16} /> Quitar foto
                </button>
              )}
            </div>
          )}

          {errorFoto && <p className="pf-mensaje pf-mensaje-error" role="alert">{errorFoto}</p>}
          {okFoto && <p className="pf-mensaje pf-mensaje-ok" role="status">{okFoto}</p>}
          <small className="pf-ayuda">
            {verificado
              ? 'JPG, PNG o WebP · máximo 5 MB. Se recorta en cuadrado.'
              : 'Verifica tu correo para poder subir una foto.'}
          </small>
        </aside>

        {/* ── Columna derecha ── */}
        <div className="pf-columna">
          <section className="pf-tarjeta">
            <h3><User size={20} /> Datos personales</h3>
            <dl className="pf-datos">
              <div>
                <dt><User size={16} /> Nombre completo</dt>
                <dd>{usuario.nombre}</dd>
              </div>
              <div>
                <dt><IdCard size={16} /> Código {esEstudiante ? 'de estudiante' : usuario.tipo === 'docente' ? 'de docente' : 'de usuario'}</dt>
                <dd>{usuario.tipo === 'administrador' ? `N.º ${usuario.id}` : codigoInstitucional(usuario.correo)}</dd>
              </div>
              <div>
                <dt><Mail size={16} /> Correo institucional</dt>
                <dd>{usuario.correo}</dd>
              </div>
              <div>
                <dt><UserCog size={16} /> Rol en VoteSecure</dt>
                <dd>{ETIQUETA_ROL[usuario.tipo] ?? usuario.tipo}</dd>
              </div>
              <div>
                <dt><BadgeCheck size={16} /> Estado del correo</dt>
                <dd>{verificado ? 'Verificado' : 'Pendiente de verificación'}</dd>
              </div>
            </dl>
            <p className="pf-nota">Estos datos vienen de tu cuenta institucional y no se editan desde aquí.</p>
          </section>

          <section className="pf-tarjeta">
            <h3><BookOpen size={20} /> Mis cursos</h3>
            {cursos === null && <p className="pf-vacio">Cargando…</p>}
            {cursos !== null && !verificado && (
              <p className="pf-vacio">Verifica tu correo para ver tus cursos.</p>
            )}
            {cursos !== null && verificado && cursos.length === 0 && (
              <p className="pf-vacio">Aún no tienes cursos. Únete con el código que te dé tu docente.</p>
            )}
            {cursos !== null && cursos.length > 0 && (
              <ul className="pf-cursos">
                {cursos.map((c) => (
                  <li key={c.id}>
                    <Link to={`/cursos/${c.id}`}>
                      <span><b>{c.courseName}</b><small>{c.courseCode} · {c.academicPeriod}</small></span>
                      <span className="pf-codigo">{c.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pf-tarjeta">
            <h3><ShieldAlert size={20} /> Seguridad</h3>
            <form onSubmit={cambiarClave} noValidate className="pf-form">
              <label>
                Contraseña actual
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={clave.actual}
                  onChange={(e) => setClave({ ...clave, actual: e.target.value })}
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={clave.nueva}
                  onChange={(e) => setClave({ ...clave, nueva: e.target.value })}
                />
                <small>Entre {MIN_CLAVE} y {MAX_CLAVE} caracteres.</small>
              </label>
              <label>
                Repite la nueva contraseña
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={clave.repetida}
                  onChange={(e) => setClave({ ...clave, repetida: e.target.value })}
                />
              </label>

              <button type="button" className="pf-boton pf-boton-texto" onClick={() => setVerClave(!verClave)}>
                {verClave ? <EyeOff size={16} /> : <Eye size={16} />} {verClave ? 'Ocultar' : 'Mostrar'} contraseñas
              </button>

              {errorClave && <p className="pf-mensaje pf-mensaje-error" role="alert">{errorClave}</p>}
              <p className="pf-nota">Al cambiarla se cerrará tu sesión y tendrás que entrar de nuevo.</p>

              <div className="pf-form-acciones">
                <button
                  type="submit"
                  className="pf-boton pf-boton-rojo"
                  disabled={cambiando || !clave.actual || !clave.nueva || !clave.repetida}
                >
                  {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
