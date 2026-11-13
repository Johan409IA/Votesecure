import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Las pruebas siempre corren como test: un NODE_ENV heredado del shell
    // (p. ej. production) no debe filtrarse a la configuracion de la app.
    env: { NODE_ENV: 'test' }
  }
});
