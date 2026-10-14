const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const configurarSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware de autenticación para WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requerido para WebSocket'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuarioId = decoded.id;
      socket.rol = decoded.rol;
      next();
    } catch (err) {
      next(new Error('Token WebSocket inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id} (usuario: ${socket.usuarioId})`);

    // Suscribirse a los resultados de una elección específica
    socket.on('suscribir:eleccion', (eleccionId) => {
      socket.join(`eleccion:${eleccionId}`);
      console.log(`📡 Socket ${socket.id} suscrito a eleccion:${eleccionId}`);
    });

    // Desuscribirse
    socket.on('desuscribir:eleccion', (eleccionId) => {
      socket.leave(`eleccion:${eleccionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

module.exports = { configurarSocket };
