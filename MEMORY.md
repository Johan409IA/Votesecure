# MEMORY.md — VoteSecure
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Fuente de verdad: `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md` v1.0 (nov 2026); su matriz §10 es el contrato API.
- El backend base ya existe en `backend/` (Express + TS por capas, Zod, Argon2id, sesiones + CSRF, SQL 001/002, tests Vitest), pero **no cumple aún §10** y `docs/plan_backend_votesecure.md` está pendiente de aplicar (fases 1–10).
- Brechas principales: rutas (`/voto`, `/resultados/suscripcion`, `/delegacion`, `GET /auditoria`), falta cierre manual, unirse por código, ticket HMAC de 60 s, desempate asistido, Resend, regex UTP, `instrucciones` en periodos y versiones exactas.
- El frontend `frontend/` es legado (JWT/Socket.IO/organizaciones) y no está alineado con el backend; su realineación será un plan posterior.
- `backend/dist/` es salida de build; no editar.

## Decisiones (y por qué)
- Rutas URL en español por §10; archivos, funciones, tipos y variables en inglés. El backend actual está en español y se renombrará completo (pendiente).
- Tablas, columnas, funciones SQL y roles en español; la BD es la última línea de defensa (`SECURITY DEFINER`, roles mínimos).
- Voto anónimo por diseño: `votos` sin identidad ni timestamp; la API solo usa agregados.
- Sesiones por cookie HttpOnly + CSRF double-submit; contraseñas Argon2id; hash de sesión SHA-256.
- Resultados en vivo por Supabase Realtime con ticket HMAC efímero (60 s), no JWT/Socket.IO.
- Administrador solo por CLI de aprovisionamiento; `crear_usuario` bloquea el rol admin.
- Cambios de esquema SQL requieren aprobación explícita del usuario (rol DBA).
- Versiones exactas + `npm ci` (§9.1); sin prefijos `^`/`~`. Dependencias fijadas ya en `backend/package.json`.
- Resend mediante `fetch` nativo de Node.js reemplaza a nodemailer y al SDK npm de Resend (evita arrastrar React/peer-deps al backend). `dotenv` movido a dependencies para evitar fallos con `npm ci --omit=dev`. `package-lock.json` regenerado y validado con `npm ci` (nov 2026).
- `supertest` fijado en `7.3.2`: la versión pedida (`7.0.3`) no existe en npm. `dependency-cruiser` subido a `18.7.2` porque `16.8.0` falla en Node 24 (`R_OK` no exportado por `node:fs` en ESM).
- Parches de seguridad aplicados (nov 2026): `express` 4.22.3 (+ `proxy-addr` 2.0.8), `vitest` 3.2.7, `supabase` 2.122.1. Pendiente por ser cambio mayor: `zod` 4 (memoria) y `vitest` 5 (tinypool RCE), que exigen migración y pruebas.

## Aprendizajes y errores a evitar
- No asumir que el plan está aplicado: el código actual es la base, no el estado final de §10.
- No leer `votos` desde la API ni añadir trazabilidad que rompa el secreto del voto.
- No ampliar privilegios de `votesecure_api` ni permitir INSERT en `eventos_auditoria`.
- El doc oficial cita `002_operaciones.sql`; el archivo real es `002_operaciones_y_roles.sql`.

## Próximos pasos
- `npm test` completo exige `TEST_DATABASE_URL`; sin BD de pruebas fallan los tests de integración (ENOTFOUND), no por el código.
- Renombrar todo el backend a identificadores y archivos en inglés, sin cambiar las rutas URL.
- Ejecutar `docs/plan_backend_votesecure.md` fases 1–10; presentar los patches SQL (fases 4 y 7) antes de aplicar.
- Actualizar tests y smoke para las rutas de §10; después planificar el frontend.
