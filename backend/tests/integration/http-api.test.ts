import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadServerEnv } from '../../src/config/env';
import { createApp } from '../../src/app';
import { createContext } from '../../src/presentation/context';

// Cubren HTTP sin dejar datos permanentes (solo lectura o rechazos).
// El flujo completo con voto se cubre en election-flow.test.ts con rollback,
// ya que los votos son inmutables y no pueden borrarse de una BD compartida.

const env = loadServerEnv();
const app = createApp(env, createContext(env));

describe('API HTTP', () => {
  it('responde el health check', async () => {
    const response = await request(app).get('/api/salud');
    expect(response.status).toBe(200);
    expect(response.body.estado).toBe('ok');
  });

  it('rechaza registro con datos invalidos', async () => {
    const response = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'X', correo: 'no-es-correo', contrasena: 'corta' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDACION');
  });

  it('rechaza registro con correo no UTP sin revelar detalle', async () => {
    const response = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Juan Perez',
        correo: 'juan@gmail.com',
        contrasena: 'una-clave-muy-segura'
      });
    // La validacion del formato UTP (Fase 6) rechaza en la capa de entrada.
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDACION');
  });

  it('login con usuario inexistente responde generico', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'u00000000@utp.edu.pe', contrasena: 'una-clave-muy-segura' });
    expect(response.status).toBe(401);
    expect(response.body.mensaje).toBe('Credenciales invalidas');
  });

  it('exige sesion para /auth/yo', async () => {
    const response = await request(app).get('/api/auth/yo');
    expect(response.status).toBe(401);
  });

  it('exige CSRF en mutaciones con cookie de sesion', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'votecure_sesion=token-invalido-de-prueba');
    expect(response.status).toBe(403);
  });

  it('rechaza mutaciones con Origin ajeno al frontend (§2.2)', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set(
        'Cookie',
        'votecure_sesion=token-invalido-de-prueba; votecure_csrf=csrf-token-prueba'
      )
      .set('X-CSRF-Token', 'csrf-token-prueba')
      .set('Origin', 'https://ejemplo-malo.example');
    expect(response.status).toBe(403);
    expect(response.body.mensaje).toBe('Origen no autorizado');
  });

  it('acepta mutaciones con Origin del frontend (§2.2)', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set(
        'Cookie',
        'votecure_sesion=token-invalido-de-prueba; votecure_csrf=csrf-token-prueba'
      )
      .set('X-CSRF-Token', 'csrf-token-prueba')
      .set('Origin', env.FRONTEND_URL);
    // El origen coincide y el CSRF tambien: pasa al control de sesion.
    expect(response.status).toBe(401);
  });

  it('rechaza query invalida en elecciones', async () => {
    const response = await request(app).get('/api/elecciones?seccionId=abc');
    expect(response.status).toBe(401);
  });

  it('devuelve 404 JSON en rutas desconocidas', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NO_ENCONTRADO');
  });
});
