import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const habiaSesion = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      if (habiaSesion && !window.location.pathname.includes('/login')) {
        sessionStorage.setItem('mensajeLogin', 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
