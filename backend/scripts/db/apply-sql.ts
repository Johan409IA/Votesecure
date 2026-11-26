import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main(): Promise<void> {
  // --url <cadena>: conexion alternativa (p. ej. el host directo para
  // migraciones); por defecto DATABASE_URL y luego DATABASE_API_URL.
  const urlIndex = process.argv.indexOf('--url');
  const connectionString =
    (urlIndex !== -1 ? process.argv[urlIndex + 1] : undefined) ??
    process.env['DATABASE_URL'] ??
    process.env['DATABASE_API_URL'];
  if (!connectionString) {
    console.error('Falta la cadena de conexion: pasa --url o define DATABASE_URL/DATABASE_API_URL');
    process.exit(1);
  }

  const sqlFolder = join(__dirname, '..', '..', 'sql');
  // --solo <archivo>: aplica un unico archivo (para migraciones puntuales;
  // la aplicacion completa no es idempotente).
  const soloIndex = process.argv.indexOf('--solo');
  const solo = soloIndex !== -1 ? process.argv[soloIndex + 1] : undefined;
  const files = (await readdir(sqlFolder))
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => !solo || name === solo)
    .sort();
  if (solo && !files.includes(solo)) {
    console.error(`No existe el archivo ${solo} en ${sqlFolder}`);
    process.exit(1);
  }

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
