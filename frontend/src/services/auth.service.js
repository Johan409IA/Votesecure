import api from './api';

export const login = async (correo, password) => {
  const { data } = await api.post('/auth/login', { correo, password });
  return data;
};

export const registro = async (datos) => {
  const { data } = await api.post('/auth/registro', datos);
  return data;
};
