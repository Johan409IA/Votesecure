import request from 'supertest';
import { loadServerEnv } from '../../src/config/env';
import { createApp } from '../../src/app';
import { createContext } from '../../src/presentation/context';
import { closePool } from '../../src/data/db';

async function main(): Promise<void> {
  const env = loadServerEnv();
  const app = createApp(env, createContext(env));
  const response = await request(app).get('/api/salud');
  if (response.status !== 200 || response.body.estado !== 'ok') {
    console.error('Fallo la verificacion de humo:', response.status, response.body);
    process.exitCode = 1;
  } else {
    console.log('OK: /api/salud responde', JSON.stringify(response.body));
  }
  await closePool();
}

void main();
