/** Reglas de dependencias de la arquitectura en capas (plan de refactor, item 2). */
module.exports = {
  forbidden: [
    {
      name: 'presentation-must-not-import-data',
      comment: 'La capa de presentacion no debe importar la capa de datos.',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^src/data' }
    },
    {
      name: 'presentation-must-not-use-pg',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^(pg)$' }
    },
    {
      name: 'application-must-not-depend-on-express',
      comment: 'La capa de negocio no depende de Express.',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^(express|express-rate-limit|cookie-parser|supertest)$' }
    },
    {
      name: 'application-must-not-use-pg',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^(pg)$' }
    },
    {
      name: 'data-must-not-depend-on-presentation',
      comment: 'La capa de datos no construye respuestas HTTP.',
      severity: 'error',
      from: { path: '^src/data' },
      to: { path: '^src/presentation' }
    },
    {
      name: 'data-must-not-use-express',
      severity: 'error',
      from: { path: '^src/data' },
      to: { path: '^(express|express-rate-limit|cookie-parser)$' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    moduleSystems: ['cjs', 'es6']
  }
};
