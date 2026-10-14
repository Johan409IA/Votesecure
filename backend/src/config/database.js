const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Atlas conectado: ${conn.connection.host}`);

    // Crear índices para optimizar queries (valores agregados)
    mongoose.connection.once('open', async () => {
      try {
        // Los índices se crean desde los modelos con { index: true }
        console.log('📊 Índices de BD sincronizados');
      } catch (err) {
        console.error('Error creando índices:', err);
      }
    });
  } catch (error) {
    console.error(`❌ Error conectando a MongoDB Atlas: ${error.message}`);
    console.error('Verifica tu MONGODB_URI en el archivo .env');
    process.exit(1);
  }
};

// Eventos de conexión
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconectado');
});

module.exports = connectDB;
