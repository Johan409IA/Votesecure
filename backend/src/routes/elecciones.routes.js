const router = require('express').Router();
const { autenticar, soloAdmin } = require('../middleware/auth.middleware');
const { Eleccion, Candidato, Organizacion } = require('../models');
const { obtenerResultadosAgregados } = require('../services/resultados.service');
const { registrarAuditoria, ACCIONES } = require('../services/auditoria.service');

// ══════════════════════════════════════════════════════════
//  ORGANIZACIONES
// ══════════════════════════════════════════════════════════

// Endpoint público (sin login) — solo nombre e id, para el formulario de registro
router.get('/organizaciones/publico', async (req, res) => {
  try {
    const orgs = await Organizacion.find().select('nombre').lean();
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/organizaciones', autenticar, async (req, res) => {
  const orgs = await Organizacion.find().lean();
  res.json(orgs);
});

router.post('/organizaciones', autenticar, soloAdmin, async (req, res) => {
  try {
    const org = await Organizacion.create(req.body);
    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/organizaciones/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const tieneElecciones = await Eleccion.countDocuments({ organizacion_id: req.params.id });
    if (tieneElecciones > 0) {
      return res.status(409).json({ error: `No se puede eliminar: tiene ${tieneElecciones} elección(es) asociada(s). Elimínalas primero.` });
    }
    const org = await Organizacion.findByIdAndDelete(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ message: 'Organización eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ELECCIONES
// ══════════════════════════════════════════════════════════
router.get('/elecciones', autenticar, async (req, res) => {
  try {
    const { estado, organizacion_id } = req.query;
    const filtro = {};
    if (estado) filtro.estado = estado;
    if (organizacion_id) filtro.organizacion_id = organizacion_id;
    const elecciones = await Eleccion.find(filtro)
      .populate('organizacion_id', 'nombre')
      .sort({ fechaInicio: -1 })
      .lean();
    res.json(elecciones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/elecciones/:id', autenticar, async (req, res) => {
  try {
    const eleccion = await Eleccion.findById(req.params.id)
      .populate('organizacion_id', 'nombre descripcion')
      .lean();
    if (!eleccion) return res.status(404).json({ error: 'Elección no encontrada' });

    const candidatos = await Candidato.find({ eleccion_id: req.params.id })
      .select('-__v')
      .lean();

    res.json({ ...eleccion, candidatos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/elecciones', autenticar, soloAdmin, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.body;
    if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    const eleccion = await Eleccion.create(req.body);
    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.CREAR_ELECCION,
      ip: req.socket.remoteAddress,
      detalle: `Elección creada: ${eleccion.titulo}`,
    });
    res.status(201).json(eleccion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/elecciones/:id/estado', autenticar, soloAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    const validos = ['borrador', 'activa', 'finalizada', 'cancelada'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const eleccion = await Eleccion.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );
    if (!eleccion) return res.status(404).json({ error: 'Elección no encontrada' });

    // Notificar cambio de estado por WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`eleccion:${req.params.id}`).emit('eleccion:estado', {
        eleccion_id: req.params.id,
        estado,
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.MODIFICAR_ELECCION,
      ip: req.socket.remoteAddress,
      detalle: `Estado cambiado a "${estado}" en elección ${req.params.id}`,
    });

    res.json(eleccion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/elecciones/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const { Voto, Participacion, Resultado, ComprobanteVoto } = require('../models');
    const eleccionId = req.params.id;

    const eleccion = await Eleccion.findById(eleccionId);
    if (!eleccion) return res.status(404).json({ error: 'Elección no encontrada' });

    // Borrado en cascada: comprobantes -> participaciones, luego el resto
    const participaciones = await Participacion.find({ eleccion_id: eleccionId }).select('_id');
    const participacionIds = participaciones.map(p => p._id);

    await ComprobanteVoto.deleteMany({ participacion_id: { $in: participacionIds } });
    await Participacion.deleteMany({ eleccion_id: eleccionId });
    await Voto.deleteMany({ eleccion_id: eleccionId });
    await Resultado.deleteMany({ eleccion_id: eleccionId });
    await Candidato.deleteMany({ eleccion_id: eleccionId });
    await Eleccion.findByIdAndDelete(eleccionId);

    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.ELIMINAR_ELECCION,
      ip: req.socket.remoteAddress,
      detalle: `Elección eliminada: "${eleccion.titulo}" (incluye candidatos y datos asociados)`,
    });

    res.json({ message: 'Elección y todos sus datos asociados fueron eliminados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  CANDIDATOS
// ══════════════════════════════════════════════════════════
router.get('/elecciones/:id/candidatos', autenticar, async (req, res) => {
  try {
    const candidatos = await Candidato.find({ eleccion_id: req.params.id }).lean();
    res.json(candidatos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/candidatos', autenticar, soloAdmin, async (req, res) => {
  try {
    const { nombre, eleccion_id } = req.body;
    if (nombre && eleccion_id) {
      const yaExiste = await Candidato.findOne({
        eleccion_id,
        nombre: { $regex: `^${nombre.trim()}$`, $options: 'i' },
      });
      if (yaExiste) {
        return res.status(409).json({ error: `Ya existe un candidato llamado "${nombre}" en esta elección` });
      }
    }

    const candidato = await Candidato.create(req.body);
    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.CREAR_CANDIDATO,
      ip: req.socket.remoteAddress,
      detalle: `Candidato creado: ${candidato.nombre}`,
    });
    res.status(201).json(candidato);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/candidatos/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const candidato = await Candidato.findByIdAndDelete(req.params.id);
    if (!candidato) return res.status(404).json({ error: 'Candidato no encontrado' });

    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.ELIMINAR_CANDIDATO,
      ip: req.socket.remoteAddress,
      detalle: `Candidato eliminado: ${candidato.nombre}`,
    });

    res.json({ message: 'Candidato eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  RESULTADOS (con pipeline de agregación)
// ══════════════════════════════════════════════════════════
router.get('/elecciones/:id/resultados', autenticar, async (req, res) => {
  try {
    const datos = await obtenerResultadosAgregados(req.params.id);

    await registrarAuditoria({
      usuarioId: req.usuario._id,
      accion: ACCIONES.VER_RESULTADOS,
      ip: req.socket.remoteAddress,
      detalle: `Resultados consultados: elección ${req.params.id}`,
    });

    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  AUDITORÍA (solo admin)
// ══════════════════════════════════════════════════════════
router.get('/auditoria', autenticar, soloAdmin, async (req, res) => {
  try {
    const { Auditoria } = require('../models');
    const { pagina = 1, limite = 50, accion } = req.query;
    const filtro = accion ? { accion } : {};

    const logs = await Auditoria.find(filtro)
      .populate('usuario_id', 'nombre correo rol')  // No revela votos
      .sort({ fechaHora: -1 })
      .skip((pagina - 1) * limite)
      .limit(Number(limite))
      .lean();

    const total = await Auditoria.countDocuments(filtro);

    res.json({ logs, total, pagina: Number(pagina), limite: Number(limite) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
