# Panel de docentes y administradores

Todo el panel vive en `frontend/src/panel/`. Rutas bajo `/panel`. Lo ven los tipos
`docente` y `administrador`; los estudiantes siguen en `/cursos`.

## Quién hace cuál

| Integrante | Rama | Archivos (en `panel/`) |
|---|---|---|
| Jhonatan Navarro | `feature/panel-base` | `PanelLayout.jsx`, `menu.js`, `pages/InicioPanel.jsx`, `pages/CuentasPage.jsx`, `pages/AuditoriaPage.jsx`, `pages/ProyectorPage.jsx` y los cambios en `AppRouter.jsx`, `Navbar.jsx`, `App.jsx` |
| Tatiana Rojas | `feature/panel-secciones` | `pages/SeccionesPage.jsx`, `pages/SeccionDetallePage.jsx`, `components/TabMatriculados.jsx`, `components/AdminAsignaciones.jsx` |
| Elton Vacas | `feature/panel-elecciones` | `pages/NuevaEleccionPage.jsx`, `pages/EleccionPage.jsx`, `components/TabElecciones.jsx`, `components/Candidaturas.jsx`, `components/Habilitaciones.jsx` |
| Dalia Pariachi | `feature/panel-ciclo-evaluaciones` | `components/AccionesCiclo.jsx`, `components/TabEvaluaciones.jsx`, `components/PeriodosEvaluacion.jsx`, `components/ResumenEvaluaciones.jsx` |

Cada quien crea su propio servicio (por ejemplo `services/seccion.panel.service.js`)
y **nadie edita el servicio de otro**.

## Rutas (ya conectadas en `AppRouter.jsx`)

| Ruta | Archivo | Quién la ve |
|---|---|---|
| `/panel` | `pages/InicioPanel.jsx` | docente, administrador |
| `/panel/secciones` | `pages/SeccionesPage.jsx` | docente, administrador |
| `/panel/secciones/:id` | `pages/SeccionDetallePage.jsx` | docente, administrador |
| `/panel/secciones/:id/elecciones/nueva` | `pages/NuevaEleccionPage.jsx` | docente, administrador |
| `/panel/elecciones/:id` | `pages/EleccionPage.jsx` | docente, administrador |
| `/panel/cuentas` | `pages/CuentasPage.jsx` | solo administrador |
| `/panel/auditoria` | `pages/AuditoriaPage.jsx` | solo administrador |
| `/panel/elecciones/:id/proyector` | `pages/ProyectorPage.jsx` | docente, administrador (pantalla completa) |

## Cómo reemplazar un placeholder

1. Abre el archivo que te toca (dice tu nombre en el comentario de arriba).
2. Reemplaza **todo su contenido** por tu pantalla. Conserva el nombre del archivo y
   `export default`: el router ya lo importa así, no hace falta tocar `AppRouter.jsx`.
3. Si necesitas una ruta nueva o una opción de menú, pídesela a Navarro.

## Puntos de unión (para no chocar)

- **Detalle de sección** (Tatiana) importa `TabElecciones` (Elton) y `TabEvaluaciones` (Dalia).
  Props: `seccionId`. Ya existen como placeholders: no cambies sus nombres ni sus props.
- **Gestionar elección** (Elton) inserta `<AccionesCiclo estado={...} eleccion={...} />` (Dalia).
  Dalia recibe la elección por props y no toca la página de Elton.
- **Ya existe y se reutiliza:** proclamar y desempate (`ResultadosPage`), el hook
  `useResultadosEnVivo`, la valoración docente (`EvaluarDelegadoPage`) y el perfil.

## Convenciones de diseño

- Envuelve tu pantalla en `<div className="panel-pagina">` y usa las clases compartidas de
  `panel/panel.css`:
  - `panel-cabecera` (título + subtítulo), `panel-tarjeta`, `panel-rejilla`, `panel-resumen` + `panel-dato` (cifras)
  - `panel-boton` (`-rojo`, `-gris`, `-claro`, `-peligro`, `-chico`)
  - `panel-aviso` (`-error`, `-ok`, `-info`) y `panel-pildora` (`tono-rojo|verde|gris|azul|amarillo`)
  - `panel-barra` + `panel-busqueda` + `panel-filtros`/`panel-filtro` (buscador y filtros), `panel-select`
  - `panel-tabla-caja` + `panel-tabla` (tablas), `panel-persona` (avatar + nombre + correo)
  - `panel-vacio` y `panel-cargando` (estados sin datos y de carga)
- `components/ModalConfirmar.jsx`: ventana de confirmación reutilizable (desactivar, cancelar...).
  Props: `titulo`, `texto`, `textoConfirmar`, `peligro`, `enviando`, `error`, `alConfirmar`, `alCancelar`.
- `formato.js`: `ESTADO_ELECCION` (estado -> texto y color), `ETIQUETA_ROL`, `fechaHoraCompleta`, `porcentaje`.
- Si necesitas estilos propios, crea tu CSS con un prefijo propio (por ejemplo `.secciones-...`).
- Llama a la API con `import api from '../../services/api'` (ya envía cookies y CSRF).
  Ojo: lo que se ENVÍA al backend va en español (`codigoCurso`); lo que se RECIBE de
  secciones, matrículas y elecciones viene en inglés camelCase (`courseName`).

## Tamaño del panel

- Letra base: variable `--p-texto` (arriba de `panel.css`). Súbela o bájala y todo el panel
  acompaña (por defecto `1.05rem`).
- Ancho de la pantalla: `.marco-contenido.ancho` en `components/Marco.css` (por defecto `1500px`).

## Lo que ya está hecho (Navarro)

`InicioPanel` (cifras, votaciones en curso y accesos), `CuentasPage` (buscar, filtrar,
activar/desactivar con confirmación), `AuditoriaPage` (historial por elección) y
`ProyectorPage` (resultados en vivo a pantalla completa, con el hook `useResultadosEnVivo`).
Sus servicios: `cuentas.panel.service.js`, `auditoria.panel.service.js`,
`proyector.panel.service.js` e `inicio.panel.service.js`.

Desde "Gestionar elección" (Elton) se enlaza el proyector con
`<Link to={`/panel/elecciones/${id}/proyector`}>`.
