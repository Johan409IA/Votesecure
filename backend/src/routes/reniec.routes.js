const router = require('express').Router();
const { registrarAuditoria, ACCIONES } = require('../services/auditoria.service');

// NOTA: esta ruta es pública (sin `autenticar`) a propósito, porque la
// verificación de DNI ocurre en el formulario de REGISTRO, antes de que
// exista una cuenta/token. Se protege con rate limiting en index.js
// (mismo criterio que /api/votos) para evitar abuso/scraping de datos.

/**
 * GET /api/reniec/:dni
 *
 * Proxy hacia una API intermediaria que consulta RENIEC.
 * IMPORTANTE (para tu informe): el webservice OFICIAL de RENIEC requiere
 * convenio institucional, no es de acceso libre. Para efectos académicos
 * se usa un proveedor intermediario (ej. apis.net.pe, factiliza.com,
 * decolecta.com) que sí tiene acceso a la base de RENIEC y ofrece un plan
 * gratuito de pruebas. Se consulta desde el backend (nunca desde el
 * frontend) para no exponer la API key.
 *
 * Configura tu token en backend/.env → RENIEC_API_TOKEN
 */
router.get('/:dni', async (req, res) => {
  const { dni } = req.params;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'El DNI debe tener 8 dígitos numéricos' });
  }

  try {
    // Ejemplo de integración con apis.net.pe (ajusta la URL/proveedor según el que contrates)
    const respuesta = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
      headers: { Authorization: `Bearer ${process.env.RENIEC_API_TOKEN}` },
    });

    if (respuesta.status === 404) {
      return res.status(404).json({ error: 'DNI no encontrado en RENIEC' });
    }
    if (!respuesta.ok) {
      throw new Error(`Proveedor RENIEC respondió ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    console.log('Respuesta cruda de Decolecta:', JSON.stringify(datos));
    // Normalizamos la respuesta para que el frontend siempre reciba el mismo formato,
    // sin importar qué proveedor intermediario se use.
    // Decolecta devuelve: { first_name, first_last_name, second_last_name, full_name, document_number }
    const resultado = {
      dni:             datos.document_number || dni,
      nombres:         datos.first_name || '',
      apellidoPaterno: datos.first_last_name || '',
      apellidoMaterno: datos.second_last_name || '',
      nombreCompleto:  datos.full_name || [datos.first_name, datos.first_last_name, datos.second_last_name].filter(Boolean).join(' '),
      verificado: true,
    };

    await registrarAuditoria({
      usuarioId: null, // aún no existe cuenta en este punto del flujo (pre-registro)
      accion: ACCIONES.CONSULTA_RENIEC,
      ip,
      detalle: `Consulta RENIEC realizada para DNI ${dni}`,
    });

    res.json(resultado);
  } catch (err) {
    console.error('Error consultando RENIEC:', err.message);
    res.status(502).json({ error: 'No se pudo verificar el DNI en este momento. Intenta nuevamente.' });
  }
});

module.exports = router;
