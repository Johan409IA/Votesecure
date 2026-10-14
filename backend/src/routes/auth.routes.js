const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Usuario }   = require('../models');
const { registrarAuditoria, ACCIONES } = require('../services/auditoria.service');

// ── REGISTRO ──────────────────────────────────────────────────────────────────
router.post('/registro', [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('correo').isEmail().normalizeEmail().withMessage('Correo inválido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { nombre, correo, password, rol, organizacion_id, dni, verificadoReniec } = req.body;

    const existe = await Usuario.findOne({ correo });
    if (existe) return res.status(409).json({ error: 'El correo ya está registrado' });

    if (dni) {
      const dniEnUso = await Usuario.findOne({ dni });
      if (dniEnUso) return res.status(409).json({ error: 'Este DNI ya está registrado en el sistema' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const rolFinal = rol === 'admin' ? 'admin' : 'votante';

    if (rolFinal === 'votante' && !organizacion_id) {
      return res.status(400).json({ error: 'Debes seleccionar tu organización (curso/aula)' });
    }
    if (rolFinal === 'votante' && !verificadoReniec) {
      return res.status(400).json({ error: 'Debes verificar tu DNI con RENIEC antes de registrarte' });
    }

    const usuario = await Usuario.create({
      nombre,
      correo,
      passwordHash,
      rol: rolFinal,
      organizacion_id: rolFinal === 'votante' ? organizacion_id : null,
      dni: dni || null,
      verificadoReniec: !!verificadoReniec,
    });

    await registrarAuditoria({
      usuarioId: usuario._id,
      accion: ACCIONES.REGISTRO,
      ip: req.socket.remoteAddress,
      detalle: `Nuevo usuario registrado: ${correo}`,
    });

    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id:     usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol:    usuario.rol,
        organizacion_id: usuario.organizacion_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('correo').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { correo, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const usuario = await Usuario.findOne({ correo });
    if (!usuario || !usuario.estado) {
      await registrarAuditoria({ accion: ACCIONES.LOGIN_FALLIDO, ip, detalle: correo });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valido = await bcrypt.compare(password, usuario.passwordHash);
    if (!valido) {
      await registrarAuditoria({
        usuarioId: usuario._id,
        accion: ACCIONES.LOGIN_FALLIDO,
        ip,
        detalle: 'Contraseña incorrecta',
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await registrarAuditoria({
      usuarioId: usuario._id,
      accion: ACCIONES.LOGIN,
      ip,
      detalle: 'Login exitoso',
    });

    res.json({
      token,
      usuario: {
        id:     usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol:    usuario.rol,
        organizacion_id: usuario.organizacion_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
