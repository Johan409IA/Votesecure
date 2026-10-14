require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const cron    = require('node-cron'); // 👈 NUEVO

const connectDB = require('./config/database');
const { configurarSocket } = require('./socket/socket');
const { finalizarEleccionesVencidas } = require('./services/elecciones.service'); // 👈 NUEVO

const authRoutes      = require('./routes/auth.routes');
const eleccionesRoutes = require('./routes/elecciones.routes');
const votosRoutes     = require('./routes/votos.routes');
const reniecRoutes    = require('./routes/reniec.routes');

const app  = express();
const server = http.createServer(app);

// ── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting general
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
}));

// Rate limiting estricto para votos (anti-spam)
const votoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: { error: 'Límite de intentos de voto alcanzado' },
  keyGenerator: (req) => req.usuario?.id || req.ip,
});

// Rate limiting para consultas RENIEC (evita scraping de datos personales)
const reniecLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: 'Demasiadas consultas RENIEC, intenta más tarde' },
});

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api',        eleccionesRoutes);
app.use('/api/votos',  votoLimiter, votosRoutes);
app.use('/api/reniec', reniecLimiter, reniecRoutes);

// Ruta de salud
app.get('/api/health', (_, res) => res.json({ status: 'OK', timestamp: new Date() }));

// 404
app.use('*', (_, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const io = configurarSocket(server);
app.set('io', io); // Disponible en todas las rutas vía req.app.get('io')

// ── Cron: finalizar elecciones vencidas automáticamente ──────────────────────  👈 NUEVO
cron.schedule('* * * * *', () => {
  finalizarEleccionesVencidas(io);
});

// ── Arranque ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const iniciar = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📡 WebSocket listo`);
    console.log(`⏰ Cron de finalización automática activo`); // 👈 NUEVO
    console.log(`🔒 Modo: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

iniciar();