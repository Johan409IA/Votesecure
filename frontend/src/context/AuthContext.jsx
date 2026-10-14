import { createContext, useState, useMemo, useCallback } from 'react';
import api from '../services/api';
import * as authService from '../services/auth.service';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [usuario, setUsuario] = useState(() => JSON.parse(localStorage.getItem('usuario') || 'null'));

  // Restaurar header al iniciar
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  const guardarSesion = (data) => {
    setToken(data.token);
    setUsuario(data.usuario);
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  };

  const login = useCallback(async (correo, password) => {
    const data = await authService.login(correo, password);
    guardarSesion(data);
    return data;
  }, []);

  const registro = useCallback(async (datos) => {
    const data = await authService.registro(datos);
    guardarSesion(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    delete api.defaults.headers.common['Authorization'];
  }, []);

  const value = useMemo(() => ({
    token,
    usuario,
    estaAutenticado: !!token,
    esAdmin: usuario?.rol === 'admin',
    login,
    registro,
    logout,
  }), [token, usuario, login, registro, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
