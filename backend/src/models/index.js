const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── ORGANIZACION ─────────────────────────────────────────────────────────────
const organizacionSchema = new Schema({
  nombre:       { type: String, required: true, trim: true },
  descripcion:  { type: String, default: '' },
  fechaCreacion:{ type: Date,   default: Date.now },
}, { timestamps: false, versionKey: false });

// ─── USUARIO ──────────────────────────────────────────────────────────────────
const usuarioSchema = new Schema({
  nombre:          { type: String, required: true, trim: true },
  correo:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:    { type: String, required: true },
  rol:             { type: String, enum: ['admin', 'votante'], default: 'votante' },
  organizacion_id: { type: Schema.Types.ObjectId, ref: 'Organizacion', default: null }, // Curso/aula al que pertenece (admin no requiere)
  estado:          { type: Boolean, default: true },
  fechaRegistro:   { type: Date, default: Date.now },

  // ── VALOR AGREGADO: Verificación de identidad vía RENIEC ─────────────────
  dni:              { type: String, default: null, unique: true, sparse: true, trim: true }, // sparse = permite null en admins
  verificadoReniec: { type: Boolean, default: false }, // true si el DNI fue validado contra RENIEC al registrarse
}, { timestamps: false, versionKey: false });

// Índice para búsquedas rápidas por correo
usuarioSchema.index({ correo: 1 });

// ─── ELECCION ─────────────────────────────────────────────────────────────────
const eleccionSchema = new Schema({
  organizacion_id: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  titulo:          { type: String, required: true, trim: true },
  descripcion:     { type: String, default: '' },
  fechaInicio:     { type: Date, required: true },
  fechaFin:        { type: Date, required: true },
  estado:          { type: String, enum: ['borrador', 'activa', 'finalizada', 'cancelada'], default: 'borrador' },

  // ── VALORES AGREGADOS (actualizados en tiempo real) ──────────────────────
  totalVotos:         { type: Number, default: 0 },      // Contador total de votos
  totalParticipantes: { type: Number, default: 0 },      // Usuarios que votaron
  porcentajeParticipacion: { type: Number, default: 0 }, // % respecto a inscritos
}, { timestamps: true, versionKey: false });

eleccionSchema.index({ estado: 1 });
eleccionSchema.index({ organizacion_id: 1 });

// ─── CANDIDATO ────────────────────────────────────────────────────────────────
const candidatoSchema = new Schema({
  eleccion_id:  { type: Schema.Types.ObjectId, ref: 'Eleccion', required: true },
  nombre:       { type: String, required: true, trim: true },
  descripcion:  { type: String, default: '' },
  foto:         { type: String, default: '' },

  // ── VALOR AGREGADO: Votos acumulados por candidato ───────────────────────
  totalVotos:   { type: Number, default: 0 },
  porcentaje:   { type: Number, default: 0 },  // % del total de la elección
}, { timestamps: false, versionKey: false });

candidatoSchema.index({ eleccion_id: 1 });

// ─── VOTO (encriptado, sin revelar identidad) ─────────────────────────────────
const votoSchema = new Schema({
  eleccion_id:    { type: Schema.Types.ObjectId, ref: 'Eleccion', required: true },
  votoEncriptado: { type: String, required: true }, // AES-256: candidato_id cifrado
  hashVoto:       { type: String, required: true, unique: true }, // SHA-256 para integridad
  marcaTiempo:    { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

// Índice para verificar integridad rápidamente
votoSchema.index({ hashVoto: 1 }, { unique: true });
votoSchema.index({ eleccion_id: 1 });

// ─── PARTICIPACION (enlaza usuario-elección, sin revelar qué votó) ─────────────
const participacionSchema = new Schema({
  usuario_id:      { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  eleccion_id:     { type: Schema.Types.ObjectId, ref: 'Eleccion', required: true },
  fechaVoto:       { type: Date, default: Date.now },
  hashComprobante: { type: String, required: true }, // Prueba de participación anónima
}, { timestamps: false, versionKey: false });

// Índice compuesto: un usuario solo vota una vez por elección
participacionSchema.index({ usuario_id: 1, eleccion_id: 1 }, { unique: true });

// ─── RESULTADO (snapshot calculado para reportes rápidos) ─────────────────────
const resultadoSchema = new Schema({
  eleccion_id:         { type: Schema.Types.ObjectId, ref: 'Eleccion', required: true },
  candidato_id:        { type: Schema.Types.ObjectId, ref: 'Candidato', required: true },
  cantidadVotos:       { type: Number, default: 0 },
  porcentaje:          { type: Number, default: 0 },
  ultimaActualizacion: { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

resultadoSchema.index({ eleccion_id: 1 });

// ─── COMPROBANTE_VOTO ─────────────────────────────────────────────────────────
const comprobanteVotoSchema = new Schema({
  participacion_id: { type: Schema.Types.ObjectId, ref: 'Participacion', required: true },
  hashPublico:      { type: String, required: true }, // Hash que el votante puede verificar
  fechaGeneracion:  { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
const auditoriaSchema = new Schema({
  usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null }, // null = anónimo
  accion:     { type: String, required: true }, // 'LOGIN', 'VOTO_EMITIDO', 'VER_RESULTADOS', etc.
  ip:         { type: String, default: '' },
  detalle:    { type: String, default: '' },    // Info sin revelar el voto
  fechaHora:  { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

auditoriaSchema.index({ usuario_id: 1 });
auditoriaSchema.index({ fechaHora: -1 });
auditoriaSchema.index({ accion: 1 });

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  Organizacion:    mongoose.model('Organizacion',   organizacionSchema),
  Usuario:         mongoose.model('Usuario',        usuarioSchema),
  Eleccion:        mongoose.model('Eleccion',       eleccionSchema),
  Candidato:       mongoose.model('Candidato',      candidatoSchema),
  Voto:            mongoose.model('Voto',           votoSchema),
  Participacion:   mongoose.model('Participacion',  participacionSchema),
  Resultado:       mongoose.model('Resultado',      resultadoSchema),
  ComprobanteVoto: mongoose.model('ComprobanteVoto',comprobanteVotoSchema),
  Auditoria:       mongoose.model('Auditoria',      auditoriaSchema),
};
