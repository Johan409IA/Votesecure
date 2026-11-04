/** Reglas de dependencias de la arquitectura en capas (plan de refactor, item 2). */
module.exports = {
  forbidden: [
    {
      name: 'presentacion-no-accede-a-datos',
      comment: 'La capa de presentacion no debe importar la capa de datos.',
      severity: 'error',
      from: { path: '^src/presentacion' },
      to: { path: '^src/datos' }
    },
    {
      name: 'presentacion-no-usa-pg',
      severity: 'error',
      from: { path: '^src/presentacion' },
      to: { path: '^(pg)$' }
    },
    {
      name: 'aplicacion-no-depende-de-express',
      comment: 'La capa de negocio no depende de Express.',
      severity: 'error',
      from: { path: '^src/aplicacion' },
      to: { path: '^(express|express-rate-limit|cookie-parser|supertest)$' }
    },
    {
      name: 'aplicacion-no-usa-pg',
      severity: 'error',
      from: { path: '^src/aplicacion' },
      to: { path: '^(pg)$' }
    },
    {
      name: 'datos-no-dependen-de-presentacion',
      comment: 'La capa de datos no construye respuestas HTTP.',
      severity: 'error',
      from: { path: '^src/datos' },
      to: { path: '^src/presentacion' }
    },
    {
      name: 'datos-no-usan-express',
      severity: 'error',
      from: { path: '^src/datos' },
      to: { path: '^(express|express-rate-limit|cookie-parser)$' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    moduleSystems: ['cjs', 'es6']
  }
};
