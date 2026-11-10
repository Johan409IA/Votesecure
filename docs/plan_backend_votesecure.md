# Plan: Completar el backend VoteSecure conforme al doc de decisiones

## Entendimiento del proyecto (validar antes de ejecutar)

VoteSecure es un sistema electoral universitario (UTP): docentes crean secciones con código de acceso, los estudiantes se enrolan, se postulan candidaturas, se vota de forma anónima e irrevocable, hay resultados en vivo (Supabase Realtime Broadcast), cierre con instantánea inmutable, desempate el mismo día, proclamación de delegado y evaluación 1–10 con auditoría inmutable.

El backend **ya existe** en `backend/` (Express + TS estricto, arquitectura por capas `presentacion/aplicacion/datos` — renombradas a `presentation/application/data` en la Fase 0 —, Zod, Argon2id, sesiones por cookie HttpOnly + CSRF double-submit, SQL con `SECURITY DEFINER`, tests con Vitest). Este plan **no reescribe**: completa y alinea el código existente hasta cumplir el 100% de `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`, cuya matriz §10 es la fuente de verdad del contrato API (decisión del usuario). Los mockups `docs/u2-diseno/ux-ui/*.jpg` se usan solo como referencia de comportamiento (el backend expone lo que esas pantallas consumen).

## Convención de nomenclatura (obligatoria, según `AGENTS.md`)

Todo el renombrado se ejecuta en la **Fase 0**; las fases 1–10 ya citan archivos e identificadores en inglés.

**En inglés** (archivos, carpetas, funciones, tipos, variables, constantes):

- Carpetas en minúsculas y singular: `src/presentation/{routes,dto,middleware}`, `src/application/{use-cases,services}`, `src/data/repositories`, `src/shared`, `tests/unit`, `tests/integration`.
- Archivos: `dominio-singular.sufijo-del-rol` (sufijos `.routes.ts`, `.dto.ts`, `.use-cases.ts`, `.repo.ts`); servicios y módulos transversales sin sufijo (`mail.ts`, `policies.ts`, `errors.ts`).
- Funciones `camelCase` con verbo (`createElection`, `joinSection`); tipos/interfaces `PascalCase` singular (`Election`, `NewElectionData`); constantes `SCREAMING_SNAKE_CASE` (`SESSION_COOKIE_NAME`); alias de import también en inglés (`electionsRepo`, `voteUseCases`).

**Se queda en español** (no traducir):

- Rutas URL del contrato §10 (`/votar`, `/resultados`, `/proclamar`, `/evaluaciones/periodos`, `/secciones/unirse`…).
- Claves y literales JSON del contrato API (`mensaje`, `usuario`, `{ canal, expiraEn }`, `SEC-XXXX`, `'borrador' | 'programada' | 'activa' | 'cerrada' | 'cancelada'`, `'estudiante' | 'docente' | 'administrador'`, `'ganador' | 'empate' | 'sin_votos'`, `'en_vivo' | 'final'`): el frontend los consume.
- Objetos SQL: tablas, columnas, vistas, funciones y roles (`habilitaciones_voto`, `registrar_voto`, `votos_obtenidos`, `votesecure_api`); los archivos `backend/sql/00*.sql` conservan su nombre.
- Comentarios, mensajes de error y documentación; nombres de npm scripts (`test:unit`, `test:integracion`, `db:aplicar`, `admin:provisionar`, `smoke`) y variables de entorno (`REMITENTE_CORREO`).
- Como el contrato JSON y el SQL siguen en español, los repositorios (`data/`) mantienen el mapeo explícito entre tipos TS en inglés (`ElectionRow`) y columnas SQL en español (`creada_por_usuario_id`) sin traducir los literales.

## Brechas detectadas (código actual vs. doc de decisiones)

| # | Brecha | Evidencia actual |
|---|---|---|
| 1 | Rutas no coinciden con §10: `/elecciones/:id/voto` (debe ser `/votar`), `/elecciones/:id/resultados/suscripcion` GET (debe ser `POST /resultados/:id/suscripcion`), `/elecciones/:id/delegacion` (debe ser `/proclamar`), `/delegaciones/:id/periodo-evaluacion` (debe ser `POST /evaluaciones/periodos`), `GET /auditoria` (debe ser `GET /auditoria/elecciones/:id`) | `backend/src/presentacion/rutas/*.ts` |
| 2 | Falta `POST /api/elecciones/:id/cerrar` (cierre manual anticipado §6.1); solo existe el cierre automático del planificador | `elecciones.rutas.ts` (no hay ruta `cerrar`), `planificador.ts` |
| 3 | Falta `POST /api/secciones/unirse` por código `SEC-XXXX` (§3.1) y el código no se auto-genera (lo exige el DTO del cliente) | `elecciones.dto.ts:61` (`codigo` requerido), `secciones.rutas.ts` |
| 4 | Resultados en vivo y ticket de suscripción restringidos a estudiantes; el doc §5.1 exige acceso también para docente (proyector) y admin | `resultados.casos.ts:23-32, 60-66` |
| 5 | Ticket HMAC estático (sin vigencia); el doc §5.1 exige ticket efímero de 60 s | `realtime.ts:33-41` |
| 6 | Desempate: el trigger valida el empate, pero falta asistencia "Iniciar Desempate" (auto-cargar candidatos empatados, ventana 15–30 min). La validación de que las candidaturas de la derivada sean solo las empatadas ya existe (`controlar_configuracion_electoral` + `activar_eleccion`) | `electoral.casos.ts:14`, `sql/001:369-452,501-513,688-700` |
| 7 | Correo por nodemailer/SMTP; el doc §2.1 fija Resend con remitente `seguridad@votesecureapp.com` | `correo.ts` |
| 8 | Registro sin validación de regex UTP por rol (§2.1) | `auth.dto.ts:11` (solo `.email()`) |
| 9 | `periodos_evaluacion` sin columna `instrucciones` (§7.1 exige instrucciones/criterios del docente) | `sql/001:191-201` |
| 10 | Dependencias con prefijos `^`; §9.1 exige versiones exactas + `npm ci` | `backend/package.json` |

Ya cumplido (solo verificar, no reimplementar): Argon2id, sesiones hash SHA-256 revocables, CSRF double-submit, `registrar_voto` anónimo (tabla `votos` sin identidad), `activar_eleccion` con congelamiento de padrón, `cerrar_y_publicar_resultados` con chequeo `participantes = votos`, vista `resumen_resultados_publicados` (`ganador/empate/sin_votos`), triggers de inmutabilidad, roles de DB mínimos, `crear_usuario` bloquea admin, `programar_eleccion` exige ≥2 candidaturas, evaluación 1–10 con CHECKs y UNIQUE de voto único, planificador de activación/cierre automático, payload `CargaResultado` idéntico al del doc.

> Nota: la tabla de brechas cita los archivos con sus nombres **actuales** (en español) como evidencia; tras la Fase 0 esos archivos existen con los nombres ingleses de la fase correspondiente.

## Fases de implementación

### Fase 0 — Renombrado a inglés por módulos (AGENTS.md)

Renombrado **puro, sin cambio de comportamiento ni de rutas URL**: archivos, carpetas e identificadores, ejecutado módulo a módulo (una tanda por módulo) y verificado con build + tests tras cada tanda.

| Tanda | Actual | Nuevo |
|---|---|---|
| Carpetas | `src/presentacion/{rutas,dto,middleware}` | `src/presentation/{routes,dto,middleware}` |
| | `src/aplicacion/{casos-uso,servicios}` | `src/application/{use-cases,services}` |
| | `src/datos/repositorios` | `src/data/repositories` |
| | `src/compartido` | `src/shared` |
| | `tests/unitarias`, `tests/integracion` | `tests/unit`, `tests/integration` |
| presentación | `contexto.ts` | `context.ts` |
| | `rutas/{index,auth,elecciones,secciones,evaluaciones,auditoria}.rutas.ts` | `routes/{index,auth,election,section,evaluation,audit}.routes.ts` |
| | `dto/elecciones.dto.ts`, `dto/evaluacion.dto.ts` | `dto/election.dto.ts`, `dto/evaluation.dto.ts` |
| | `middleware/{validar,limites,sesion,errores}.ts` | `middleware/{validate,rate-limits,session,errors}.ts` |
| aplicación | `politicas.ts` | `policies.ts` |
| | `casos-uso/{auth,electoral,voto,resultados,evaluacion,academicos,auditoria}.casos.ts` | `use-cases/{auth,election,vote,result,evaluation,academic,audit}.use-cases.ts` |
| | `servicios/{correo,sesiones,planificador,contrasenas}.ts` | `services/{mail,sessions,scheduler,passwords}.ts` |
| datos | `repositorios/{usuarios,votos,elecciones,evaluaciones,resultados,auditoria,academicos}.repo.ts` | `repositories/{user,vote,election,evaluation,result,audit,academic}.repo.ts` |
| compartido | `compartido/errores.ts` | `shared/errors.ts` |
| tests | `unitarias/{roles,sesiones,dto-auth,contrasenas}.test.ts` | `unit/{roles,sessions,auth.dto,passwords}.test.ts` |
| | `integracion/{flujo-electoral,http-api}.test.ts` | `integration/{election-flow,http-api}.test.ts` |
| scripts | `provisionar-admin.ts`, `dev/verificar-flujo.ts`, `db/aplicar-sql.ts` | `provision-admin.ts`, `dev/verify-flow.ts`, `db/apply-sql.ts` |

Sin cambio de nombre: `src/{app,index}.ts`, `src/config/{env,logger}.ts`, `src/datos/db.ts`, `src/application/services/{realtime,roles}.ts`, `middleware/csrf.ts`, `dto/auth.dto.ts`, `backend/sql/*.sql`.

**Glosario de dominio** (para que el renombrado de identificadores no derive): elección→`election`, sección→`section`, candidatura→`candidacy`, habilitación de voto→`eligibility` (`Enrollment`…), matrícula→`enrollment`, asignación docente→`assignment`, delegación→`delegation`, delegado→`delegate`, periodo de evaluación→`evaluation period`, voto→`vote`, resultados→`result(s)`, auditoría→`audit`, usuario→`user`, sesión→`session`, contraseña→`password`, correo→`email`, desempate→`tiebreak`, proclamación→`proclamation`, padrón→`electorate`, planificador→`scheduler`, publicador→`publisher`. Ejemplos de renombrado de exportaciones: `crearEleccion`→`createElection`, `cerrarYPublicar`→`closeAndPublish`, `unirseASeccion`→`joinSection`, `proclamarDelegado`→`proclaimDelegate`, `PublicadorResultados`→`ResultsPublisher`, `AdaptadorCorreo`→`MailAdapter`, `CargaResultado`→`ResultLoad` (solo el tipo TS; la forma JSON del payload no cambia).

**Archivos de configuración que cambian en la misma tanda** (críticos):

- `backend/.dependency-cruiser.cjs`: rutas de capas `^src/presentacion|aplicacion|datos` → `^src/presentation|application|data` y nombres de reglas a inglés (`presentacion-no-accede-a-datos` → `presentation-must-not-import-data`); los `comment` siguen en español.
- `backend/package.json`: solo los **argumentos** de los scripts (los nombres de script no cambian): `test:unit` → `vitest run tests/unit`, `test:integracion` → `vitest run tests/integration`, `db:aplicar` → `tsx scripts/db/apply-sql.ts`, `admin:provisionar` → `tsx scripts/provision-admin.ts`, `smoke` → `tsx scripts/dev/verify-flow.ts`.
- Todos los `import` relativos de `src/`, `tests/` y `scripts/`.
- `tsconfig.json` **no cambia** (usa `["src","scripts","tests"]`); `scripts/db/apply-sql.ts` itera `sql/*.sql` por extensión, así que los SQL conservan su nombre sin efecto.

**Verificación de la Fase 0:** tras cada tanda, `npm run lint && npm run deps:check && npm test && npm run build` sin errores; `npm run smoke` funcional al final. Revisar el diff de `*.routes.ts` para confirmar que ninguna ruta URL cambió.

### Fase 1 — Contrato API exacto §10
Archivos: `backend/src/presentation/routes/{election,section,evaluation,audit}.routes.ts`, `backend/src/presentation/dto/*.dto.ts`
1. Renombrar `POST /elecciones/:id/voto` → `POST /elecciones/:id/votar` (`election.routes.ts:212`).
2. Añadir `POST /elecciones/:id/cerrar` (rol Docente/Admin): nuevo caso `closeElection` en `election.use-cases.ts` que delega en `electionsRepo.closeAndPublish` (ya existe, `election.repo.ts:354`) y publica la carga final vía `ctx.publisher`.
3. Mover el ticket de suscripción a `POST /resultados/:id/suscripcion` (handler actual `subscriptionTicket` en `result.use-cases.ts`, cambiar GET→POST como indica §10).
4. Renombrar `POST /elecciones/:id/delegacion` → `POST /elecciones/:id/proclamar` (mismo handler `proclaimDelegate`).
5. Renombrar `POST /delegaciones/:id/periodo-evaluacion` → `POST /evaluaciones/periodos` (Docente/Admin), body `{ delegacionId, abreEn, cierraEn, instrucciones }` (ver Fase 7).
6. Cambiar `GET /auditoria` → `GET /auditoria/elecciones/:id`, rol exclusivo `administrador` (verificar/crear chequeo de rol en `audit.use-cases.ts`).
7. **Decisión:** las rutas actuales adicionales (`/programar`, `/cancelar`, `/candidaturas`, `/habilitaciones`, `/elecciones/activas`, `PATCH /elecciones/:id`) se **conservan** como rutas complementarias: las exigen las reglas de negocio §3.2 (gestión de candidaturas y borradores) aunque no figuren en la matriz; documentarlas como anexo. La matriz §10 se cumple literalmente en rutas y roles.

### Fase 2 — Secciones: código auto-generado y unirse por código (§3.1)
Archivos: `academic.use-cases.ts`, `academic.repo.ts`, `section.routes.ts`, `election.dto.ts`
1. Auto-generar el código al crear la sección: formato `SEC-XXXX` (4 caracteres A–Z y 2–9, excluyendo ambiguos `0/O/1/I/L`), generado en `createSection` con reintento ante colisión única. Quitar `codigo` del `sectionSchema` (o hacerlo opcional ignorado).
2. Nuevo endpoint `POST /api/secciones/unirse` (Estudiante, correo verificado), body `{ codigo }`:
   - Buscar sección por código; error si no existe.
   - Error si `secciones.activa = false` ("Bloquear inscripciones"; el toggle `PATCH /secciones/:id` con `activationToggleSchema` ya existe — verificar cableado).
   - Insertar matrícula (el UNIQUE existente previene duplicados) → respuesta con datos de la sección.
3. Caso `joinSection` en `academic.use-cases.ts` + consulta por código en `academic.repo.ts`.

### Fase 3 — Resultados en vivo para docente/admin + ticket HMAC efímero (§5.1)
Archivos: `result.use-cases.ts`, `realtime.ts`, `election.routes.ts`
1. Ampliar `getResults` y `subscriptionTicket`: además de estudiantes habilitados, permitir docente asignado a la sección y administrador (proyector de aula). Los no miembros siguen sin acceso en estado `activa`.
2. Ticket con vigencia de 60 s en `ResultsPublisher`:
   - `ticket = HMAC-SHA256(secreto, "eleccion:{id}:exp:{expUnix}")` con `expUnix = ahora + 60 s`; la respuesta incluye `{ canal, expiraEn }`.
   - `publish()` envía a los canales de la ventana actual y la anterior (cada ventana = minuto), para que los suscriptores en vuelo no pierdan eventos al rotar el ticket.
   - El nombre de canal sigue siendo `resultados:{eleccionId}:{hmacTicket}` y el payload `ResultLoad` ya cumple el formato del doc (solo el tipo TS se renombra; la forma JSON no cambia).
3. El frontend deberá invocar el POST y suscribirse antes de `expiraEn` (contrato a documentar; frontend fuera de alcance).

### Fase 4 — Desempate asistido de un clic (§6.2)
Archivos: `election.use-cases.ts`, `election.dto.ts`, `result.repo.ts`, `election.repo.ts`
1. En `createElection`, cuando `tipo='desempate'`:
   - Validar ventana `cierraEn - iniciaEn` entre 15 y 30 minutos (regla de negocio en Zod).
   - Auto-insertar las candidaturas de los candidatos empatados en primer lugar (leer `resultados_candidatos` de la elección origen vía `resultsRepo`, en la misma transacción de creación) — esto materializa el botón "Iniciar Desempate". Pre-chequeo de negocio: la origen debe estar publicada con situación `empate` (422 `NEGOCIO`).
2. **Cambio SQL — innecesario (verificado nov 2026):** el subconjunto exacto de candidatos empatados ya está reforzado en `001_esquema_oficial.sql`: `controlar_configuracion_electoral` exige por fila que cada candidatura de un `desempate` corresponda a un candidato con `votos_obtenidos = max` en la origen (líneas 501-513), y `activar_eleccion` exige que el conteo de candidaturas sea igual al de candidatos empatados (líneas 688-700), lo que fija el conjunto exacto. No se requiere patch ni aprobación de DBA.

### Fase 5 — Correo con Resend (§2.1)

> Estado (nov 2026): **completada.** Implementada con `fetch` nativo de Node.js contra `POST https://api.resend.com/emails`, sin dependencias nuevas; se descartaron nodemailer y el SDK npm de Resend (arrastra React/peer-deps) y se retiró `SMTP_URL`. Bypass de desarrollo aplicado: `ResendMailAdapter` solo se usa con `NODE_ENV=production` + `RESEND_API_KEY`; en development/test se loguea el enlace (adaptador consola), de modo que `npm run smoke` y las pruebas nunca envían correos reales. Flujo de token verificado: `randomBytes(32)` (base64url), solo SHA-256 (32 bytes) en `verificacion_hash`, expiración 24 h en `verificacion_expira_en`. Variables `RESEND_API_KEY` y `REMITENTE_CORREO` en `env.ts` y `.env.example` con origen comentado; dominio `votesecureapp.com` (DNS en Cloudflare) verificado en Resend para SPF/DKIM/DMARC.
Archivos: `mail.ts`, `config/env.ts`, `.env.example`, `package.json`
1. Comparativa corta de opciones:
   1. **HTTP API de Resend con `fetch` nativo (recomendada):** cero dependencias nuevas, misma interfaz `MailAdapter`, alineada con §9.1 (versiones fijas).
   2. SDK `resend`: más ergonómico pero añade dependencia y su API cambia.
   3. SMTP vía nodemailer: el doc menciona API/SMTP, pero mantener nodemailer conserva un transporte redundante.
2. Implementar `ResendMailAdapter` con `POST https://api.resend.com/emails`, remitente `seguridad@votesecureapp.com`, y **eliminar nodemailer + @types/nodemailer** (taste: el stack obsoleto se borra, no se preserva).
3. Conservar el bypass de desarrollo (`NODE_ENV=development` → log con enlace) y verificar el flujo de token: `crypto.randomBytes(32)`, almacenar solo `SHA-256` (32 bytes) en `verificacion_hash`, expiración 24 h en `verificacion_expira_en`.
4. Variables: añadir `RESEND_API_KEY` y `REMITENTE_CORREO` a `env.ts`, `.env.example` y `.env` con placeholders comentados (taste: template claro con origen de cada valor); retirar `SMTP_URL`.

### Fase 6 — Registro con regex UTP por rol (§2.1)

> Estado (nov 2026): **completada.** La derivación de `tipo_usuario` del prefijo (`deriveUserTypeFromEmail` en `roles.ts`, con los regex del doc) ya existía en `registerUser`; se añadió la validación en `registerSchema` (400 `VALIDACION` reutilizando el mismo `deriveUserTypeFromEmail`, sin duplicar regex). Registro de administrador imposible: `deriveUserTypeFromEmail` solo devuelve estudiante/docente y `crear_usuario` lo bloquea en SQL.
Archivos: `auth.dto.ts`, `auth.use-cases.ts`, tests
1. Validar correo en `registerSchema` con los regex del doc: `^u[a-z0-9._%+-]*@utp[.]edu[.]pe$` (estudiante), `^c[a-z0-9._%+-]*@utp[.]edu[.]pe$` (docente); derivar `tipo_usuario` del prefijo. El registro de administrador queda imposible (ya bloqueado en `crear_usuario`).

### Fase 7 — Instrucciones del periodo de evaluación (§7.1)
Archivos: `sql/001_esquema_oficial.sql` (patch), `evaluation.dto.ts`, `evaluation.use-cases.ts`, `evaluation.repo.ts`
1. **Cambio SQL** (aprobación del usuario como DBA): `ALTER TABLE periodos_evaluacion ADD COLUMN instrucciones varchar(1000) NOT NULL CHECK (length(btrim(instrucciones)) BETWEEN 20 AND 1000);` (o varchar opcional si se prefiere; el doc dice "instrucciones/criterios específicos" al abrir).
2. Añadir `instrucciones` al `evaluationPeriodSchema` (20–1000 chars) y al caso/repo.
3. Verificación (sin cambios si ya se cumple): comentario estudiante ≤500 opcional y docente 20–1000 obligatorio (ya en `evaluation.use-cases.ts:57,78` y CHECKs SQL), `UNIQUE (periodo_evaluacion_id, matricula_id)`, promedio `ROUND(AVG(calificacion), 2)` en `evaluationSummary`, delegado solo ve su promedio post-cierre y nunca evaluadores individuales (`viewDelegate`).

### Fase 8 — Reproducibilidad (§9.1)
1. Fijar versiones exactas en `backend/package.json` (quitar `^`/`~`), regenerar `package-lock.json` y validar con `npm ci`.
2. Nota final: el frontend quedará desalineado (usa JWT/Socket.IO/organizaciones) — fuera de alcance de este plan; dejar constancia para un plan posterior del frontend.

### Fase 9 — Tests y verificación
1. Actualizar `scripts/dev/verify-flow.ts` (smoke) y `tests/integration/*` para las rutas renombradas.
2. Nuevos tests:
   - Unitarias: regex UTP por rol, generación `SEC-XXXX`, vigencia del ticket HMAC, validación de ventana 15–30 min del desempate.
   - Integración (requieren `TEST_DATABASE_URL`): unirse por código (incluye sección bloqueada), `POST /elecciones/:id/votar`, cierre manual anticipado, suscripción con ticket y su expiración, flujo de desempate con candidatos empatados, `GET /auditoria/elecciones/:id` (403 para no admin), periodo de evaluación con instrucciones.
3. Ejecutar en orden: `npm ci` → `npm run lint` → `npm run deps:check` → `npm test` → `npm run build` → `npm run db:aplicar` (BD de prueba) → `npm run smoke`.

### Fase 10 — Documentación (cascada de actualización)
1. `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`: sin cambios de decisiones (el código se alinea al doc); añadir anexo de rutas complementarias (Fase 1.7) y corregir la referencia `002_operaciones.sql` → `002_operaciones_y_roles.sql`.
2. Actualizar `backend/.env.example` con las variables nuevas (Resend) y comentarios de origen.

## Archivos críticos a modificar
- Fase 0 (transversal, previa a todo): `backend/src/**`, `backend/tests/**`, `backend/scripts/**`, `backend/.dependency-cruiser.cjs`, `backend/package.json` (solo argumentos de scripts).
- `backend/src/presentation/routes/election.routes.ts` (Fases 1, 3)
- `backend/src/presentation/routes/section.routes.ts` (Fases 1, 2)
- `backend/src/presentation/routes/evaluation.routes.ts`, `audit.routes.ts` (Fase 1)
- `backend/src/application/use-cases/{election,result,academic,evaluation,auth}.use-cases.ts`
- `backend/src/application/services/{realtime,mail}.ts`
- `backend/src/data/repositories/{academic,result,evaluation}.repo.ts`
- `backend/src/presentation/dto/{auth,election,evaluation}.dto.ts`
- `backend/sql/001_esquema_oficial.sql` (patch de la Fase 7 — con aprobación del usuario como DBA; la Fase 4 no necesita SQL)
- `backend/package.json`, `backend/.env.example`, `backend/src/config/env.ts`
- `backend/tests/**`, `backend/scripts/dev/verify-flow.ts`

## Verificación global
0. Tras la Fase 0: `npm run lint && npm run deps:check && npm test && npm run build` sin errores y sin ningún cambio en rutas URL (diff de `*.routes.ts` vacío en ese sentido).
1. `npm ci && npm run lint && npm run deps:check && npm test && npm run build` sin errores.
2. `npm run smoke` recorre el flujo completo: registro → verificación (bypass dev) → login → crear sección (código auto) → unirse por código → candidaturas → programar → activar → votar → resultados en vivo → cerrar → proclamar → evaluar → auditoría.
3. Verificar que ningún SELECT de `votos` exista fuera de `contar_votos_eleccion`/funciones (invariante de secreto del voto) y que `eventos_auditoria` no sea insertable por `votesecure_api`.

## Supuestos
- La convención de nomenclatura de `AGENTS.md` se aplica vía la Fase 0: archivos, carpetas, funciones, tipos y variables en inglés; rutas URL, claves/literales JSON del contrato, objetos SQL y archivos `sql/00*.sql`, comentarios/mensajes/docs y nombres de npm scripts se quedan como están (los scripts están documentados en `AGENTS.md`; los SQL son referenciados por el doc de decisiones).
- Las rutas extra del código actual se conservan como complementarias (las reglas §3.2 las requieren); la matriz §10 se cumple literalmente.
- `periodos_evaluacion` sigue siendo un periodo único por delegación (`UNIQUE(delegacion_id)`); "semana 8 o semana 16" se interpreta como discrecionalidad de cuándo abrirlo, no como periodos múltiples.
- La ventana del balotaje se valida en la capa de aplicación; el trigger SQL solo valida el empate y el subconjunto de candidatos.
- Ejecución continua end-to-end sin aprobaciones por fase, excepto el patch SQL de la Fase 7 que se presenta al usuario (autoridad DBA) antes de aplicar.
