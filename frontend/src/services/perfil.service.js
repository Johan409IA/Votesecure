import api from './api';

// Cursos (secciones) en los que la persona está matriculada o asignada.
// Requiere correo verificado (si no, el backend responde 403).
export const misSecciones = async () => (await api.get('/secciones')).secciones;

// ── Foto de perfil ────────────────────────────────────────────────────────
// POST   /api/usuarios/yo/foto   { imagen: "data:image/jpeg;base64,..." }  (JPEG, hasta 90 000 caracteres)
// DELETE /api/usuarios/yo/foto
// Ambas exigen correo verificado. La foto vuelve en `fotoUrl` de GET /api/auth/yo.
export const subirFoto = (imagen) => api.post('/usuarios/yo/foto', { imagen });
export const quitarFoto = () => api.delete('/usuarios/yo/foto');
