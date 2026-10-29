# Contratos del backend VoteSecure (refactor)

Version del contrato: v1 (backend TypeScript, arquitectura en capas).
Base URL: `/api`. Todas las respuestas de error usan `{ "error": "<CODIGO>", "mensaje": "..." }`.

## Convenciones

- **Autenticación:** cookie `votecure_sesion` (HttpOnly, opaca, revocable) + cookie `votecure_csrf` (legible por JS). Toda peticion mutante con sesion debe enviar el header `X-CSRF-Token` con el valor de la cookie CSRF.
- **CORS:** origen unico configurado por `FRONTEND_URL`, con credenciales.
- **Identificadores:** enteros (`bigint`), no `_id` de Mongo.
- **Fechas:** ISO 8601 (`timestamptz`).
- **Operaciones protegidas:** exigen correo verificado.
- **Roles:** `estudiante`, `docente`, `administrador` (uno por cuenta).

## Salud

| Metodo | Ruta | Rol | Descripcion |
|---|---|---|---|
| GET | `/api/salud` | publico | Estado del servicio. |

## Autenticacion

| Metodo | Ruta | Rol | Body / Query | Descripcion |
|---|---|---|---|---|
| POST | `/api/auth/registro` | publico | `{nombre, correo, contrasena}` | Registra estudiante o docente; el rol se deriva del correo. Respuesta siempre generica (anti-enumeracion). Envia enlace de verificacion. |
| POST | `/api/auth/login` | publico | `{correo, contrasena}` | Devuelve cookies de sesion y CSRF. Errores genericos; bloqueo temporal tras 5 fallos. |
| POST | `/api/auth/logout` | sesion | — | Revoca la sesion y limpia cookies. |
| GET | `/api/auth/verificar` | publico | `?correo=&token=` | Confirma el correo y redirige al frontend (`?estado=ok\|error`). |
| GET | `/api/auth/yo` | sesion | — | Perfil del usuario autenticado. |

## Administracion academica

| Metodo | Ruta | Rol | Body / Query | Descripcion |
|---|---|---|---|---|
| GET | `/api/secciones` | sesion | — | Secciones visibles segun rol. |
| POST | `/api/secciones` | administrador | `{codigoCurso, nombreCurso, periodoAcademico, codigo}` | Crea seccion. |
| GET | `/api/secciones/:id` | sesion | — | Detalle de seccion. |
| PATCH | `/api/secciones/:id` | administrador | `{activa}` | Activa/desactiva seccion. |
| POST | `/api/secciones/:id/matriculas` | administrador | `{estudianteId}` | Matricula un estudiante. |
| GET | `/api/secciones/:id/matriculas` | sesion | — | Lista matriculas. |
| PATCH | `/api/matriculas/:id` | administrador | `{activa}` | Activa/desactiva matricula. |
| POST | `/api/secciones/:id/asignaciones` | administrador | `{docenteId}` | Asigna docente a seccion. |
| GET | `/api/secciones/:id/asignaciones` | sesion | — | Lista asignaciones. |
| PATCH | `/api/asignaciones/:id` | administrador | `{activa}` | Activa/desactiva asignacion. |

## Gestion electoral

| Metodo | Ruta | Rol | Body / Query | Descripcion |
|---|---|---|---|---|
| GET | `/api/elecciones` | sesion | `?seccionId=` | Elecciones de la seccion (visibles segun rol). |
| POST | `/api/elecciones` | docente/admin | `{seccionId, nombre, iniciaEn, cierraEn, tipo?, eleccionOrigenId?}` | Crea eleccion en borrador (o derivada: desempate/repeticion). |
| GET | `/api/elecciones/activas` | estudiante | — | Elecciones activas del estudiante. |
| GET | `/api/elecciones/:id` | sesion | — | Detalle con candidaturas y habilitaciones. |
| PATCH | `/api/elecciones/:id` | docente/admin | `{nombre?, iniciaEn?, cierraEn?}` | Reconfigura solo en borrador/programada. |
| POST | `/api/elecciones/:id/candidaturas` | docente/admin | `{matriculaId}` | Agrega candidatura. |
| DELETE | `/api/elecciones/:id/candidaturas/:candidaturaId` | docente/admin | — | Retira candidatura. |
| POST | `/api/elecciones/:id/habilitaciones` | docente/admin | `{matriculaId}` | Habilita votante (padron congelado al activar). |
| DELETE | `/api/elecciones/:id/habilitaciones/:habilitacionId` | docente/admin | — | Retira habilitacion. |
| POST | `/api/elecciones/:id/programar` | docente/admin | — | Pasa a programada (exige 2+ candidaturas). |
| POST | `/api/elecciones/:id/activar` | docente/admin | — | Activa manualmente si llego la hora. |
| POST | `/api/elecciones/:id/cancelar` | docente/admin | `{motivo}` | Cancela con motivo (auditado). |
| POST | `/api/elecciones/:id/delegacion` | docente/admin | `{iniciaEn, terminaEn?}` | Proclama delegado (solo con ganador unico). |

## Voto y resultados

| Metodo | Ruta | Rol | Body / Query | Descripcion |
|---|---|---|---|---|
| POST | `/api/elecciones/:id/voto` | estudiante | `{candidaturaId}` | Emite el voto (atomico, unico). Respuesta: confirmacion simple. Tras el commit se publica el resultado en vivo. |
| GET | `/api/elecciones/:id/resultados` | sesion | — | `tipo: "en_vivo"` (estudiante habilitado, eleccion activa) o `tipo: "final"` (miembro de la seccion o admin). |
| GET | `/api/elecciones/:id/resultados/suscripcion` | estudiante | — | Ticket de suscripcion: `{canal, eleccionId}`. Solo estudiantes habilitados. |

### Canal Realtime (resultados en vivo)

- Canal: `resultados:{eleccionId}:{ticket}` (el ticket lo emite el endpoint de suscripcion; valida sesion y habilitacion).
- Evento: `resultado`.
- Payload:

```json
{
  "eleccionId": 12,
  "estado": "activa",
  "totalHabilitados": 40,
  "totalParticipantes": 17,
  "totalVotos": 17,
  "candidaturas": [{ "candidaturaId": 31, "nombre": "Ana Perez", "votos": 9 }]
}
```

- Se emite solo despues del commit de cada voto confirmado; nunca contiene identidad del votante ni voto individual. Al cerrar la eleccion se detiene la emision.
- Si el cliente se desconecta, recupera el estado actual con `GET /api/elecciones/:id/resultados`.

## Evaluacion del delegado

| Metodo | Ruta | Rol | Body / Query | Descripcion |
|---|---|---|---|---|
| GET | `/api/evaluaciones/delegado` | sesion | `?seccionId=` | Delegado vigente y si hay periodo abierto. |
| POST | `/api/evaluaciones` | sesion | `{seccionId, calificacion, comentario?}` | Evaluacion: estudiante (comentario opcional, max 500) o docente (comentario obligatorio 20-1000). |
| GET | `/api/evaluaciones/resumen` | docente/admin | `?seccionId=` | Promedios agregados; protege la identidad estudiantil. |
| POST | `/api/delegaciones/:id/periodo-evaluacion` | docente/admin | `{abreEn, cierraEn}` | Abre un periodo de evaluacion dentro de la delegacion. |

## Auditoria

| Metodo | Ruta | Rol | Query | Descripcion |
|---|---|---|---|---|
| GET | `/api/auditoria` | docente/admin | `?seccionId=&eleccionId=` | Eventos electorales (creacion, activacion, cancelacion, cierre_publicacion). El docente solo ve sus secciones. |

## Incompatibilidades con el backend anterior (para adaptar el frontend)

1. **Auth:** se retira JWT en body; ahora cookies HttpOnly + CSRF. El frontend debe enviar `credentials: 'include'` y el header `X-CSRF-Token`.
2. **IDs:** `_id` de Mongo desaparece; todo es `id` numerico.
3. **Modelo de datos:** `organizaciones` -> `secciones` (curso + periodo academico + codigo); `usuarios.votantes` -> `matriculas`.
4. **Estados de eleccion:** `borrador/activa/finalizada/cancelada` -> `borrador/programada/activa/cerrada/cancelada`. Se elimina `PATCH /elecciones/:id/estado` (cambio arbitrario) y `DELETE /elecciones/:id` (borrado generico); ahora son operaciones explicitas auditadas.
5. **Candidatos:** campo libre `nombre` -> candidaturas vinculadas a una matricula de la seccion.
6. **Voto:** `POST /votos {eleccion_id, candidato_id}` -> `POST /elecciones/:id/voto {candidaturaId}`. Sin comprobante hash/QR: la respuesta es solo confirmacion.
7. **Comprobantes:** se eliminan `/votos/mis-comprobantes` y `/votos/verificar/:hash`.
8. **RENIEC:** se elimina toda la ruta `/reniec/*` y la verificacion de DNI del registro.
9. **Tiempo real:** eventos Socket.IO (`eleccion:estado`, sala `eleccion:{id}`) -> canal Realtime Broadcast `resultados:{id}:{ticket}` con evento `resultado`.
10. **Resultados:** `GET /elecciones/:id/resultados` ahora diferencia en vivo (solo estudiantes habilitados) y final (miembros de la seccion o admin).
11. **Auditoria:** esquema propio paginado -> eventos electorales con actor usuario/sistema; docente solo ve sus secciones.
12. **Registro:** se elimina el rol `admin` del body y `verificadoReniec`; el rol se deriva del correo institucional.

## Aprovisionamiento del primer administrador

```
npm run admin:provisionar -- --correo admin@ejemplo.pe --nombre "Admin" --contrasena "clave-de-15-o-mas"
```

Imprime el enlace de verificacion de correo. No existe registro autoservicio para administradores.
