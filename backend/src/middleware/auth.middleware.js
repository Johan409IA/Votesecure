const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

const autenticar = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await Usuario.findById(decoded.id).select('-passwordHash');
    if (!usuario || !usuario.estado) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado, inicia sesión nuevamente' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { autenticar, soloAdmin };
