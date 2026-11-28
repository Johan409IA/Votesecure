import { BookOpen, LayoutDashboard, ScrollText, Users } from 'lucide-react';

// Menú lateral del panel. UN SOLO LUGAR para agregar o quitar opciones:
// el PanelLayout y la pantalla de inicio del panel se arman a partir de esta lista.
//
//   to           ruta a la que lleva
//   etiqueta     texto del menú
//   descripcion  texto de la tarjeta en la pantalla de inicio del panel
//   icono        componente de lucide-react
//   roles        tipos de usuario que lo ven ('docente', 'administrador')
//   fin          true solo para "Inicio" (evita que quede activo en todas las rutas)
//   tambien      otras rutas que también marcan esta opción como activa
export const MENU = [
  {
    to: '/panel',
    etiqueta: 'Inicio',
    descripcion: 'Resumen del panel.',
    icono: LayoutDashboard,
    roles: ['docente', 'administrador'],
    fin: true,
  },
  {
    to: '/panel/secciones',
    etiqueta: 'Secciones',
    descripcion: 'Crea secciones, gestiona matriculados, elecciones y evaluaciones.',
    icono: BookOpen,
    roles: ['docente', 'administrador'],
    tambien: ['/panel/elecciones'],
  },
  {
    to: '/panel/cuentas',
    etiqueta: 'Cuentas',
    descripcion: 'Busca cuentas y activa o desactiva el acceso.',
    icono: Users,
    roles: ['administrador'],
  },
  {
    to: '/panel/auditoria',
    etiqueta: 'Auditoría',
    descripcion: 'Consulta el historial de eventos de cada elección.',
    icono: ScrollText,
    roles: ['administrador'],
  },
];

export const ROLES_PANEL = ['docente', 'administrador'];
export const SOLO_ADMIN = ['administrador'];

export const menuParaRol = (tipo) => MENU.filter((item) => item.roles.includes(tipo));
