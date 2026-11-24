import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTO_SESION_EXPIRADA } from '../services/api';
import * as authService from '../services/auth.service';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const usuarioRef = useRef(null);

  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  // Al abrir la app se pregunta al backend si la cookie de sesión sigue vigente.
  useEffect(() => {
    let activo = true;
    authService
      .obtenerSesion()
      .then((datos) => { if (activo) setUsuario(datos.usuario); })
      .catch(() => { if (activo) setUsuario(null); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  // Si cualquier petición recibe 401, la sesión caducó o fue revocada.
  useEffect(() => {
    const alExpirar = () => {
      if (usuarioRef.current) {
        sessionStorage.setItem('mensajeLogin', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      }
      setUsuario(null);
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const login = useCallback(async (correo, contrasena) => {
    const datos = await authService.login(correo, contrasena);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  const registro = useCallback((datos) => authService.registro(datos), []);

  // Vuelve a pedir el perfil al backend (p. ej. después de verificar el correo).
  const refrescarSesion = useCallback(async () => {
    const datos = await authService.obtenerSesion();
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // aunque falle la llamada, se limpia la sesión local
    } finally {
      setUsuario(null);
    }
  }, []);

  const value = useMemo(() => ({
    usuario,
    cargando,
    estaAutenticado: usuario !== null,
    esEstudiante: usuario?.tipo === 'estudiante',
    esDocente: usuario?.tipo === 'docente',
    esAdmin: usuario?.tipo === 'administrador',
    login,
    registro,
    refrescarSesion,
    logout,
  }), [usuario, cargando, login, registro, refrescarSesion, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
