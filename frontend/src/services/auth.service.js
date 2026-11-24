import api from './api';

// Las claves JSON del backend van en español: correo, contrasena, nombre.

export const login = (correo, contrasena) =>
  api.post('/auth/login', { correo, contrasena });

export const registro = ({ nombre, correo, contrasena }) =>
  api.post('/auth/registro', { nombre, correo, contrasena });

export const logout = () => api.post('/auth/logout');

export const obtenerSesion = () => api.get('/auth/yo');

export const cambiarContrasena = (contrasenaActual, contrasenaNueva) =>
  api.post('/auth/cambiar-contrasena', { contrasenaActual, contrasenaNueva });
