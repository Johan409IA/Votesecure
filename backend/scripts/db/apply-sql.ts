import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const connectionString =
    process.argv[2] ??
    process.env['DATABASE_URL'] ??
    process.env['DATABASE_API_URL'];
  if (!connectionString) {
    console.error('Falta la cadena de conexion: pasa --url o define DATABASE_URL/DATABASE_API_URL');
    process.exit(1);
  }

  const sqlFolder = join(__dirname, '..', '..', 'sql');
  const files = (await readdir(sqlFolder))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const pool = new Pool({ connectionString, max: 1 });
  try {
    for (const file of files) {
      const filePath = join(sqlFolder, file);
      const content = await readFile(filePath, 'utf-8');
      console.log(`Aplicando ${file} ...`);
      try {
        await pool.query(content);
        console.log(`OK: ${file}`);
      } catch (error) {
        console.error(`FALLO en ${file}:`, error instanceof Error ? error.message : error);
        process.exitCode = 1;
        return;
      }
    }
    console.log('Esquema aplicado correctamente.');
  } finally {
    await pool.end();
  }
}

void main();
