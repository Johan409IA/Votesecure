import api from './api';

// Las claves JSON del backend van en español: correo, contrasena, nombre.

export const login = (correo, contrasena) =>
  api.post('/auth/login', { correo, contrasena });

export const registro = ({ nombre, correo, contrasena }) =>
  api.post('/auth/registro', { nombre, correo, contrasena });

export const logout = () => api.post('/auth/logout');

export const obtenerSesion = () => api.get('/auth/yo');

// La respuesta es siempre la misma exista o no la cuenta (anti-enumeración);
// la BD aplica un cooldown de 60 s por cuenta entre reenvíos.
export const reenviarVerificacion = (correo) =>
  api.post('/auth/reenviar-verificacion', { correo });

export const cambiarContrasena = (contrasenaActual, contrasenaNueva) =>
  api.post('/auth/cambiar-contrasena', { contrasenaActual, contrasenaNueva });
