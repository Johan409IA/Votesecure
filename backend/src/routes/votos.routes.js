const router  = require('express').Router();
const crypto  = require('crypto');
const { autenticar } = require('../middleware/auth.middleware');
const { Voto, Participacion, ComprobanteVoto, Eleccion, Candidato } = require('../models');
const { encriptarVoto, generarHashVoto, generarHashComprobante } = require('../services/encryption.service');
const { actualizarResultados } = require('../services/resultados.service');
const { registrarAuditoria, ACCIONES } = require('../services/auditoria.service');

/**
 * POST /api/votos
 * Emite un voto de forma segura y anónima.
 * El proceso:
 *   1. Valida que la elección esté activa y el usuario no haya votado
 *   2. Encripta el candidato_id con AES-256
 *   3. Genera un hash SHA-256 para integridad (blockchain-like)
 *   4. Guarda el voto sin asociarlo directamente al usuario
 *   5. Guarda la Participación (usuario + elección, sin candidato)
 *   6. Actualiza valores agregados en tiempo real
 *   7. Emite evento WebSocket con nuevos resultados
 */
router.post('/', autenticar, async (req, res) => {
  const io = req.app.get('io');
  const { eleccion_id, candidato_id } = req.body;
  const usuarioId = req.usuario._id;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // ── Validaciones ────────────────────────────────────────────────────────
    if (!eleccion_id || !candidato_id) {
      return res.status(400).json({ error: 'eleccion_id y candidato_id son requeridos' });
    }

    const eleccion = await Eleccion.findById(eleccion_id);
    if (!eleccion) return res.status(404).json({ error: 'Elección no encontrada' });
    if (eleccion.estado !== 'activa') {
      return res.status(400).json({ error: 'La elección no está activa' });
    }
    const ahora = new Date();
    if (ahora < eleccion.fechaInicio || ahora > eleccion.fechaFin) {
      return res.status(400).json({ error: 'La elección fuera del período de votación' });
    }

    const candidato = await Candidato.findOne({ _id: candidato_id, eleccion_id });
    if (!candidato) return res.status(404).json({ error: 'Candidato no encontrado en esta elección' });

    // ── Verificar pertenencia a la organización (solo votantes) ──────────────
    if (req.usuario.rol !== 'admin') {
      const orgUsuario  = req.usuario.organizacion_id?.toString();
      const orgEleccion = eleccion.organizacion_id?.toString();
      if (!orgUsuario || orgUsuario !== orgEleccion) {
        await registrarAuditoria({
          usuarioId,
          accion: ACCIONES.ACCESO_NO_AUTORIZADO,
          ip,
          detalle: `Intento de voto fuera de organización en elección ${eleccion_id}`,
        });
        return res.status(403).json({ error: 'No puedes votar en una elección que no pertenece a tu organización' });
      }
    }

    // ── Verificar si ya votó (doble voto) ───────────────────────────────────
    const yaVoto = await Participacion.findOne({ usuario_id: usuarioId, eleccion_id });
    if (yaVoto) {
      await registrarAuditoria({
        usuarioId,
        accion: ACCIONES.INTENTO_DOBLE_VOTO,
        ip,
        detalle: `Intento de doble voto en elección ${eleccion_id}`,
      });
      return res.status(409).json({ error: 'Ya has emitido tu voto en esta elección' });
    }

    // ── Encriptar el voto ────────────────────────────────────────────────────
    const timestamp = new Date();
    const salt = crypto.randomBytes(16).toString('hex');
    const votoEncriptado = encriptarVoto(candidato_id.toString());
    const hashVoto = generarHashVoto(candidato_id.toString(), eleccion_id.toString(), timestamp.getTime(), salt);

    // ── Guardar el voto (sin usuario_id – anonimato) ────────────────────────
    await Voto.create({
      eleccion_id,
      votoEncriptado,
      hashVoto,
      marcaTiempo: timestamp,
    });

    // ── Registrar participación (usuario votó, pero no a quién) ─────────────
    const hashComprobante = generarHashComprobante(
      usuarioId.toString(),
      eleccion_id.toString(),
      timestamp.getTime()
    );
    const participacion = await Participacion.create({
      usuario_id:      usuarioId,
      eleccion_id,
      fechaVoto:       timestamp,
      hashComprobante,
    });

    // ── Generar comprobante público ──────────────────────────────────────────
    const comprobante = await ComprobanteVoto.create({
      participacion_id: participacion._id,
      hashPublico:      hashComprobante,
      fechaGeneracion:  timestamp,
    });

    // ── Actualizar valores agregados y emitir por WebSocket ─────────────────
    await actualizarResultados(eleccion_id, candidato_id, io);

    // ── Auditoría: registra que votó, NO a quién ─────────────────────────────
    await registrarAuditoria({
      usuarioId,
      accion: ACCIONES.VOTO_EMITIDO,
      ip,
      detalle: `Voto emitido en elección "${eleccion.titulo}" - Hash: ${hashVoto.slice(0, 16)}...`,
    });

    res.status(201).json({
      message: '✅ Voto emitido correctamente',
      comprobante: {
        hashPublico:     comprobante.hashPublico,
        fechaGeneracion: comprobante.fechaGeneracion,
        eleccion:        eleccion.titulo,
      },
    });
  } catch (err) {
    console.error('Error al emitir voto:', err);
    res.status(500).json({ error: 'Error interno al procesar el voto' });
  }
});

/**
 * GET /api/votos/mis-comprobantes
 * Lista todos los comprobantes del usuario autenticado, recuperados
 * desde el backend (no depende de localStorage del navegador).
 * No revela a quién votó en cada elección.
 */
router.get('/mis-comprobantes', autenticar, async (req, res) => {
  try {
    const participaciones = await Participacion.find({ usuario_id: req.usuario._id })
      .populate('eleccion_id', 'titulo estado')
      .sort({ fechaVoto: -1 })
      .lean();

    const comprobantes = participaciones.map(p => ({
      eleccion:   p.eleccion_id?.titulo || 'Elección eliminada',
      estado:     p.eleccion_id?.estado || '—',
      fechaVoto:  p.fechaVoto,
      hash:       p.hashComprobante,
    }));

    res.json(comprobantes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tus comprobantes' });
  }
});

/**
 * GET /api/votos/verificar/:hash
 * Permite a un votante verificar que su voto está registrado
 * sin revelar a quién votó.
 */
router.get('/verificar/:hash', autenticar, async (req, res) => {
  try {
    const participacion = await Participacion.findOne({
      hashComprobante: req.params.hash,
      usuario_id: req.usuario._id,
    }).populate('eleccion_id', 'titulo estado');

    if (!participacion) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    res.json({
      verificado: true,
      eleccion:   participacion.eleccion_id?.titulo,
      fechaVoto:  participacion.fechaVoto,
      hash:       participacion.hashComprobante,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar comprobante' });
  }
});

module.exports = router;
