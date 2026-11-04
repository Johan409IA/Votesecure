import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cargarEntornoServidor } from '../../src/config/env';
import { crearApp } from '../../src/app';
import { crearContexto } from '../../src/presentacion/contexto';

// Cubren HTTP sin dejar datos permanentes (solo lectura o rechazos).
// El flujo completo con voto se cubre en flujo-electoral.test.ts con rollback,
// ya que los votos son inmutables y no pueden borrarse de una BD compartida.

const entorno = cargarEntornoServidor();
const app = crearApp(entorno, crearContexto(entorno));

describe('API HTTP', () => {
  it('responde el health check', async () => {
    const r = await request(app).get('/api/salud');
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('ok');
  });

  it('rechaza registro con datos invalidos', async () => {
    const r = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'X', correo: 'no-es-correo', contrasena: 'corta' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('VALIDACION');
  });

  it('rechaza registro con correo no UTP sin revelar detalle', async () => {
    const r = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Juan Perez',
        correo: 'juan@gmail.com',
        contrasena: 'una-clave-muy-segura'
      });
    expect(r.status).toBe(422);
  });

  it('login con usuario inexistente responde generico', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'u00000000@utp.edu.pe', contrasena: 'una-clave-muy-segura' });
    expect(r.status).toBe(401);
    expect(r.body.mensaje).toBe('Credenciales invalidas');
  });

  it('exige sesion para /auth/yo', async () => {
    const r = await request(app).get('/api/auth/yo');
    expect(r.status).toBe(401);
  });

  it('exige CSRF en mutaciones con cookie de sesion', async () => {
    const r = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'votecure_sesion=token-invalido-de-prueba');
    expect(r.status).toBe(403);
  });

  it('rechaza query invalida en elecciones', async () => {
    const r = await request(app).get('/api/elecciones?seccionId=abc');
    expect(r.status).toBe(401);
  });

  it('devuelve 404 JSON en rutas desconocidas', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('NO_ENCONTRADO');
  });
});
