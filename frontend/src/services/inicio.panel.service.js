import api from './api';

// Resumen del inicio del panel. Si algo falla el inicio igual se muestra (sin cifras).
export async function cargarResumenPanel(esAdmin) {
  const { secciones } = await api.get('/secciones');
  const listas = await Promise.all(
    secciones.map((s) =>
      api
        .get(`/elecciones?seccionId=${s.id}`)
        .then((d) => d.elecciones.map((e) => ({ ...e, seccionNombre: s.courseName, seccionCodigo: s.code })))
        .catch(() => [])
    )
  );
  const elecciones = listas.flat();
  const resumen = {
    secciones: secciones.length,
    activas: elecciones.filter((e) => e.status === 'activa'),
    programadas: elecciones.filter((e) => e.status === 'programada').length,
    cuentas: null,
  };

  if (esAdmin) {
    const cuentas = await api.get('/usuarios').then((d) => d.usuarios).catch(() => null);
    if (cuentas) {
      resumen.cuentas = {
        total: cuentas.length,
        sinVerificar: cuentas.filter((c) => !c.correoVerificado).length,
        desactivadas: cuentas.filter((c) => !c.activa).length,
      };
    }
  }
  return resumen;
}
