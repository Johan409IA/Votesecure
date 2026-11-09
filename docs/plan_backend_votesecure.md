# Plan: Completar el backend VoteSecure conforme al doc de decisiones

## Entendimiento del proyecto (validar antes de ejecutar)

VoteSecure es un sistema electoral universitario (UTP): docentes crean secciones con código de acceso, los estudiantes se enrolan, se postulan candidaturas, se vota de forma anónima e irrevocable, hay resultados en vivo (Supabase Realtime Broadcast), cierre con instantánea inmutable, desempate el mismo día, proclamación de delegado y evaluación 1–10 con auditoría inmutable.

El backend **ya existe** en `backend/` (Express + TS estricto, arquitectura por capas `presentacion/aplicacion/datos`, Zod, Argon2id, sesiones por cookie HttpOnly + CSRF double-submit, SQL con `SECURITY DEFINER`, tests con Vitest). Este plan **no reescribe**: completa y alinea el código existente hasta cumplir el 100% de `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`, cuya matriz §10 es la fuente de verdad del contrato API (decisión del usuario). Los mockups `docs/u2-diseno/ux-ui/*.jpg` se usan solo como referencia de comportamiento (el backend expone lo que esas pantallas consumen).

## Brechas detectadas (código actual vs. doc de decisiones)

| # | Brecha | Evidencia actual |
|---|---|---|
| 1 | Rutas no coinciden con §10: `/elecciones/:id/voto` (debe ser `/votar`), `/elecciones/:id/resultados/suscripcion` GET (debe ser `POST /resultados/:id/suscripcion`), `/elecciones/:id/delegacion` (debe ser `/proclamar`), `/delegaciones/:id/periodo-evaluacion` (debe ser `POST /evaluaciones/periodos`), `GET /auditoria` (debe ser `GET /auditoria/elecciones/:id`) | `backend/src/presentacion/rutas/*.ts` |
| 2 | Falta `POST /api/elecciones/:id/cerrar` (cierre manual anticipado §6.1); solo existe el cierre automático del planificador | `elecciones.rutas.ts` (no hay ruta `cerrar`), `planificador.ts` |
| 3 | Falta `POST /api/secciones/unirse` por código `SEC-XXXX` (§3.1) y el código no se auto-genera (lo exige el DTO del cliente) | `elecciones.dto.ts:61` (`codigo` requerido), `secciones.rutas.ts` |
| 4 | Resultados en vivo y ticket de suscripción restringidos a estudiantes; el doc §5.1 exige acceso también para docente (proyector) y admin | `resultados.casos.ts:23-32, 60-66` |
| 5 | Ticket HMAC estático (sin vigencia); el doc §5.1 exige ticket efímero de 60 s | `realtime.ts:33-41` |
| 6 | Desempate: el trigger valida el empate, pero falta asistencia "Iniciar Desempate" (auto-cargar candidatos empatados, ventana 15–30 min) y la validación de que las candidaturas de la derivada sean solo las empatadas | `electoral.casos.ts:14`, `sql/001:369-452` |
| 7 | Correo por nodemailer/SMTP; el doc §2.1 fija Resend con remitente `seguridad@votesecureapp.com` | `correo.ts` |
| 8 | Registro sin validación de regex UTP por rol (§2.1) | `auth.dto.ts:11` (solo `.email()`) |
| 9 | `periodos_evaluacion` sin columna `instrucciones` (§7.1 exige instrucciones/criterios del docente) | `sql/001:191-201` |
| 10 | Dependencias con prefijos `^`; §9.1 exige versiones exactas + `npm ci` | `backend/package.json` |

Ya cumplido (solo verificar, no reimplementar): Argon2id, sesiones hash SHA-256 revocables, CSRF double-submit, `registrar_voto` anónimo (tabla `votos` sin identidad), `activar_eleccion` con congelamiento de padrón, `cerrar_y_publicar_resultados` con chequeo `participantes = votos`, vista `resumen_resultados_publicados` (`ganador/empate/sin_votos`), triggers de inmutabilidad, roles de DB mínimos, `crear_usuario` bloquea admin, `programar_eleccion` exige ≥2 candidaturas, evaluación 1–10 con CHECKs y UNIQUE de voto único, planificador de activación/cierre automático, payload `CargaResultado` idéntico al del doc.

## Fases de implementación

### Fase 1 — Contrato API exacto §10
Archivos: `backend/src/presentacion/rutas/{elecciones,secciones,evaluaciones,auditoria}.rutas.ts`, `backend/src/presentacion/dto/*.dto.ts`
1. Renombrar `POST /elecciones/:id/voto` → `POST /elecciones/:id/votar` (`elecciones.rutas.ts:212`).
2. Añadir `POST /elecciones/:id/cerrar` (rol Docente/Admin): nuevo caso `cerrarEleccion` en `electoral.casos.ts` que delega en `eleccionesRepo.cerrarYPublicar` (ya existe, `elecciones.repo.ts:354`) y publica la carga final vía `ctx.publicador`.
3. Mover el ticket de suscripción a `POST /resultados/:id/suscripcion` (handler actual `resultados.casos.ticketSuscripcion`, cambiar GET→POST como indica §10).
4. Renombrar `POST /elecciones/:id/delegacion` → `POST /elecciones/:id/proclamar` (mismo handler `proclamarDelegado`).
5. Renombrar `POST /delegaciones/:id/periodo-evaluacion` → `POST /evaluaciones/periodos` (Docente/Admin), body `{ delegacionId, abreEn, cierraEn, instrucciones }` (ver Fase 7).
6. Cambiar `GET /auditoria` → `GET /auditoria/elecciones/:id`, rol exclusivo `administrador` (verificar/crear chequeo de rol en `auditoria.casos.ts`).
7. **Decisión:** las rutas actuales adicionales (`/programar`, `/cancelar`, `/candidaturas`, `/habilitaciones`, `/elecciones/activas`, `PATCH /elecciones/:id`) se **conservan** como rutas complementarias: las exigen las reglas de negocio §3.2 (gestión de candidaturas y borradores) aunque no figuren en la matriz; documentarlas como anexo. La matriz §10 se cumple literalmente en rutas y roles.

### Fase 2 — Secciones: código auto-generado y unirse por código (§3.1)
Archivos: `academicos.casos.ts`, `academicos.repo.ts`, `secciones.rutas.ts`, `elecciones.dto.ts`
1. Auto-generar el código al crear la sección: formato `SEC-XXXX` (4 caracteres A–Z y 2–9, excluyendo ambiguos `0/O/1/I/L`), generado en `crearSeccion` con reintento ante colisión única. Quitar `codigo` del `seccionSchema` (o hacerlo opcional ignorado).
2. Nuevo endpoint `POST /api/secciones/unirse` (Estudiante, correo verificado), body `{ codigo }`:
   - Buscar sección por código; error si no existe.
   - Error si `secciones.activa = false` ("Bloquear inscripciones"; el toggle `PATCH /secciones/:id` con `activarToggleSchema` ya existe — verificar cableado).
   - Insertar matrícula (el UNIQUE existente previene duplicados) → respuesta con datos de la sección.
3. Caso `unirseASeccion` en `academicos.casos.ts` + consulta por código en `academicos.repo.ts`.

### Fase 3 — Resultados en vivo para docente/admin + ticket HMAC efímero (§5.1)
Archivos: `resultados.casos.ts`, `realtime.ts`, `elecciones.rutas.ts`
1. Ampliar `obtenerResultados` y `ticketSuscripcion`: además de estudiantes habilitados, permitir docente asignado a la sección y administrador (proyector de aula). Los no miembros siguen sin acceso en estado `activa`.
2. Ticket con vigencia de 60 s en `PublicadorResultados`:
   - `ticket = HMAC-SHA256(secreto, "eleccion:{id}:exp:{expUnix}")` con `expUnix = ahora + 60 s`; la respuesta incluye `{ canal, expiraEn }`.
   - `publicar()` envía a los canales de la ventana actual y la anterior (cada ventana = minuto), para que los suscriptores en vuelo no pierdan eventos al rotar el ticket.
   - El nombre de canal sigue siendo `resultados:{eleccionId}:{hmacTicket}` y el payload `CargaResultado` ya cumple el formato del doc.
3. El frontend deberá invocar el POST y suscribirse antes de `expiraEn` (contrato a documentar; frontend fuera de alcance).

### Fase 4 — Desempate asistido de un clic (§6.2)
Archivos: `electoral.casos.ts`, `elecciones.dto.ts`, `resultados.repo.ts`, `sql/001_esquema_oficial.sql` (patch con aprobación)
1. En `crearEleccion`, cuando `tipo='desempate'`:
   - Validar ventana `cierraEn - iniciaEn` entre 15 y 30 minutos (regla de negocio en Zod/caso).
   - Auto-insertar las candidaturas de los candidatos empatados en primer lugar (leer `resultados_candidatos` de la elección origen vía `resultadosRepo`) — esto materializa el botón "Iniciar Desempate".
2. **Cambio SQL** (presentar el patch al usuario como DBA antes de aplicar — taste: el usuario aprueba el SQL): reforzar `controlar_configuracion_electoral` (o `controlar_eleccion`) para que las candidaturas de una elección `desempate` sean subconjunto exacto de los candidatos con `votos_obtenidos = max` en la origen. Aplicar vía `npm run db:aplicar` tras aprobación.

### Fase 5 — Correo con Resend (§2.1)

> Estado (nov 2026): implementado con `fetch` nativo de Node.js contra `POST https://api.resend.com/emails`, sin dependencias nuevas; se descartaron nodemailer y el SDK npm de Resend (arrastra React/peer-deps).
Archivos: `correo.ts`, `config/env.ts`, `.env.example`, `package.json`
1. Comparativa corta de opciones:
   1. **HTTP API de Resend con `fetch` nativo (recomendada):** cero dependencias nuevas, misma interfaz `AdaptadorCorreo`, alineada con §9.1 (versiones fijas).
   2. SDK `resend`: más ergonómico pero añade dependencia y su API cambia.
   3. SMTP vía nodemailer: el doc menciona API/SMTP, pero mantener nodemailer conserva un transporte redundante.
2. Implementar `AdaptadorResend` con `POST https://api.resend.com/emails`, remitente `seguridad@votesecureapp.com`, y **eliminar nodemailer + @types/nodemailer** (taste: el stack obsoleto se borra, no se preserva).
3. Conservar el bypass de desarrollo (`NODE_ENV=development` → log con enlace) y verificar el flujo de token: `crypto.randomBytes(32)`, almacenar solo `SHA-256` (32 bytes) en `verificacion_hash`, expiración 24 h en `verificacion_expira_en`.
4. Variables: añadir `RESEND_API_KEY` y `REMITENTE_CORREO` a `env.ts`, `.env.example` y `.env` con placeholders comentados (taste: template claro con origen de cada valor); retirar `SMTP_URL`.

### Fase 6 — Registro con regex UTP por rol (§2.1)
Archivos: `auth.dto.ts`, `auth.casos.ts`, tests
1. Validar correo en `registroSchema` con los regex del doc: `^u[a-z0-9._%+-]*@utp[.]edu[.]pe$` (estudiante), `^c[a-z0-9._%+-]*@utp[.]edu[.]pe$` (docente); derivar `tipo_usuario` del prefijo. El registro de administrador queda imposible (ya bloqueado en `crear_usuario`).

### Fase 7 — Instrucciones del periodo de evaluación (§7.1)
Archivos: `sql/001_esquema_oficial.sql` (patch), `evaluacion.dto.ts`, `evaluacion.casos.ts`, `evaluaciones.repo.ts`
1. **Cambio SQL** (aprobación del usuario como DBA): `ALTER TABLE periodos_evaluacion ADD COLUMN instrucciones varchar(1000) NOT NULL CHECK (length(btrim(instrucciones)) BETWEEN 20 AND 1000);` (o varchar opcional si se prefiere; el doc dice "instrucciones/criterios específicos" al abrir).
2. Añadir `instrucciones` al `periodoEvaluacionSchema` (20–1000 chars) y al caso/repo.
3. Verificación (sin cambios si ya se cumple): comentario estudiante ≤500 opcional y docente 20–1000 obligatorio (ya en `evaluacion.casos.ts:57,78` y CHECKs SQL), `UNIQUE (periodo_evaluacion_id, matricula_id)`, promedio `ROUND(AVG(calificacion), 2)` en `resumenEvaluacion`, delegado solo ve su promedio post-cierre y nunca evaluadores individuales (`verDelegado`).

### Fase 8 — Reproducibilidad (§9.1)
1. Fijar versiones exactas en `backend/package.json` (quitar `^`/`~`), regenerar `package-lock.json` y validar con `npm ci`.
2. Nota final: el frontend quedará desalineado (usa JWT/Socket.IO/organizaciones) — fuera de alcance de este plan; dejar constancia para un plan posterior del frontend.

### Fase 9 — Tests y verificación
1. Actualizar `scripts/dev/verificar-flujo.ts` (smoke) y `tests/integracion/*` para las rutas renombradas.
2. Nuevos tests:
   - Unitarias: regex UTP por rol, generación `SEC-XXXX`, vigencia del ticket HMAC, validación de ventana 15–30 min del desempate.
   - Integración (requieren `TEST_DATABASE_URL`): unirse por código (incluye sección bloqueada), `POST /elecciones/:id/votar`, cierre manual anticipado, suscripción con ticket y su expiración, flujo de desempate con candidatos empatados, `GET /auditoria/elecciones/:id` (403 para no admin), periodo de evaluación con instrucciones.
3. Ejecutar en orden: `npm ci` → `npm run lint` → `npm run deps:check` → `npm test` → `npm run build` → `npm run db:aplicar` (BD de prueba) → `npm run smoke`.

### Fase 10 — Documentación (cascada de actualización)
1. `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`: sin cambios de decisiones (el código se alinea al doc); añadir anexo de rutas complementarias (Fase 1.7) y corregir la referencia `002_operaciones.sql` → `002_operaciones_y_roles.sql`.
2. Actualizar `backend/.env.example` con las variables nuevas (Resend) y comentarios de origen.

## Archivos críticos a modificar
- `backend/src/presentacion/rutas/elecciones.rutas.ts` (Fases 1, 3)
- `backend/src/presentacion/rutas/secciones.rutas.ts` (Fases 1, 2)
- `backend/src/presentacion/rutas/evaluaciones.rutas.ts`, `auditoria.rutas.ts` (Fase 1)
- `backend/src/aplicacion/casos-uso/{electoral,resultados,academicos,evaluacion,auth}.casos.ts`
- `backend/src/aplicacion/servicios/{realtime,correo}.ts`
- `backend/src/datos/repositorios/{academicos,resultados,evaluaciones}.repo.ts`
- `backend/src/presentacion/dto/{auth,elecciones,evaluacion}.dto.ts`
- `backend/sql/001_esquema_oficial.sql` (patchs de Fases 4 y 7 — con aprobación del usuario como DBA)
- `backend/package.json`, `backend/.env.example`, `backend/src/config/env.ts`
- `backend/tests/**`, `backend/scripts/dev/verificar-flujo.ts`

## Verificación global
1. `npm ci && npm run lint && npm run deps:check && npm test && npm run build` sin errores.
2. `npm run smoke` recorre el flujo completo: registro → verificación (bypass dev) → login → crear sección (código auto) → unirse por código → candidaturas → programar → activar → votar → resultados en vivo → cerrar → proclamar → evaluar → auditoría.
3. Verificar que ningún SELECT de `votos` exista fuera de `contar_votos_eleccion`/funciones (invariante de secreto del voto) y que `eventos_auditoria` no sea insertable por `votesecure_api`.

## Supuestos
- Las rutas extra del código actual se conservan como complementarias (las reglas §3.2 las requieren); la matriz §10 se cumple literalmente.
- `periodos_evaluacion` sigue siendo un periodo único por delegación (`UNIQUE(delegacion_id)`); "semana 8 o semana 16" se interpreta como discrecionalidad de cuándo abrirlo, no como periodos múltiples.
- La ventana del balotaje se valida en la capa de aplicación; el trigger SQL solo valida el empate y el subconjunto de candidatos.
- Ejecución continua end-to-end sin aprobaciones por fase, excepto los dos patchs SQL que se presentan al usuario (autoridad DBA) antes de aplicar.
