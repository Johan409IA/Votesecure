import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const cadena =
    process.argv[2] ??
    process.env['DATABASE_URL'] ??
    process.env['DATABASE_API_URL'];
  if (!cadena) {
    console.error('Falta la cadena de conexion: pasa --url o define DATABASE_URL/DATABASE_API_URL');
    process.exit(1);
  }

  const carpetaSql = join(__dirname, '..', '..', 'sql');
  const archivos = (await readdir(carpetaSql))
    .filter((n) => n.endsWith('.sql'))
    .sort();

  const pool = new Pool({ connectionString: cadena, max: 1 });
  try {
    for (const archivo of archivos) {
      const ruta = join(carpetaSql, archivo);
      const contenido = await readFile(ruta, 'utf-8');
      console.log(`Aplicando ${archivo} ...`);
      try {
        await pool.query(contenido);
        console.log(`OK: ${archivo}`);
      } catch (error) {
        console.error(`FALLO en ${archivo}:`, error instanceof Error ? error.message : error);
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
