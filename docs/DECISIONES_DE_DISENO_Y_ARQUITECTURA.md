# VoteSecure — Decisiones Oficiales de Diseño, Arquitectura y Reglas de Negocio

**Versión del documento:** 1.0  
**Fecha de consolidación:** Noviembre 2026  
**Proyecto:** VoteSecure (Sistema Electoral Universitario UTP)  
**Alcance:** Versión Oficial de Producción 1.0  

---

## 1. Resumen Ejecutivo y Marco de Referencia

Este documento formaliza de manera exhaustiva y vinculante todas las decisiones técnicas, de arquitectura, de seguridad y de negocio acordadas para el desarrollo del sistema **VoteSecure**. 

El sistema tiene por objeto organizar y desarrollar procesos electorales y de evaluación académica en la Universidad Tecnológica del Perú (UTP) de forma ordenada, confidencial, auditable y verificable, mitigando las vulnerabilidades de los métodos tradicionales (mano alzada, formularios genéricos no validados o conteos informales).

Las especificaciones aquí consignadas se estructuran bajo una rigurosa separación entre:
* **Requisito Aprobado:** La regla de negocio, restricción legal/académica o principio del sistema que debe cumplirse sin excepción.
* **Decisión Técnica Adoptada:** La solución arquitectónica, criptográfica y de base de datos elegida para implementar el requisito.
* **Reglas Operativas:** Los flujos y comportamientos en tiempo de ejecución en el aula de clase y en el sistema.

---

## 2. Autenticación, Identidad y Control de Acceso

### 2.1. Cuentas y Validación Institucional
* **Requisito Aprobado:**
  - El sistema reconoce exactamente tres roles mutuamente excluyentes: `estudiante`, `docente` y `administrador`.
  - El formato del correo institucional es condición necesaria pero no suficiente para interactuar en la plataforma:
    - Estudiantes: `^u[a-z0-9._%+-]*@utp[.]edu[.]pe$`
    - Docentes: `^c[a-z0-9._%+-]*@utp[.]edu[.]pe$`
    - Administradores: correo institucional o personal autorizado mediante aprovisionamiento previo.
  - Ninguna cuenta puede emitir votos, postular a candidaturas ni administrar elecciones sin haber acreditado previamente la titularidad de su correo.
  - El rol `administrador` **nunca** puede registrarse mediante un formulario web público ni auto-asignarse.
* **Decisión Técnica Adoptada:**
  - **Acreditación en Producción:** Integración con **Resend** (API/SMTP) bajo el dominio propio verificado **`votesecureapp.com`** (gestionado en Cloudflare con firmas DNS SPF, DKIM y DMARC). Se despacha un correo con remitente personalizado institucional (`seguridad@votesecureapp.com`) conteniendo un token unívoco de 32 bytes criptográficamente seguros (`crypto.randomBytes(32)`).
  - En la base de datos se almacena únicamente el hash SHA-256 en `verificacion_hash` con fecha de caducidad de 24 horas (`verificacion_expira_en`).
  - **Acreditación en Desarrollo Local (`NODE_ENV === 'development'`):** Se activa un bypass controlado que expone el enlace de confirmación directamente en la consola/log del backend, permitiendo pruebas automatizadas y locales sin dependencias de red externas.
  - **Aprovisionamiento Administrativo:** La función de base de datos `crear_usuario` lanza una excepción bloqueante si `tipo_usuario = 'administrador'`. Los administradores se generan exclusivamente mediante el script CLI `scripts/provisionar-admin.ts` ejecutado con el rol de PostgreSQL privilegiado `votesecure_provisionamiento`.

### 2.2. Política de Contraseñas, Sesiones y CSRF
* **Requisito Aprobado:**
  - Las contraseñas deben ser almacenadas bajo estándares criptográficos modernos de derivación de claves resistentes a ataques masivos por GPU/ASIC.
  - Las sesiones deben ser persistentes pero revocables de forma instantánea ante un logout o suspensión de cuenta.
  - La API debe ser inmune a ataques de Falsificación de Petición en Sitios Cruzados (CSRF).
* **Decisión Técnica Adoptada:**
  - **Algoritmo de Hash:** **Argon2id** (`@node-rs/argon2`) con un mínimo de 16 bytes de salt aleatorio. Queda prohibido el almacenamiento en texto plano o con algoritmos obsoletos (MD5, SHA1, SHA256 simple).
  - **Almacenamiento de Sesión:** Cookies `HttpOnly; SameSite=Lax; Secure` (en producción) con un TTL parametrizado (ej. 12 horas). La base de datos almacena exclusivamente el hash SHA-256 del token en `sesion_hash`.
  - **Revocación Inmediata:** Cada petición autenticada valida en base de datos que `sesion_revocada_en IS NULL` y que `sesion_expira_en > clock_timestamp()`. El endpoint `POST /api/auth/logout` o la desactivación del usuario escribe `sesion_revocada_en = clock_timestamp()`, anulando el token en el acto.
  - **Protección CSRF Vinculada:** Se emplea el patrón *Double-Submit Cookie / Header* criptográficamente robusto: el token CSRF está derivado de la sesión y se envía como cabecera `X-CSRF-Token` en métodos mutantes (`POST`, `PUT`, `DELETE`). Adicionalmente, el middleware valida la coincidencia de las cabeceras `Origin` y `Referer` contra la URL autorizada del frontend.

---

## 3. Gestión de Cursos, Secciones y Padrón Electoral

### 3.1. Auto-incorporación en Aula y Códigos de Sección
* **Requisito Aprobado:**
  - El docente no necesita cargar archivos manuales complejos durante la clase; crea su curso/sección en la plataforma y comparte un código de acceso corto legible.
  - Los estudiantes presentes ingresan el código desde sus dispositivos para enrolarse inmediatamente en la sección.
* **Decisión Técnica Adoptada:**
  - Al crear una sección, se auto-genera un código alfanumérico único de 6 caracteres legibles en mayúsculas (ej. `SEC-8K2A`).
  - El estudiante utiliza el endpoint `POST /api/secciones/unirse` enviando `{ codigo: "SEC-8K2A" }`, lo que genera su registro en la tabla `matriculas`.
  - El docente dispone de una opción de **"Bloquear inscripciones"** (`activa = false` para nuevas matrículas) previo a la elección para evitar que usuarios ajenos a la clase ingresen a destiempo.

### 3.2. Candidaturas y Congelamiento del Padrón
* **Requisito Aprobado:**
  - En la elección de delegado no existe la opción de "Voto en Blanco"; los estudiantes eligen entre los candidatos postulados por la sección.
  - Las candidaturas son seleccionadas por el docente directamente de la lista de alumnos ya incorporados a la sección. Se requiere un mínimo de 2 candidatos para que la elección sea válida.
  - **Integridad del Padrón:** El padrón de votantes habilitados se congela en el instante exacto en que la elección pasa a estado `activa`. No se admiten incorporaciones posteriores al inicio de los sufragios.
* **Decisión Técnica Adoptada:**
  - Al programar la elección, la función `programar_eleccion` valida que existan al menos 2 candidaturas vinculadas a matrículas activas de la sección.
  - Al activar la elección (`activar_eleccion`), la base de datos genera masivamente los registros en `habilitaciones_voto` a partir de las matrículas activas registradas hasta ese instante y bloquea cualquier mutación sobre las tablas de candidaturas y habilitaciones mediante el trigger `controlar_configuracion_electoral`.

---

## 4. Votación Confidencial y Secreto del Sufragio

### 4.1. Separación Transaccional del Voto
* **Requisito Aprobado:**
  - Cada estudiante habilitado puede emitir exactamente un único voto.
  - Es inviolable el principio de confidencialidad: resulta técnicamente imposible vincular a un estudiante específico con la candidatura que eligió.
  - Un voto emitido es irrevocable e inmutable.
* **Decisión Técnica Adoptada:**
  - La función transaccional `registrar_voto(eleccion_id, estudiante_id, candidatura_id)` ejecuta en una única transacción atómica:
    1. Localiza el registro en `habilitaciones_voto` perteneciente a la matrícula del estudiante en esa elección con `ha_votado = false` y aplica `ha_votado = true` con `FOR UPDATE`.
    2. Si no existe o ya figuraba como `true`, la transacción aborta con error `Estudiante no habilitado o voto ya registrado`.
    3. Inserta una fila en la tabla `votos (eleccion_id, candidatura_id)`.
  - La tabla `votos` **no posee** columna de `estudiante_id`, `matricula_id`, dirección IP ni marca de tiempo individual, garantizando la anonimización matemática del voto.

### 4.2. Experiencia de Usuario en la Votación
* **Requisito Aprobado:**
  - El flujo de votación debe ser simple, intuitivo y completarse en 3 pasos:
    1. Revisión de candidatos en papeleta virtual con fotos/avatares institucionales.
    2. Resumen de selección con advertencia clara de irreversibilidad.
    3. Confirmación en modal emergente y mensaje de éxito sin necesidad de tokens en papel o tickets complejos.
* **Decisión Técnica Adoptada:**
  - Fidelidad absoluta a los mockups: `candidatos.jpg`, `confirmar_voto.jpg` y `voto_registrado.jpg`.
  - La selección se gestiona en el cliente mediante componentes modales controlados; tras recibir la respuesta `200 OK` del backend, se presenta el modal de felicitación y la interfaz inhabilita inmediatamente cualquier opción de volver a votar.

---

## 5. Resultados en Tiempo Real y Difusión Segura

### 5.1. Estado Cero y Dinámica en Vivo
* **Requisito Aprobado:**
  - Desde el segundo cero en que la elección pasa a estado `activa`, la pantalla de resultados en tiempo real está disponible tanto para el docente (proyector de aula) como para los alumnos.
  - **Estado cero:** Cuando hay 0 votos registrados, la interfaz y el canal difunden y muestran explícitamente: *"Aún no hay votos registrados"*, con barras en 0% y quórum en 0%.
  - **Actualización reactiva:** El conteo agregado se actualiza inmediatamente tras registrarse cada voto.
  - **Prohibición de proclamación preliminar:** Mientras la elección esté en estado `activa`, la pantalla debe incluir un banner reglamentario visible: *"El cómputo en vivo es parcial e informativo. Ningún candidato es proclamado ganador hasta el cierre formal y publicación de actas"*.
* **Decisión Técnica Adoptada:**
  - **Supabase Realtime Broadcast:** El backend utiliza la clase `PublicadorResultados` (`@supabase/supabase-js`) para enviar el payload agregado al canal `resultados:{eleccionId}:{hmacTicket}`.
  - La función privilegiada de base de datos `contar_votos_eleccion(p_eleccion_id)` computa los agregados por candidatura mediante `GROUP BY` sobre `candidaturas` sin que la API lea votos individuales.
  - **Autorización del Canal:** Para suscribirse al canal en el frontend, el cliente invoca `POST /api/resultados/:id/suscripcion`. El backend verifica que el usuario pertenezca a la sección y genera un ticket efímero firmado por HMAC con vigencia de 60 segundos.
  - El payload en vivo solo contiene:
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

---

## 6. Cierre Electoral, Empates y Balotaje en el Mismo Día

### 6.1. Cierre y Consistencia Atómica
* **Requisito Aprobado:**
  - El cierre de una elección puede darse:
    - Automáticamente por horario al alcanzar `cierra_en`.
    - Anticipadamente por decisión del docente si todos los estudiantes habilitados ya sufragaron o si el tiempo de clase está por concluir.
  - La operación de cierre es estrictamente consistente: el total de marcas de participación en `habilitaciones_voto` debe coincidir de forma exacta con la cantidad de votos en `votos`. De existir discrepancia, la base de datos aborta el cierre por inconsistencia de integridad.
* **Decisión Técnica Adoptada:**
  - La función `cerrar_y_publicar_resultados(p_eleccion_id)` aplica un bloqueo `FOR UPDATE` sobre la elección, verifica `v_participantes = v_votos`, cambia el estado a `'cerrada'`, escribe `cerrada_en` y `publicada_en`, genera la instantánea inmutable en las tablas `resultados_electorales` y `resultados_candidatos`, e inserta el evento de auditoría `'cierre_publicacion'` con actor `'sistema'`.
  - La vista oficial `resumen_resultados_publicados` computa automáticamente la situación: `'ganador'`, `'empate'` o `'sin_votos'`.

### 6.2. Reglas de Empate y Balotaje en el Mismo Día
* **Requisito Aprobado:**
  - Se define **Empate** cuando dos o más candidaturas obtienen la máxima cantidad de votos y dicha cantidad es estrictamente positiva (`max_votos > 0` y `cantidad_lideres >= 2`).
  - La elección del delegado de la sección debe resolverse indefectiblemente el mismo día en que se inició el proceso (dentro del horario de la sesión de clase, zona horaria `America/Lima`, UTC-5).
  - La convocatoria del desempate es realizada por el docente asignado mediante una acción asistida de un clic.
* **Decisión Técnica Adoptada:**
  - Al confirmarse el estado `'empate'`, el docente ve en su panel el botón *"Iniciar Desempate"*.
  - El backend crea una elección derivada con `tipo = 'desempate'` y `eleccion_origen_id` apuntando a la elección previa.
  - El trigger `controlar_eleccion` valida a nivel de base de datos que la elección origen esté formalmente cerrada y que las candidaturas agregadas a la derivada correspondan única y exclusivamente a los candidatos que empataron en primer lugar.
  - La duración del balotaje se configura para una ventana corta de 15 a 30 minutos dentro de la misma clase.

### 6.3. Proclamación del Delegado
* **Requisito Aprobado:**
  - Un delegado solo puede proclamarse si existe un único ganador definitivo derivado de una elección cerrada con situación `'ganador'`.
* **Decisión Técnica Adoptada:**
  - La función `proclamarDelegado` en `electoral.casos.ts` exige que `resultado.situacion === 'ganador'` y registra la fila en la tabla `delegaciones` ligando la elección, la sección y la candidatura ganadora, con vigencia para el ciclo académico correspondiente.

---

## 7. Módulo de Evaluación del Delegado

### 7.1. Reglas y Restricciones de Calificación
* **Requisito Aprobado:**
  - El módulo de evaluación solo puede abrirse después de que exista un delegado electo proclamado en la sección.
  - La apertura es manual y discrecional por parte del docente (ej. semana 8 o semana 16 del ciclo), quien fija la fecha límite e instrucciones/criterios específicos.
  - **Escala de calificación:** Números enteros del 1 al 10.
  - **Comentarios:**
    - Estudiantes: Comentario opcional de hasta 500 caracteres.
    - Docente: Comentario obligatorio de entre 20 y 1000 caracteres.
  - Una vez vencida la fecha de cierre del periodo, el formulario se bloquea automáticamente.
* **Decisión Técnica Adoptada:**
  - Se modelan las tablas `periodos_evaluacion`, `evaluaciones_estudiantes` y `evaluaciones_docentes`.
  - Las evaluaciones de estudiantes aseguran el principio de voto único mediante `UNIQUE (periodo_evaluacion_id, matricula_id)`.
  - El cálculo del promedio estudiantil es la media aritmética `ROUND(AVG(calificacion), 2)`.
  - La valoración del docente se almacena y presenta en un bloque separado, respetando su peso cualitativo sin diluirlo en el promedio numérico de los alumnos.

### 7.2. Privacidad y Visibilidad Diferida
* **Requisito Aprobado:**
  - El delegado **únicamente** puede visualizar su promedio cuantitativo general cuando el periodo de evaluación haya concluido formalmente.
  - El delegado jamás tiene acceso a la identidad de los estudiantes que lo evaluaron ni a sus calificaciones individuales.
  - El docente y el administrador pueden consultar el reporte con el promedio y la lista anonimizada de comentarios estudiantiles.

---

## 8. Trazabilidad y Registro de Auditoría

* **Requisito Aprobado:**
  - Todas las operaciones críticas del ciclo electoral deben quedar registradas en un log inmutable de auditoría.
  - El historial de auditoría es de visualización exclusiva para el rol `administrador`.
  - Ni los usuarios ni el rol de base de datos de la API pueden modificar ni borrar eventos de auditoría.
* **Decisión Técnica Adoptada:**
  - Se define la tabla `eventos_auditoria` con los 4 eventos oficiales:
    1. `'creacion'`: Registrado con actor `'usuario'` (id del docente/admin creador).
    2. `'activacion'`: Registrado automáticamente con actor `'sistema'` al congelar el padrón e iniciar la elección.
    3. `'cancelacion'`: Registrado con actor `'usuario'`, requiriendo obligatoriamente un texto justificativo en `detalle->>'motivo'`.
    4. `'cierre_publicacion'`: Registrado con actor `'sistema'`, almacenando en `detalle` el total de habilitados, participantes y votos.
  - **Seguridad en PostgreSQL:** El trigger `auditar_cambios_eleccion` opera con `SECURITY DEFINER` propiedad de `postgres`. El rol de runtime de la API (`votesecure_api`) posee únicamente permisos de `SELECT` sobre `eventos_auditoria` y carece de permisos de `INSERT`, `UPDATE` o `DELETE`.

---

## 9. Arquitectura Técnica y Stack Tecnológico

```
┌────────────────────────────────────────────────────────┐
│              FRONTEND (React 19 + Vite)                │
│   - Tailwind CSS / Módulos CSS oficiales UTP           │
│   - React Router DOM                                   │
│   - Supabase Client (Suscripción Realtime Broadcast)   │
│   - Axios (withCredentials: true, X-CSRF-Token)        │
└───────────────────────────▲────────────────────────────┘
                            │  HTTPS / Cookies / JSON
┌───────────────────────────▼────────────────────────────┐
│              BACKEND (Node.js + Express + TS)          │
│   - Arquitectura por capas (Presentación / Aplicación) │
│   - Validaciones con Zod                               │
│   - Argon2id / Criptografía con Node Crypto            │
│   - Publicador Supabase Realtime                       │
│   - Integración Resend (SMTP/API)                      │
└───────────────────────────▲────────────────────────────┘
                            │  PostgreSQL Pooler (SET ROLE)
┌───────────────────────────▼────────────────────────────┐
│          BASE DE DATOS (PostgreSQL en Supabase)        │
│   - Esquema Oficial 001_esquema_oficial.sql            │
│   - Roles de Mínimos Privilegios (002_operaciones.sql) │
│   - Procedimientos Transaccionales SECURITY DEFINER    │
│   - Vistas Inmutables de Resultados y Auditoría        │
└────────────────────────────────────────────────────────┘
```

### 9.1. Fijación Estricta de Dependencias y Reproducibilidad
* **Requisito Aprobado:**
  - El frontend se compilará sobre **React 19** con soporte de Vite.
  - Para evitar rupturas inesperadas por actualizaciones de terceros, se eliminan todos los prefijos carret (`^`) y tilde (`~`) en los archivos `package.json` de frontend y backend, fijando las versiones exactas probadas.
  - El entorno se instalará obligatoriamente mediante `npm ci` respetando los archivos `package-lock.json`.

### 9.2. Roles de Base de Datos y Mínimos Privilegios
1. **`votesecure_api`:** Utilizado en el runtime del servidor Node.js.
   - Sin permisos de lectura directa de filas en la tabla `votos` (preservando el secreto del voto incluso ante inyecciones SQL en la API).
   - Sin permisos de inserción manual en `eventos_auditoria`.
   - Sin permisos de actualización arbitraria sobre los estados de las elecciones.
2. **`votesecure_migraciones`:** Empleado únicamente por scripts de despliegue para aplicar el DDL de tablas y funciones.
3. **`votesecure_provisionamiento`:** Utilizado exclusivamente por la CLI local de creación del primer administrador.

---

## 10. Matriz de Contratos de la API REST

| Método | Ruta | Rol Permitido | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/registro` | Público | Registro de estudiante o docente con correo UTP. |
| `POST` | `/api/auth/login` | Público | Autenticación, asignación de cookies de sesión y CSRF. |
| `POST` | `/api/auth/logout` | Autenticado | Revocación inmediata del hash de sesión y limpieza de cookies. |
| `GET` | `/api/auth/yo` | Autenticado | Consulta del perfil de sesión y rol activo. |
| `GET` | `/api/secciones` | Autenticado | Lista las secciones donde el usuario está matriculado o asignado. |
| `POST` | `/api/secciones/unirse` | Estudiante | Enrolamiento en aula mediante código de acceso (`SEC-XXXX`). |
| `POST` | `/api/secciones` | Docente / Admin | Creación de una nueva sección académica. |
| `GET` | `/api/elecciones/:id` | Miembro / Admin | Detalle, candidatos y estado del proceso electoral. |
| `POST` | `/api/elecciones` | Docente / Admin | Creación de elección principal o desempate en borrador. |
| `POST` | `/api/elecciones/:id/activar`| Docente / Admin | Congelamiento de padrón y apertura de la votación. |
| `POST` | `/api/elecciones/:id/votar` | Estudiante | Emisión atómica y anónima del voto. |
| `POST` | `/api/elecciones/:id/cerrar` | Docente / Admin | Cierre manual anticipado o por fin de clase. |
| `GET` | `/api/elecciones/:id/resultados` | Miembro / Admin | Consulta de cómputo en vivo o definitivo según estado. |
| `POST` | `/api/resultados/:id/suscripcion`| Miembro / Admin | Emisión de ticket efímero firmado para canal Supabase Realtime. |
| `POST` | `/api/elecciones/:id/proclamar` | Docente / Admin | Proclamación oficial del delegado electo. |
| `POST` | `/api/evaluaciones/periodos` | Docente / Admin | Apertura del periodo de evaluación con instrucciones. |
| `POST` | `/api/evaluaciones` | Estudiante / Docente | Registro de evaluación y comentario. |
| `GET` | `/api/evaluaciones/delegado` | Autenticado | Resumen de desempeño (delegado solo post-cierre). |
| `GET` | `/api/auditoria/elecciones/:id` | Administrador | Historial inmutable de eventos de la elección. |

---

## 11. Conclusión y Aprobación

Este documento constituye la **fuente de verdad oficial y definitiva** para la arquitectura, el diseño y la codificación de VoteSecure v1.0. Cualquier funcionalidad diferida (banco de preguntas para exámenes, propuestas premium o plugins multi-universitarios) queda formalmente relegada para la versión 2.0 una vez estabilizado y validado el Core Electoral y de Evaluación.
