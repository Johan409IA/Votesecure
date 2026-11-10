# Plan: Actualización de dependencias (audit → Zod 4 → Vitest 5)

> Estado: **propuesto** (nov 2026). Se ejecuta antes de la Fase 3 del
> `plan_backend_votesecure.md`, para que las Fases 4, 6 y 7 escriban sus schemas
> nuevos directamente en Zod 4 y no haya doble migración.
> Este plan no cambia rutas URL, contrato §10 ni SQL.

## 1. Objetivo

Cerrar los tres frentes de dependencias pendientes de `MEMORY.md` (§ "Decisiones",
punto de parches de seguridad):

1. Advisories reportados por `npm i` / `npm audit`, sin cambios de major.
2. `zod` 3.24.2 → 4.6.7.
3. `vitest` 3.2.7 → 5.1.0.

## 2. Datos verificados

Consultados el nov 2026 con `ctx7` (CLI global) y el registro de npm. No se
asumen versiones de memoria.

| Dato | Valor verificado | Fuente |
|---|---|---|
| `zod` última versión | `4.6.7` | `registry.npmjs.org/zod/latest` |
| `vitest` última versión | `5.1.0` | `registry.npmjs.org/vitest/latest` |
| `bin` de vitest 5.1.0 | `vitest` → `./vitest.mjs` (mismo entrypoint que v3) | `package.json` de vitest 5.1.0 |
| Engines de vitest 5.1.0 | Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | idem |
| Peers de vitest 5.1.0 | `vite ^6.4.0 \|\| ^7 \|\| ^8`; `@types/node ^22.0.0 \|\| >=24.0.0` | idem |
| `z.ZodIssueCode` en v4 | **Deprecado, no eliminado** (capa de compatibilidad con todos los códigos de v4, sin `invalid_date`) | `packages/zod/src/v4/classic/compat.ts` vía `ctx7 docs /colinhacks/zod` |
| `superRefine` + `ctx.addIssue` en v4 | Siguen soportados; `addIssue` normaliza (`fatal → continue: false`, `code` por defecto `"custom"`) y respeta `path` | `packages/zod/src/v4/core/api.ts` vía `ctx7 docs` |
| Genéricos de la base de schemas | `$ZodType<Output = unknown, Input = unknown>` | `packages/docs/content/packages/core.mdx` vía `ctx7 docs` |
| `z.coerce.*` | Input por defecto `unknown`; admite genérico para tipar la entrada | `packages/docs/content/api.mdx` vía `ctx7 docs` |
| Pool por defecto de Vitest | `forks` | `vitest.dev/guide/cli` vía `ctx7 docs` |
| Breaking changes de Vitest 5 | `bench` pasa al contexto de test; aserciones async sin `await` fallan; `test.sequential`/`describe.sequential` eliminados; `clearMocks` limpia historial antes de cada test; títulos `$` sin comillas; `browser.api` → `api` | `vitest.dev/guide/migration` vía `ctx7 docs` |

## 3. Estado actual del repositorio (evidencia)

- `backend/package.json:28` — `zod` fijado en `3.24.2`; `:44` — `vitest` en `3.2.7`.
- `backend/package-lock.json:6681` — zod 3.24.2; `:5624` — `tinypool` 1.1.1 (origen del advisory).
- 10 archivos importan `zod`: `src/config/env.ts`, `src/presentation/dto/{auth,election,evaluation}.dto.ts`,
  `src/presentation/middleware/validate.ts`, `src/presentation/routes/{election,section,result,audit}.routes.ts`,
  `scripts/provision-admin.ts`.
- Único uso de API deprecada/eliminada detectado: `z.ZodIssueCode.custom` en `src/config/env.ts:22`.
- Uso de `.email()` en `src/presentation/dto/auth.dto.ts:11,19,24` y `src/config/env.ts:17`.
- No hay `z.record`, `z.function`, `z.nativeEnum`, `.errors`, `.flatten()`, `.deepPartial` en el backend.
- Tests a Vitest: no usan `vi.mock`, `sequential` ni `bench`; todos los `.resolves`/`.rejects`
  ya están esperados con `await` (`tests/unit/passwords.test.ts:8-9`,
  `tests/integration/election-flow.test.ts:150,167`). Los breaking changes de Vitest 5
  **no afectan ninguna prueba existente**.
- `backend/vitest.config.ts` solo define `include`, `environment: 'node'` y timeouts.
- Scripts de test invocan `node --env-file=.env node_modules/vitest/vitest.mjs run`
  (`backend/package.json:11-13`); el entrypoint se conserva en 5.1.0 → **sin cambios**.

## 4. Decisiones (y por qué)

- **Tres lotes en commits separados** (audit / zod / vitest): cada uno tiene una
  superficie de riesgo distinta y así se atribuyen los fallos. Un `npm i` único
  mezclaría cambios de lock, runtime y test-runner.
- **Versiones exactas, sin `^`/`~`**, y lock regenerado commiteado. Requisito de
  §9.1 (`docs/DECISIONES_DE_DISENO_Y_ARQUITECTURA.md:231-235`).
- **Nunca `npm audit fix --force`**: introduce majors sin control y rompe el
  pinning exacto.
- **Correo con `.pipe(z.email())`**, no `z.email()` a secas: en v4 el check de
  formato corre antes del `.trim()`, así que `z.email()` cambiaría la semántica
  para correos con espacios. `.pipe()` preserva el comportamiento de v3
  (trim y lowercase antes de validar).
- **`code: 'custom'` literal** en `env.ts`: recomendación de upstream
  (`ZodIssueCode` está deprecado). Riesgo bajo porque la capa de compatibilidad
  de v4 lo mantiene compilando; el cambio es explícito, no dependemos del lint.
- **`.url()` se queda** (deprecado pero funcional) para mantener el diff mínimo;
  migrarlo es opcional.
- **Frontend fuera de alcance**: React 18 → 19, prefijos `^` de
  `frontend/package.json` y `socket.io-client` pertenecen a la realineación del
  frontend (`MEMORY.md`), no a este lote.

## 5. Fases

### Fase 0 — Aislamiento y baseline

1. Rama dedicada (`deps/zod4-vitest5`) desde el estado commiteado actual.
2. Baseline verde y registrado: `npm ci && npm run lint && npm run deps:check &&
   npm test && npm run build && npm run smoke`.
   - La BD ya está configurada (`TEST_DATABASE_URL` / `DATABASE_API_URL`), así que
     deben correr los 15 unitarios y los dos de integración.
   - Sin baseline verde no se puede atribuir ningún fallo posterior.

### Fase 1 (Lote A) — Parches de `npm audit` sin majors

1. `npm audit --json` y captura de los warnings de `npm i`; clasificar paquete por
   paquete.
2. `npm audit fix` solo para actualizaciones sin major.
3. Los majors detectados se registran como pendientes con su advisory y su
   evaluación; no se fuerzan.
4. Revisar que el diff del lock solo mueva transitivos.
5. Verificación completa → **commit 1** (`package-lock.json` + `package.json` si
   aplicara dentro del mismo major).

### Fase 2 (Lote B) — Zod 3.24.2 → 4.6.7

**2.0 Test de regresión, antes de tocar la versión** (`tests/unit/auth.dto.test.ts`):

```ts
it('acepta y normaliza correos con espacios', () => {
  const result = registerSchema.parse({ ...base, correo: '  u20231234@utp.edu.pe  ' });
  expect(result.correo).toBe('u20231234@utp.edu.pe');
});
```

Debe pasar ya en Zod 3 (trim antes del check de formato). Fija la semántica que
protege el punto más delicado de la migración.

**2.1 Versión**: `"zod": "4.6.7"` exacto en `backend/package.json`; regenerar lock.

**2.2 Cambios de código**

- `src/config/env.ts`
  - `:22` — `code: z.ZodIssueCode.custom` → `code: 'custom'`.
  - `:17` — `z.string().trim().email().default(...)` →
    `z.string().trim().pipe(z.email()).default('seguridad@votesecureapp.com')`.
  - `:13-16` — `RESEND_API_KEY` con `z.preprocess`: en v4 devuelve `ZodPipe`;
    comprobar el tipado de `serverSchema` con el build, sin cambio de lógica.
  - `.default()` ahora cortocircuita y no valida el default: revisar `PORT` (3000),
    `SESION_TTL_HORAS` (8) y `REMITENTE_CORREO` (string) — todos válidos.
  - `superRefine` y `ctx.addIssue` no requieren cambios (verificado en v4).
- `src/presentation/dto/auth.dto.ts:11,19,24` — `correo`:
  `z.string().trim().toLowerCase().pipe(z.email())` en los tres schemas.
- `src/presentation/dto/election.dto.ts` y `evaluation.dto.ts` — sin API eliminada;
  `.refine(fn, { message, path })` sigue soportado (`message` deprecado a favor de
  `error`, se deja). Registrar que la clave ausente en un campo `z.coerce.*`
  ahora lanza error en vez de coercear `undefined`.
- `src/presentation/routes/{election,section,audit,result}.routes.ts` — los
  `idParam` no cambian; los params siempre traen `:id`. Anotar el cambio de
  mensaje de error.
- `src/presentation/middleware/validate.ts:13,28` — `ZodType<T>` →
  `ZodType<T, unknown>`. `error.issues` (`:7`) no cambia.
- `scripts/provision-admin.ts` — inspeccionar `argsSchema` y aplicar los mismos
  patrones si hay `.email()` o `z.coerce`.
- Barrido final con grep: `z\.(record|nativeEnum|function|promise|deepPartial|ostring)`,
  `\.errors\b`, `\.flatten\(\)`, `\.formErrors`, `ZodIssueCode`,
  `z\.string\(\)\.(email|url|uuid)`.

**2.3 Verificación** completa (unit + integración + smoke) → **commit 2**.

**2.4 Nota de contrato**: los mensajes de error de validación cambian para campos
ausentes/no coercibles (`"expected nonoptional, received undefined"`). Debe
quedar registrado para la realineación del frontend; el contrato §10 no cambia.

### Fase 3 (Lote C) — Vitest 3.2.7 → 5.1.0

1. `"vitest": "5.1.0"` exacto. **Scripts sin cambios**: `./vitest.mjs` sigue
   siendo el bin, así que `node --env-file=.env node_modules/vitest/vitest.mjs run`
   se mantiene.
2. Antes de instalar, leer las dos guías de migración con `ctx7 docs
   /websites/vitest_dev_guide "migration v3 to v4"` y `"v4 to v5"`.
3. Revisar el lock diff: será grande (`vite` a `^7`/`^8`, `tinypool` a `^2`,
   `@vitest/*` a 5.x). `npm run dev` usa `tsx`, no vite: el impacto es solo del
   runner de pruebas.
4. `backend/vitest.config.ts` no necesita cambios. **Observar** el pool por
   defecto (`forks` en la doc actual) comparando tiempos/paralelismo con v3;
   fijar `pool` explícitamente solo si aparece una diferencia problemática.
5. Confirmar que no hay que tocar tests: no hay `vi.mock`, `sequential`, `bench`
   ni aserciones async sin `await`.
6. Verificación completa → **commit 3**.

### Fase 4 — Cierre y memoria

1. `MEMORY.md`: registrar los lotes aplicados con versiones exactas, la decisión
   del `.pipe(z.email())` y su porqué, y el cambio de mensajes de validación.
   Dejar de marcar zod/vitest como pendientes.
2. Si el audit dejó majors pendientes, listarlos con advisory y evaluación para un
   lote posterior.
3. Reportar cambios, salidas de verificación y pendientes.

## 6. Archivos críticos

- `backend/package.json`, `backend/package-lock.json`
- `backend/src/config/env.ts`
- `backend/src/presentation/dto/auth.dto.ts`
- `backend/src/presentation/dto/{election,evaluation}.dto.ts`
- `backend/src/presentation/middleware/validate.ts`
- `backend/src/presentation/routes/{election,section,result,audit}.routes.ts`
- `backend/scripts/provision-admin.ts`
- `backend/tests/unit/auth.dto.test.ts`
- `backend/vitest.config.ts` (solo verificación)
- `MEMORY.md`

## 7. Verificación global

Después de **cada** lote:

```bash
npm ci
npm run lint
npm run deps:check
npm test
npm run build
npm run smoke
```

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Regresión de validación de correo por orden de checks en v4 | Test de regresión previo (2.0) + `.pipe(z.email())` |
| Cambio de mensajes de error de validación (posible dependencia del frontend) | Nota de contrato en 2.4 y en `MEMORY.md` |
| Lock diff grande en Vitest 5 (vite/tinypool majors) | Aislado en su commit; `npm run dev` no usa vite |
| `npm audit fix` mueve algo inesperado | Revisión del lock diff + `npm ci` limpio antes de commitear |
| Fallo de integración por entorno (BD) | Baseline verde en Fase 0 antes de tocar dependencias |

Rollback: cada lote es un commit independiente; `git revert` puntual.

## 9. Fuera de alcance y supuestos

- No se toca el frontend (`axios` 1.6.2, `vite` 5, React 18, `socket.io-client`);
  su actualización pertenece al plan de realineación del frontend.
- No se tocan rutas URL, contrato §10, esquema SQL ni roles.
- No se ejecuta en paralelo con las Fases 3–10 del plan de backend.
- `npm audit` del backend no cubre `frontend/`; tienen locks separados.
