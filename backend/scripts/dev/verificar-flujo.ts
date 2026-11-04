import request from 'supertest';
import { cargarEntornoServidor } from '../../src/config/env';
import { crearApp } from '../../src/app';
import { crearContexto } from '../../src/presentacion/contexto';
import { cerrarPool } from '../../src/datos/db';

async function main(): Promise<void> {
  const entorno = cargarEntornoServidor();
  const app = crearApp(entorno, crearContexto(entorno));
  const r = await request(app).get('/api/salud');
  if (r.status !== 200 || r.body.estado !== 'ok') {
    console.error('Fallo la verificacion de humo:', r.status, r.body);
    process.exitCode = 1;
  } else {
    console.log('OK: /api/salud responde', JSON.stringify(r.body));
  }
  await cerrarPool();
}

void main();
