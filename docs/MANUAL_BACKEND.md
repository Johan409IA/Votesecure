# VoteSecure — Manual del Backend

**Versión:** 1.0 · **Fecha:** Noviembre 2026 · **Alcance:** Backend de producción v1.0

Este manual explica, de forma práctica, todo lo que ofrece el backend de VoteSecure (sistema electoral universitario de la UTP): sus funcionalidades, los roles de usuario, la arquitectura por capas, cada endpoint de la API, las tablas de la base de datos y los mecanismos transversales (Realtime, planificador, seguridad). Para las decisiones oficiales de diseño, consultar `docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`.

---

## 1. ¿Qué es VoteSecure?

Un sistema para **elegir al delegado de cada sección académica mediante votación electrónica** y **evaluar su desempeño** durante el ciclo. Sustituye el conteo a mano alzada por un proceso:

- **Confidencial**: es imposible vincular a un estudiante con el voto que emitió.
- **Auditable**: todo el ciclo electoral queda registrado en un log inmutable.
- **En vivo**: los resultados se difunden en tiempo real durante la clase.
- **Con cierre formal**: los resultados finales son una instantánea inmutable y la proclamación exige un ganador único.

## 2. Stack y comandos

| Componente | Tecnología |
|---|---|
| Runtime | Node.js + Express 4 + TypeScript estricto |
| Validación | Zod (en la capa de presentación) |
| Contraseñas | Argon2id (`@node-rs/argon2`) |
| Base de datos | PostgreSQL en Supabase (conexión por pooler, `SET ROLE` transaccional) |
| Correo | Resend (verificación de correo institucional) |
| Tiempo real | Supabase Realtime Broadcast |
| Pruebas | Vitest (unitarias + integración) |

Comandos (dentro de `backend/`): `npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run test:unit`, `npm run test:integracion` (requiere `TEST_DATABASE_URL`), `npm run lint`, `npm run deps:check`, `npm run db:aplicar`, `npm run admin:provisionar`, `npm run seed:demo`, `npm run smoke`.

---

## 3. Roles y funcionalidades

Existen exactamente **tres roles mutuamente excluyentes**. El rol se **deriva del correo institucional** al registrarse (`application/services/roles.ts`):

- Correo que empieza con `u` (`u...@utp.edu.pe`) → **estudiante**
- Correo que empieza con `c` (`c...@utp.edu.pe`) → **docente**
- **Administrador**: nunca se registra por la API pública; se crea solo con la CLI `npm run admin:provisionar -- --correo <correo> --nombre <nombre> --contrasena <clave 15+>` (rol de BD privilegiado `votesecure_provisionamiento`). El correo **no tiene que ser UTP**: sirve cualquier correo válido (p. ej. un Gmail real). La CLI **envía el enlace de verificación (24 h) por correo** — Resend en producción, o en desarrollo con `CORREO_REAL_EN_LOCAL=true` — y además lo imprime en consola por si el envío falla; ojo: `POST /api/auth/reenviar-verificacion` **solo acepta correos UTP**, así que si el enlace vence la única salida es volver a provisionar con otro correo (o recrear la fila en BD). Todos los roles inician sesión en el **mismo formulario** (`POST /api/auth/login`); el frontend distingue al admin por `usuario.tipo === 'administrador'`.

Casi todas las funcionalidades exigen además el **correo verificado** (confirmación por enlace enviado con Resend, válida 24 h; se puede reenviar con `POST /api/auth/reenviar-verificacion`).

**Cómo se crea el administrador, en pasos simples:**

1. Se elige el correo real de quien administrará (cualquiera válido, Gmail incluido) y una **contraseña de 15 caracteres o más**: esa "clave 15+" es la **contraseña de la cuenta** con la que se entrará al login (es la regla mínima del backend para todos los roles), no tiene nada que ver con la contraseña del correo.
2. Se ejecuta una sola vez `npm run admin:provisionar -- --correo <correo> --nombre <nombre> --contrasena <clave>`: la CLI se conecta a la base de **Supabase** y guarda la cuenta en la tabla `usuarios` con tipo `administrador` (lo hace bajo el privilegio `votesecure_provisionamiento`, el único camino por el que puede existir un admin; el registro público lo prohíbe).
3. La CLI **envía el enlace de verificación a ese correo** (y lo imprime en consola por si el envío falla); al abrir el enlace, la cuenta queda verificada y lista.
4. Se entra por el **mismo formulario de login** que estudiantes y docentes; el frontend decide las pantallas de admin según `usuario.tipo === 'administrador'`. No hay registro ni pantalla de login separados.

**Datos de demostración:** `npm run seed:demo -- --contrasena <clave de 15+ caracteres>` crea (solo en desarrollo, idempotente) un admin (`admin.demo@votesecureapp.com`), un docente (`c2026001@utp.edu.pe`), 8 estudiantes (`u2026001@utp.edu.pe` … `u2026008@utp.edu.pe`, el 8 sin matricular para probar el auto-matrícula), la sección `SEC-DM25` y una elección ya **activa y lista para votar** (activada con `programar_eleccion` + `activar_eleccion`, sin votos). Todos los correos salen verificados y comparten la contraseña indicada.

### 3.1 Estudiante — participa

| Funcionalidad | Cómo funciona |
|---|---|
| Registrarse y verificar correo | Registro con correo UTP; confirmación por enlace (token de 32 bytes, hash SHA-256 en BD). |
| Unirse a una sección | Único rol que puede auto-matricularse con el código de aula `SEC-XXXX` (con rate-limit propio anti fuerza bruta). |
| Ver sus secciones | Solo las secciones donde tiene matrícula activa. |
| Ver elecciones activas | Elecciones de sus secciones listas para votar. |
| **Votar** | Un voto anónimo, atómico e irrevocable por elección, solo si figura en el padrón congelado (`habilitaciones_voto`). |
| Ver resultados en vivo | Cómputo agregado en tiempo real si está habilitado; resultados finales al cerrarse. |
| Suscribirse al canal Realtime | Solicita un ticket efímero (60 s) para recibir actualizaciones push. |
| Evaluar al delegado | Nota 1–10 + comentario opcional (≤ 500 caracteres), un envío por periodo de evaluación, en secciones con matrícula activa. |
| Ver al delegado | Si él es el delegado, ve promedios solo de periodos ya cerrados y el promedio global; nunca a sus evaluadores. |
| Cambiar su contraseña | Exige la contraseña actual e invalida la sesión vigente. |

**No puede**: crear/gestionar secciones o elecciones, gestionar candidaturas o habilitaciones, programar/activar/cancelar/cerrar, proclamar, abrir periodos de evaluación, ver el resumen de evaluaciones, consultar auditoría, gestionar cuentas/matrículas/asignaciones.

### 3.2 Docente — organiza y dirige

Todo en **sus secciones** (aquellas donde tiene asignación activa en `asignaciones_docentes`; queda auto-asignado si él creó la sección):

| Funcionalidad | Cómo funciona |
|---|---|
| Crear secciones | Crea curso + periodo académico, recibe código `SEC-XXXX` y queda como responsable. |
| Bloquear inscripciones | Cierra la entrada con código antes de la elección para que no entren ajenos. |
| Crear elecciones | Elección principal o de **desempate** (deriva de una cerrada con empate). |
| Editar elección en borrador | Nombre y fechas (`inicia_en`, `cierra_en`). |
| Gestionar candidaturas | Alta/baja de candidatos elegidos entre matrículas activas de la sección (mín. 2 para programar). |
| Gestionar habilitaciones | Alta/baja manual de votantes del padrón antes de activar. |
| Ciclo de vida electoral | **Programar → Activar** (congela el padrón) → **Cancelar** (con motivo obligatorio) → **Cerrar** (manual anticipado o automático por horario). |
| Proclamar delegado | Solo si el resultado publicado tiene situación `ganador` (ganador único). |
| Abrir periodos de evaluación | Hasta 3 por ciclo y delegación, sin solaparse, con ventana e instrucciones. |
| Evaluar al delegado | Nota 1–10 + comentario **obligatorio** (20–1000 caracteres). |
| Ver resultados como "proyector de aula" | Cómputo en vivo de su sección para mostrar en clase. |
| Ver resumen de evaluaciones | Promedios por periodo, promedio global y comentarios de estudiantes **anonimizados**. |

**No puede**: votar, auto-matricularse como estudiante, crear matrículas, asignar/quitar docentes, activar/desactivar cuentas, consultar auditoría, gestionar secciones de otros docentes.

### 3.3 Administrador — administra globalmente

- Es **superusuario de todas las rutas anteriores**: pasa cualquier verificación de rol y de pertenencia a sección, y ve **todas** las secciones del sistema.
- **Exclusivas**:

| Funcionalidad | Cómo funciona |
|---|---|
| Activar/desactivar cuentas | `PATCH /api/usuarios/:id` (solo el campo `activo`); al desactivar, la sesión del usuario se revoca al instante. |
| Alta manual de matrículas | Inscribe directamente a un estudiante en una sección, sin código. |
| Activar/desactivar matrículas | Retira (o restituye) el acceso de un estudiante a una sección sin borrar el registro. |
| Asignar docentes a secciones | Da a un docente permisos de gestión sobre una sección. |
| Activar/desactivar asignaciones | Retira (o restituye) el control de un docente sobre una sección. |
| Consultar auditoría | Historial inmutable de eventos electorales de cualquier elección. |

- **No puede** (por regla de negocio, no por rol): evaluar delegados (403 «El administrador no evalua delegados»), votar, auto-matricularse ni registrarse por la API pública.

---

## 4. Arquitectura por capas

El backend sigue una **arquitectura por capas obligatoria**, verificada automáticamente con dependency-cruiser (`.dependency-cruiser.cjs`):

```
Presentación  →  Aplicación  →  Datos  →  PostgreSQL (Supabase)
     (compartido y config son transversales a todas)
```

Reglas de dependencia: la presentación **no** importa la capa de datos ni `pg`; la aplicación **no** depende de Express ni `pg`; los datos **no** importan la presentación.

### 4.1 `src/presentation` — Presentación (entrada HTTP)

Contiene lo que toca directamente Express y las peticiones:

- **`routes/`** — Un archivo por módulo (`auth.routes.ts`, `section.routes.ts`, `election.routes.ts`, `result.routes.ts`, `evaluation.routes.ts`, `audit.routes.ts`, `user.routes.ts`, `index.routes.ts`). Definen cada endpoint, aplican middlewares de sesión/rol y delegan en los casos de uso.
- **`dto/`** — Esquemas Zod de entrada (`auth.dto.ts`, `election.dto.ts`, `evaluation.dto.ts`, `common.dto.ts`). Toda entrada se valida aquí; nada inválido pasa a la aplicación.
- **`middleware/`** — Piezas reutilizables:
  - `session.ts`: `authenticate` (valida cookie de sesión contra la BD), `requireVerified` (correo confirmado; si no → 403), `requireRole(...)` (rol exacto; si no → 403).
  - `csrf.ts`: protección *Double-Submit Cookie/Header* (cabecera `X-CSRF-Token` en métodos mutantes + validación de `Origin`).
  - `rate-limits.ts`: límites de tasa (general, login, registro, unirse a sección).
  - `validate.ts`: ejecuta el esquema Zod del DTO.
  - `access-log.ts`: bitácora de acceso con `X-Request-Id` para correlación.
  - `errors.ts`: middleware final que traduce cualquier error al formato uniforme de la API.
- **`context.ts`** — Tipo `ApiContext`: inyección de dependencias (servicios de aplicación) hacia las rutas, para no acoplarlas a implementaciones concretas.

### 4.2 `src/application` — Aplicación (negocio)

Contiene las **reglas de negocio**, sin saber nada de HTTP:

- **`use-cases/`** — Un archivo por dominio: `auth.use-cases.ts` (registro, login, verificación, cambio de contraseña), `user.use-cases.ts` (activación de cuentas), `academic.use-cases.ts` (secciones, matrículas, asignaciones), `election.use-cases.ts` (ciclo electoral completo, candidaturas, habilitaciones, proclamación, desempate), `vote.use-cases.ts` (emisión del voto), `result.use-cases.ts` (resultados en vivo/finales y tickets Realtime), `evaluation.use-cases.ts` (periodos y evaluaciones del delegado), `audit.use-cases.ts` (consulta de auditoría).
- **`policies.ts`** — Autorización fina por pertenencia: `isAdmin`, `canManageSection` (admin o docente con asignación activa), `canViewSection` / `requireSectionAccess` (matrícula o asignación activa; un ajeno recibe 403 aunque sea docente o estudiante).
- **`services/`** — Servicios técnicos del dominio: `realtime.ts` (`ResultsPublisher`), `scheduler.ts` (`ElectionScheduler`), `mail.ts` (Resend), `passwords.ts` (Argon2id), `sessions.ts` (cookies y hash de sesión), `roles.ts` (rol según correo).

### 4.3 `src/data` — Datos (persistencia)

- **`db.ts`** — Pool de conexiones `pg`. Punto clave: **cada transacción abre con `BEGIN; SET LOCAL ROLE votesecure_api`** y con `statement_timeout` (10 s por defecto) y `lock_timeout` (3 s). Así la API opera siempre con el rol de mínimos privilegios, incluso ante inyección SQL, y los timeouts se revierten solos al cerrar la transacción. Traduce errores de PostgreSQL a errores de negocio (ej. violación de `UNIQUE` → 409 con mensaje legible).
- **`repositories/`** — **El único lugar donde hay SQL** (`academic.repo.ts`, `election.repo.ts`, `vote.repo.ts`, `result.repo.ts`, `evaluation.repo.ts`, `user.repo.ts`, `audit.repo.ts`). Llaman a las funciones `SECURITY DEFINER` de la BD y consultan tablas permitidas.

### 4.4 `src/shared` y `src/config` — Transversales

- **`shared/errors.ts`** — Jerarquía de errores (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessError`, …) usada por todas las capas.
- **`config/env.ts`** — Valida las variables de entorno con Zod al arrancar (falla rápido si falta algo o si en producción falta `RESEND_API_KEY` o el frontend no es HTTPS).
- **`config/logger.ts`** — Logging estructurado.
- **`app.ts` / `index.ts`** — Ensamblaje: orden de middlewares (log → cabeceras de seguridad → CORS → JSON → cookies → rate limit → CSRF → rutas `/api`), arranque del planificador y cierre ordenado.

---

## 5. Endpoints de la API

Todas las rutas cuelgan de `/api`. Las mutantes (`POST`, `PATCH`, `DELETE`) exigen la cabecera `X-CSRF-Token` (§2.2 del documento de decisiones). Errores uniformes: `{ "error": "<CODIGO>", "mensaje": "<texto>" }` con códigos `VALIDACION` (400), `NO_AUTENTICADO` (401), `PROHIBIDO` (403), `NO_ENCONTRADO` (404), `CONFLICTO` (409), `NEGOCIO` (422), `LIMITE` (429) e `INTERNO` (500).

> **Nota sobre permisos:** «Miembro» = matrícula o asignación **activa** en la sección (F-001); «Docente responsable» = docente con asignación activa o administrador.

### 5.1 Autenticación (`auth.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/api/auth/registro` | Público (rate-limit 10/h) | Registra estudiante o docente; valida formato de correo UTP; envía correo de verificación. |
| `POST` | `/api/auth/login` | Público (rate-limit 20/15 min) | Autentica con correo + contraseña (Argon2id); emite cookies `votecure_sesion` (HttpOnly) y `votecure_csrf`. |
| `POST` | `/api/auth/logout` | Autenticado | Revoca el hash de sesión en BD (efecto inmediato) y limpia cookies. |
| `POST` | `/api/auth/cambiar-contrasena` | Autenticado | Cambia la contraseña propia; exige la actual; **invalida la sesión vigente** (hay que volver a iniciar sesión). |
| `GET` | `/api/auth/verificar` | Público | Confirma el correo con `?correo=&token=`; redirige a `FRONTEND_URL/verificar-correo?estado=ok\|error`. |
| `POST` | `/api/auth/reenviar-verificacion` | Público (rate-limit 10/h) | Reenvía el enlace de verificación; respuesta idéntica exista o no la cuenta (sin enumeración) y cooldown de 60 s por cuenta en BD. |
| `GET` | `/api/auth/yo` | Autenticado | Devuelve el perfil de sesión: `{ id, nombre, correo, tipo, correoVerificado, fotoUrl }` (`fotoUrl` = data URL JPEG o `null`). |

### 5.2 Secciones y membresías (`section.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `GET` | `/api/secciones` | Autenticado | Lista las secciones del usuario (estudiante: sus matrículas; docente: sus asignaciones; admin: todas). |
| `POST` | `/api/secciones/unirse` | **Estudiante** (rate-limit 10/h) | Auto-matrícula con código `SEC-XXXX`; falla si la sección está bloqueada o el código no existe. |
| `POST` | `/api/secciones` | Docente / Admin | Crea sección (curso + periodo + código generado); el docente queda auto-asignado como responsable. |
| `GET` | `/api/secciones/:id` | Miembro / Admin | Detalle de la sección. |
| `PATCH` | `/api/secciones/:id` | Docente responsable / Admin | Editar sección y **bloquear inscripciones** (`activa`). |
| `GET` | `/api/secciones/:id/matriculas` | Miembro / Admin | Lista de estudiantes matriculados. |
| `POST` | `/api/secciones/:id/matriculas` | **Administrador** | Alta manual de matrícula (`estudianteId`). |
| `PATCH` | `/api/matriculas/:id` | **Administrador** | Activar/desactivar una matrícula (`activa`). |
| `GET` | `/api/secciones/:id/asignaciones` | Miembro / Admin | Lista de docentes asignados. |
| `POST` | `/api/secciones/:id/asignaciones` | **Administrador** | Asignar un docente a la sección (`docenteId`). |
| `PATCH` | `/api/asignaciones/:id` | **Administrador** | Activar/desactivar una asignación (`activa`). |

### 5.3 Elecciones y ciclo electoral (`election.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `GET` | `/api/elecciones?seccionId=` | Miembro / Admin | Lista elecciones de la sección (incluye borradores para gestión). |
| `GET` | `/api/elecciones/activas` | **Estudiante** | Elecciones activas de sus secciones, listas para votar. |
| `POST` | `/api/elecciones` | Docente / Admin | Crea elección principal o de desempate en `borrador`. |
| `GET` | `/api/elecciones/:id` | Miembro / Admin | Detalle, candidaturas y estado. |
| `PATCH` | `/api/elecciones/:id` | Docente responsable / Admin | Edita nombre/fechas **solo en borrador**. |
| `POST` | `/api/elecciones/:id/candidaturas` | Docente responsable / Admin | Registra candidatura sobre una matrícula activa de la sección. |
| `DELETE` | `/api/elecciones/:id/candidaturas/:candidaturaId` | Docente responsable / Admin | Retira candidatura (solo antes de programar). |
| `POST` | `/api/elecciones/:id/habilitaciones` | Docente responsable / Admin | Habilita manualmente a un votante (antes de activar). |
| `DELETE` | `/api/elecciones/:id/habilitaciones/:habilitacionId` | Docente responsable / Admin | Retira la habilitación (antes de activar). |
| `POST` | `/api/elecciones/:id/programar` | Docente responsable / Admin | Pasa a `programada`; exige ≥ 2 candidaturas y horario válido. |
| `POST` | `/api/elecciones/:id/activar` | Docente responsable / Admin | **Congela el padrón** (genera `habilitaciones_voto` masivamente) y abre la votación; registra auditoría `activacion` (actor `sistema`). |
| `POST` | `/api/elecciones/:id/cancelar` | Docente responsable / Admin | Cancela con `motivo` obligatorio; auditoría `cancelacion` (actor `usuario`). |
| `POST` | `/api/elecciones/:id/cerrar` | Docente responsable / Admin | Cierre manual anticipado; valida consistencia y publica la instantánea. |
| `POST` | `/api/elecciones/:id/proclamar` | Docente responsable / Admin | Proclama delegado solo si la situación publicada es `ganador`; crea la fila en `delegaciones`. |

### 5.4 Votación y resultados (`election.routes.ts`, `result.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/api/elecciones/:id/votar` | **Estudiante** | Emite el voto vía la función `registrar_voto` (atómica y anónima); exige habilitación en el padrón congelado y elección `activa` dentro de la ventana. |
| `GET` | `/api/elecciones/:id/resultados` | Miembro / Admin | Cómputo **en vivo** (solo habilitados; incluye `yaVoto`) o **final** (instantánea publicada) según el estado. |
| `POST` | `/api/resultados/:id/suscripcion` | Miembro / Admin | Devuelve `{ canal, expiraEn }`: ticket HMAC efímero (60 s) para suscribirse al canal de Supabase Realtime. |

### 5.5 Evaluaciones del delegado (`evaluation.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/api/evaluaciones/periodos` | Docente responsable / Admin | Abre un periodo de evaluación (`abre_en`, `cierra_en`, instrucciones); máx. 3 por delegación y ciclo, sin solaparse (422 si se incumple). |
| `POST` | `/api/evaluaciones` | Estudiante / Docente | Registra nota 1–10 + comentario (estudiante: opcional ≤ 500; docente: obligatorio 20–1000); un envío único por periodo (409 si repite). |
| `GET` | `/api/evaluaciones/delegado` | Autenticado | Para el delegado: promedios **solo de periodos cerrados** y promedio global; jamás identifica evaluadores. |
| `GET` | `/api/evaluaciones/resumen?seccionId=` | Docente de la sección / Admin | Reporte con `periodos[]`, bloque `global` y comentarios estudiantiles **anonimizados**. |

### 5.6 Administración y auditoría (`user.routes.ts`, `audit.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `GET` | `/api/usuarios?busqueda=&tipo=` | **Administrador** | Lista y busca cuentas (nombre o correo, filtro por tipo, tope 500); devuelve `{ id, nombre, correo, tipo, correoVerificado, activa }` sin hashes ni fotos. |
| `POST` | `/api/usuarios/yo/foto` | Autenticado | Guarda la foto de perfil propia: `{ imagen: "data:image/jpeg;base64,..." }` (JPEG base64, máx. 90 000 caracteres); valida además la firma real del JPEG. |
| `DELETE` | `/api/usuarios/yo/foto` | Autenticado | Elimina la foto de perfil propia. |
| `PATCH` | `/api/usuarios/:id` | **Administrador** | Activa/desactiva cuentas (`activa`); al desactivar, un trigger de BD revoca la sesión al instante. |
| `GET` | `/api/auditoria/elecciones/:id` | **Administrador** | Historial inmutable de eventos de la elección (solo lectura). |

### 5.7 Utilidades (`index.routes.ts`)

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `GET` | `/api/salud` | Público | Health check para el despliegue. |

---

## 6. Base de datos (PostgreSQL en Supabase)

Fuentes de verdad: `backend/sql/001_esquema_oficial.sql` (esquema) y `002_operaciones_y_roles.sql` … `009_foto_y_reenvio_verificacion.sql` (migraciones). Convención: tablas, columnas y funciones en **español**. Todas las claves primarias son `bigint` con identidad automática. `009` añade `usuarios.foto` (data URL JPEG, máx. 90 000 caracteres) y las funciones `SECURITY DEFINER` `actualizar_foto_usuario` y `regenerar_verificacion` (con cooldown de 60 s). Para aplicar solo una migración: `npm run db:aplicar -- --solo 009_foto_y_reenvio_verificacion.sql` (la aplicación completa no es idempotente).

### 6.1 Diagrama de relaciones (resumen)

```
usuarios ─┬─< matriculas >────── secciones ──────< asignaciones_docentes >─┐
          │                        │                                       │
          │                        └───────────< elecciones <──────────────┘ (creada/cancelada por usuario)
          │                                      │
          │                 ┌────────────────────┼──────────────────────┐
          │                 │                    │                      │
          │            candidaturas      habilitaciones_voto       eventos_auditoria
          │                    │                    │
          │                    └────< votos ────────┘  (voto sin identidad)
          │                                      │ (al cerrar)
          │                 resultados_electorales ──< resultados_candidatos
          │                                      │
          │                              delegaciones ──< periodos_evaluacion
          │                                                   │
          └────────────────────── evaluaciones_estudiantes ───┴── evaluaciones_docentes
```

### 6.2 Tablas y campos

#### `usuarios` — cuentas del sistema

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `nombre` | varchar(120) | Nombre completo (no vacío). |
| `correo` | varchar(254) UNIQUE | Correo institucional, siempre en minúsculas y sin espacios. |
| `tipo_usuario` | varchar(13) | `estudiante`, `docente` o `administrador`. |
| `hash_contrasena` | varchar(255) | Hash **Argon2id** (nunca texto plano). |
| `correo_verificado_en` | timestamptz | Momento de confirmación del correo (NULL = sin verificar). |
| `verificacion_hash` | bytea | Hash SHA-256 del token de verificación (32 bytes cuando existe). |
| `verificacion_expira_en` | timestamptz | Caducidad del token (24 h). |
| `sesion_hash` | bytea | Hash SHA-256 del token de sesión activo. |
| `sesion_expira_en` | timestamptz | Caducidad de la sesión (TTL configurable, por defecto 8 h). |
| `sesion_revocada_en` | timestamptz | Momento de revocación (logout o desactivación de cuenta). |
| `activo` | boolean | Cuenta habilitada (`false` = suspendida). |
| `creado_en` | timestamptz | Fecha de creación. |

Restricciones: el formato del correo debe corresponder al tipo (`u…@utp.edu.pe` para estudiante, `c…@utp.edu.pe` para docente), y los campos de verificación/sesión son coherentes entre sí (o todos vacíos, o token completo con caducidad).

#### `secciones` — cursos por periodo académico

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `codigo_curso` | varchar(30) | Código del curso (ej. `IS-104`). |
| `nombre_curso` | varchar(160) | Nombre legible del curso. |
| `periodo_academico` | varchar(30) | Periodo (ej. `2026-2`). |
| `codigo` | varchar(30) | Código de acceso para estudiantes, formato `SEC-XXXX` (sin caracteres ambiguos 0/O/1/I/L). |
| `activa` | boolean | `false` = inscripciones bloqueadas. |

Una sección identifica un curso específico en un periodo: `UNIQUE (codigo_curso, periodo_academico, codigo)`.

#### `matriculas` — estudiantes en una sección

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador (compuesto con `seccion_id` para las FK). |
| `seccion_id` | bigint FK → secciones | La sección. |
| `estudiante_id` | bigint FK → usuarios | El estudiante. |
| `activa` | boolean | Membresía vigente; al desactivarse el estudiante pierde el acceso sin borrar el historial. |

`UNIQUE (seccion_id, estudiante_id)`: un estudiante no se matricula dos veces en la misma sección.

#### `asignaciones_docentes` — docentes responsables de una sección

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `seccion_id` | bigint FK → secciones | La sección. |
| `docente_id` | bigint FK → usuarios | El docente. |
| `activa` | boolean | Asignación vigente; da (o retira) permisos de gestión electoral. |

#### `elecciones` — procesos electorales

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `seccion_id` | bigint FK → secciones | Sección que vota. |
| `eleccion_origen_id` | bigint FK → elecciones | Elección previa de la que deriva (solo desempates/repeticiones). |
| `nombre` | varchar(160) | Nombre de la elección. |
| `tipo` | varchar(12) | `principal` (única por sección), `desempate` o `repeticion` (siempre con origen). |
| `estado` | varchar(12) | `borrador` → `programada` → `activa` → `cerrada`; o `cancelada`. |
| `inicia_en` / `cierra_en` | timestamptz | Ventana de votación (`cierra_en > inicia_en`). |
| `cerrada_en` / `publicada_en` | timestamptz | Momentos de cierre y publicación (obligatorios si `estado = 'cerrada'`, prohibidos en otro caso). |
| `creada_por_usuario_id` | bigint FK → usuarios | Docente/admin creador. |
| `cancelada_en` / `cancelada_por_usuario_id` / `motivo_cancelacion` | — | Datos de cancelación (obligatorios y consistentes si `estado = 'cancelada'`). |
| `creado_en` | timestamptz | Fecha de creación. |

Reglas estructurales: **una sola elección `activa` por sección** (índice parcial) y **una sola `principal` por sección** (índice parcial).

#### `candidaturas` — postulantes

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `eleccion_id` + `seccion_id` | FK compuesta → elecciones | La elección a la que postula. |
| `matricula_id` + `seccion_id` | FK compuesta → matriculas | El estudiante candidato (debe estar matriculado en esa misma sección). |

`UNIQUE (eleccion_id, matricula_id)`: no se postula dos veces a la misma elección. Las FK compuestas garantizan que candidatura, elección y matrícula pertenezcan a la misma sección.

#### `habilitaciones_voto` — padrón congelado

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `eleccion_id` + `seccion_id` | FK compuesta → elecciones | La elección. |
| `matricula_id` + `seccion_id` | FK compuesta → matriculas | El votante habilitado. |
| `ha_votado` | boolean | Marca de participación (única traza del votante; no dice a quién votó). |

Se genera **masivamente al activar** la elección a partir de las matrículas activas; después queda congelada (trigger `controlar_configuracion_electoral`).

#### `votos` — el sufragio anónimo

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `eleccion_id` | bigint FK → elecciones | La elección. |
| `candidatura_id` + `eleccion_id` | FK compuesta → candidaturas | Candidatura elegida en esa elección. |

**Deliberadamente no guarda** identidad del votante, matrícula, IP ni timestamp: la anonimización es estructural. El rol de la API ni siquiera tiene `SELECT` sobre esta tabla; los conteos salen de funciones agregadas.

#### `resultados_electorales` — instantánea de cierre (totales)

| Campo | Tipo | Descripción |
|---|---|---|
| `eleccion_id` | bigint PK/FK → elecciones | La elección cerrada. |
| `total_habilitados` | bigint | Votantes del padrón congelado. |
| `total_participantes` | bigint | Quienes votaron (≤ habilitados). |

#### `resultados_candidatos` — instantánea de cierre (por candidato)

| Campo | Tipo | Descripción |
|---|---|---|
| `eleccion_id` + `candidatura_id` | PK compuesta | Elección + candidatura. |
| `votos_obtenidos` | bigint | Votos finales del candidato. |

Estas dos tablas son **inmutables una vez publicadas**: son las "actas" oficiales.

#### `delegaciones` — delegado proclamado

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `eleccion_id` | bigint UNIQUE/FK → elecciones | La elección que lo eligió (una delegación por elección). |
| `seccion_id` | bigint | La sección (consistencia con FK compuesta). |
| `candidatura_id` | bigint FK → candidaturas | El candidato ganador. |
| `inicia_en` / `termina_en` | timestamptz | Vigencia del encargo (para el ciclo académico). |

#### `periodos_evaluacion` — ventanas de evaluación

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `delegacion_id` | bigint UNIQUE/FK → delegaciones | La delegación evaluada. |
| `seccion_id` | bigint | La sección (consistencia con FK compuesta). |
| `abre_en` / `cierra_en` | timestamptz | Ventana de evaluación (`cierra_en > abre_en`). |

El trigger `controlar_periodo_evaluacion` limita a **3 periodos por delegación y ciclo** y prohíbe ventanas solapadas.

#### `evaluaciones_estudiantes` — notas del estudiantado

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `periodo_evaluacion_id` + `seccion_id` | FK compuesta → periodos_evaluacion | El periodo. |
| `matricula_id` + `seccion_id` | FK compuesta → matriculas | El evaluador (identifica el envío, no se expone al delegado). |
| `calificacion` | smallint | Entero **1–10**. |
| `comentario` | varchar(500) | Opcional, no vacío si existe. |

`UNIQUE (periodo_evaluacion_id, matricula_id)`: un envío por estudiante y periodo.

#### `evaluaciones_docentes` — notas del docente

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `periodo_evaluacion_id` + `seccion_id` | FK compuesta → periodos_evaluacion | El periodo. |
| `asignacion_docente_id` + `seccion_id` | FK compuesta → asignaciones_docentes | El docente evaluador. |
| `calificacion` | smallint | Entero **1–10**. |
| `comentario` | varchar(1000) | **Obligatorio**, mínimo 20 caracteres. |

#### `eventos_auditoria` — log inmutable

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigint PK | Identificador. |
| `eleccion_id` | bigint FK → elecciones | La elección auditada. |
| `tipo_evento` | varchar(30) | `creacion`, `activacion`, `cancelacion` o `cierre_publicacion`. |
| `actor_tipo` | varchar(8) | `usuario` (con `actor_usuario_id`) o `sistema`. |
| `actor_usuario_id` | bigint FK → usuarios | Quien hizo la acción (NULL si es `sistema`). |
| `ocurrido_en` | timestamptz | Momento exacto (`clock_timestamp()`). |
| `detalle` | jsonb | Contexto: `motivo` en cancelaciones; `total_habilitados/participantes/votos` en cierres. |

Un trigger impide `UPDATE`/`DELETE` sobre la tabla, y el rol de la API solo tiene `SELECT`: el historial no puede manipularse desde la aplicación.

### 6.3 Funciones y vistas clave de la base de datos

La lógica crítica electoral vive en funciones `SECURITY DEFINER` de PostgreSQL (atómicas e invocables solo por `votesecure_api`):

| Función | Qué garantiza |
|---|---|
| `crear_usuario(...)` | Crea usuarios verificando el formato de correo por tipo; **rechaza administradores** (esos se crean solo por CLI). |
| `programar_eleccion(...)` | Exige ≥ 2 candidaturas sobre matrículas activas antes de pasar a `programada`. |
| `activar_eleccion(eleccion_id)` | Congela el padrón: genera `habilitaciones_voto` desde las matrículas activas, cambia a `activa` y escribe auditoría `activacion` (actor `sistema`). |
| `registrar_voto(eleccion_id, estudiante_id, candidatura_id)` | En **una sola transacción**: bloquea la fila del padrón (`FOR UPDATE`), verifica `ha_votado = false`, lo marca `true` e inserta el voto en `votos`. Devuelve error si no está habilitado o ya votó. |
| `cerrar_y_publicar_resultados(eleccion_id, anticipado)` | Con bloqueo `FOR UPDATE`: verifica `participantes = votos` (si difiere, **aborta por inconsistencia**), cierra, publica instantánea en `resultados_electorales/candidatos` y audita `cierre_publicacion` (actor `sistema`). Idempotente. |
| `controlar_configuracion_electoral` (trigger) | Impide tocar candidaturas y habilitaciones una vez activada la elección. |
| `controlar_eleccion` (trigger) | Valida que una elección de desempate derive de una cerrada y solo incluya a los candidatos que empataron. |
| `controlar_periodo_evaluacion` (trigger) | Máx. 3 periodos por delegación/ciclo y sin solapamiento. |
| `impedir_cambios_historicos` (trigger) | Vuelve inmutable `eventos_auditoria`. |
| `resumen_resultados_publicados` (vista) | Deriva la situación oficial de cada elección cerrada: `ganador` (único líder con > 0 votos), `empate` (varios líderes) o `sin_votos`. |

### 6.4 Roles de base de datos (mínimos privilegios)

| Rol | Uso | Privilegios clave |
|---|---|---|
| `votesecure_api` | Runtime del backend (cada transacción hace `SET LOCAL ROLE`) | Lectura de catálogos; escritura en secciones, matrículas, asignaciones, candidaturas, habilitaciones, elecciones (campos limitados) y evaluaciones. **Sin** lectura de `votos`, **sin** escribir `eventos_auditoria`, **sin** cambiar estados electorales por su cuenta (eso lo hacen las funciones `SECURITY DEFINER`). Solo puede actualizar las columnas de sesión de `usuarios`. |
| `votesecure_migraciones` | Scripts de despliegue (DDL) | Crear/alterar tablas y funciones. |
| `votesecure_provisionamiento` | CLI del primer administrador | Crear usuarios administradores. |

---

## 7. Resultados en tiempo real (Supabase Realtime)

Así funciona la difusión en vivo de resultados:

1. **Autorización**: el frontend llama `POST /api/resultados/:id/suscripcion`. El backend verifica pertenencia a la sección y devuelve `{ canal, expiraEn }`.
2. **Canal efímero con HMAC** (`application/services/realtime.ts`, clase `ResultsPublisher`): el nombre del canal es `resultados:{eleccionId}:{ticket}`, donde `ticket = HMAC-SHA256(secreto, "eleccion:{id}:exp:{unix}")`. El secreto es `REALTIME_CANAL_SECRETO` (mín. 32 caracteres): nadie sin él puede fabricar canales.
3. **Ventana de 60 segundos**: el ticket expira al terminar el minuto unix actual. El backend publica en la ventana actual **y la anterior** a la vez, de modo que una suscripción en vuelo no pierde eventos durante la rotación; el cliente renueva el ticket antes de vencer.
4. **Publicación**: tras cada voto se difunde un evento `resultado` (broadcast) con el payload agregado — nunca votos individuales:

```json
{
  "eleccionId": 12,
  "estado": "activa",
  "totalHabilitados": 40,
  "totalParticipantes": 18,
  "totalVotos": 18,
  "candidaturas": [
    { "candidaturaId": 101, "nombre": "Lucía Mendoza", "votos": 10 },
    { "candidaturaId": 102, "nombre": "Camila Torres", "votos": 8 }
  ]
}
```

5. **Limpieza**: al cerrarse una elección se retiran sus canales, y los canales de ventanas vencidas se purgan periódicamente para no acumular suscripciones.

### 7.1 Cómo se conecta el frontend (leer antes de implementar resultados en vivo)

- **No se usan WebSockets propios ni `socket.io`**: el backend no abre ningún servidor de WebSocket, así que un `io(...)` nunca recibiría nada. La única vía es **Supabase Realtime** con `@supabase/supabase-js` (ya está en las dependencias del frontend).
- El frontend se suscribe con la **anon key** (`VITE_SUPABASE_ANON_KEY`), no con la `service_role`: esa clave es exclusiva del backend y jamás debe acabar en un `.env` con prefijo `VITE_` (quedaría incrustada en el JavaScript del navegador y da acceso total a la base).
- El canal **rota cada minuto** porque su nombre lleva el ticket HMAC. El frontend debe llamar de nuevo a `POST /api/resultados/:id/suscripcion` **antes** de `expiraEn` y volver a suscribirse al canal nuevo; si se queda escuchando el canal viejo, deja de recibir eventos (el backend solo publica en la ventana actual y la anterior).
- El evento broadcast se llama `resultado`; el payload es el JSON de arriba. Antes del primer evento conviene renderizar el snapshot de `GET /api/elecciones/:id/resultados` (mismo payload).

Esquema de referencia:

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
let canalActual = null;

async function suscribirResultados(eleccionId, alRecibir) {
  const { canal, expiraEn } = await api.post(`/resultados/${eleccionId}/suscripcion`);
  if (canalActual) await supabase.removeChannel(canalActual);
  canalActual = supabase.channel(canal);
  canalActual.on('broadcast', { event: 'resultado' }, ({ payload }) => alRecibir(payload)).subscribe();
  // Renovar el ticket unos segundos antes de que venza la ventana de 60 s.
  const msRestante = expiraEn * 1000 - Date.now();
  setTimeout(() => suscribirResultados(eleccionId, alRecibir), Math.max(msRestante - 5000, 1000));
}
```

## 8. Planificador electoral (scheduler)

`ElectionScheduler` (`application/services/scheduler.ts`) corre en el propio backend en un intervalo configurable y, en cada ciclo, ejecuta **una sola consulta** que devuelve:

- Elecciones `programada` cuya hora de inicio llegó → las **activa** (congela el padrón).
- Elecciones `activa` cuya hora de cierre llegó → las **cierra y publica** (instantánea + auditoría).

Así el cierre automático por horario del §6.1 ocurre sin intervención humana; el docente solo cierra antes de tiempo si lo decide.

---

## 9. Seguridad transversal (resumen)

- **Sesiones**: cookie `HttpOnly; SameSite=Lax; Secure` (producción); en BD solo el hash SHA-256 del token; cada petición valida vigencia y revocación → logout y desactivación de cuenta son **inmediatos**.
- **CSRF**: *double-submit cookie/header* (`X-CSRF-Token`) + coincidencia de cabecera `Origin` con `FRONTEND_URL`.
- **Contraseñas**: Argon2id con salt aleatorio.
- **Rate limiting**: 600 req/15 min (general), 20 login/15 min, 10 registro/h, 10 unirse/h (el código de sección es un secreto corto).
- **Cabeceras de respuesta**: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy: same-origin`, HSTS, y `X-Request-Id` en todas las respuestas.
- **CORS**: solo se permite el origen exacto de `FRONTEND_URL`, con credenciales.
- **Consulta de BD**: `SET LOCAL ROLE votesecure_api` + `statement_timeout` (10 s) + `lock_timeout` (3 s) en **cada transacción**; conexión descartada (no devuelta al pool) si la operación falla.
- **Anonimato del voto**: la tabla `votos` no tiene identidad y el rol de la API no puede leerla; el conteo solo ocurre dentro de funciones `SECURITY DEFINER`.
- **Trazabilidad**: eventos de auditoría inmutables escritos por triggers de BD, no por la aplicación.

## 10. Variables de entorno (`config/env.ts`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | No (default 3000) | Puerto HTTP. |
| `NODE_ENV` | Sí | `development` / `production` / `test`. |
| `FRONTEND_URL` | Sí | Origen exacto permitido por CORS; debe ser HTTPS en producción. |
| `DATABASE_API_URL` | Sí | Cadena de conexión al pooler de Supabase (rol `votesecure_api`). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Sí | Cliente Realtime para publicar resultados. La `service_role` es **exclusiva del backend**; el frontend solo recibe la anon key como `VITE_SUPABASE_ANON_KEY` y la URL como `VITE_SUPABASE_URL` (§7.1). |
| `REALTIME_CANAL_SECRETO` | Sí (mín. 32 chars) | Secreto HMAC de los tickets de canal. |
| `SESION_TTL_HORAS` | No (default 8, máx. 168) | Vida de la cookie de sesión. |
| `STATEMENT_TIMEOUT_MS` | No (default 10000) | Timeout de consultas por transacción. |
| `TRUST_PROXY_HOPS` | No (default 0) | Saltos de proxy inverso (1 en Render); jamás `true`. |
| `RESEND_API_KEY` | Sí en producción | Envío de correos de verificación. |
| `REMITENTE_CORREO` | No (default `seguridad@votesecureapp.com`) | Remitente de los correos. |
| `CORREO_REAL_EN_LOCAL` | No (default `false`) | `true` envía correos reales con Resend en desarrollo (exige `RESEND_API_KEY`). Se ignora en producción (siempre hay correo real) y en `test` nunca se envía. |

En `development` existe un bypass de verificación: el enlace de confirmación se imprime en la consola del backend en lugar de enviarse por correo (salvo `CORREO_REAL_EN_LOCAL=true`, pensado para probar Resend antes de desplegar; como el registro solo acepta `@utp.edu.pe`, se necesita un correo UTP real al que tengas acceso).

---

## 11. Guía de integración con el frontend

Reglas que no son obvias y evitan horas de depuración:

- **Autenticación por cookies, no tokens**: el frontend no guarda nada en `localStorage`; el navegador envía las cookies (`votecure_sesion` HttpOnly, `votecure_csrf` legible) y cada petición mutante debe añadir la cabecera `X-CSRF-Token` con el valor de la cookie CSRF (*double-submit*). El cliente `services/api.js` del frontend ya lo hace: reutilizarlo, no recrear `axios` ni `socket.io`.
- **Mismo origen**: en desarrollo Vite redirige `/api` al backend (puerto 5173 → 3000, con `strictPort`); en producción frontend y backend deben vivir **bajo el mismo dominio** o las cookies no viajan. El backend valida además que la cabecera `Origin` coincida exactamente con `FRONTEND_URL` — si Vite sube a otro puerto, el login falla con 403 `Origen no autorizado`.
- **Errores**: toda respuesta de error es `{ error, mensaje }` (§5); mostrar `mensaje` al usuario y usar `error` para lógica (p. ej. `PROHIBIDO` → pantalla de "no habilitado").
- **Un solo login para los tres roles**: estudiante y docente se registran en `/registro`; el admin no tiene registro ni pantalla propia (lo crea el backend con `admin:provisionar`, aceptando cualquier correo válido, incluso Gmail real). La pantalla de login es la misma; el rol llega en `usuario.tipo` de `/auth/yo` y de ahí se deciden las vistas.
- **Correo no verificado**: `Mis cursos` y casi todo lo demás exige correo verificado (`requireVerified`); el frontend debe portillar con `usuario.correoVerificado` y ofrecer `POST /api/auth/reenviar-verificacion` (respuesta idéntica exista o no la cuenta; rate-limit 10/h).
- **Foto de perfil**: `POST /api/usuarios/yo/foto` con `{ imagen: "data:image/jpeg;base64,..." }` (JPEG real, ≤ 90 000 caracteres en total, se valida la firma del archivo) y `DELETE /api/usuarios/yo/foto` para quitarla. La foto vuelve como `fotoUrl` (data URL o `null`) en `GET /api/auth/yo` y en cada candidatura de `GET /api/elecciones/:id`; **no** se incluye en listados (`/api/usuarios`, `/api/secciones`, etc.) para no inflarlos.
- **Listado de cuentas**: `GET /api/usuarios?busqueda=&tipo=` es **solo administrador**, tope 500 filas, sin hashes ni fotos.
- **Rate limits que afectan las pruebas**: login 20/15 min, registro 10/h, unirse 10/h, reenvío 10/h — no martillar endpoints en bucle desde el frontend.
- **Variables del frontend**: solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `frontend/.env.local` (plantilla en `frontend/.env.example`). Jamás la `service_role`. Sin backend local no hace falta nada más: el cliente API usa rutas relativas.
- **Datos de prueba**: `npm run seed:demo -- --contrasena <clave 15+>` (§2) crea la sección `SEC-DM25` con una elección activa y cuentas verificadas para probar registro→matrícula→voto→resultados sin esperar correos.

## 12. Glosario rápido

- **Padrón congelado**: copia de las matrículas activas en `habilitaciones_voto`, creada al activar la elección; no admite cambios posteriores.
- **Situación**: resultado derivado de la instantánea publicada: `ganador`, `empate` o `sin_votos`.
- **Desempate**: elección derivada (`tipo = 'desempate'`) entre los candidatos empatados, resuelta el mismo día dentro de la clase.
- **Proclamación**: registro oficial del delegado en `delegaciones`; solo posible con situación `ganador`.
- **Ticket Realtime**: token HMAC de 60 s que autoriza a suscribirse a un canal de resultados.
- **F-001 / F-009 / F-019…**: identificadores de revisiones de seguridad documentadas en `DECISIONES_DE_DISENO_Y_ARQUITECTURA.md`.
