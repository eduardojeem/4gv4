import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Navegación del área de Administración, la misma de /admin en la web
 * (src/config/admin-navigation.ts). Lo que tiene pantalla en la app abre
 * acá (`route`); el resto abre la página de la web (`web`).
 */
export type AdminNavItem = { key: string; label: string; hint: string; icon: IconName; route?: string; web?: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Análisis',
    items: [
      { key: 'overview', label: 'Resumen', hint: 'Vista general del negocio', icon: 'speedometer-outline', route: '/admin' },
      { key: 'analytics', label: 'Analítica', hint: 'Visitas web y rendimiento', icon: 'analytics-outline', route: '/admin/analytics' },
      { key: 'reports', label: 'Reportes', hint: 'Informes y resultados', icon: 'document-text-outline', web: '/admin/reports' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { key: 'cash', label: 'Monitor de cajas', hint: 'Cajas abiertas en todas las sucursales', icon: 'cash-outline', route: '/admin/cash' },
      { key: 'inventory', label: 'Inventario', hint: 'Productos y stock', icon: 'cube-outline', web: '/admin/inventory' },
      { key: 'finances', label: 'Finanzas', hint: 'Resumen, cobros y vencimientos', icon: 'wallet-outline', route: '/admin/finances' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { key: 'users', label: 'Usuarios', hint: 'Invitar, roles y accesos', icon: 'people-outline', route: '/admin/users' },
      { key: 'branches', label: 'Sucursales', hint: 'Multi sucursal', icon: 'business-outline', route: '/admin/branches' },
    ],
  },
  {
    label: 'Canal digital',
    items: [
      { key: 'website', label: 'Sitio web', hint: 'Tu tienda online', icon: 'globe-outline', route: '/admin/website' },
      { key: 'reviews', label: 'Reseñas', hint: 'Moderar y responder', icon: 'star-outline', route: '/admin/reviews' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'subscriptions', label: 'Suscripción', hint: 'Plan, cuotas y límites', icon: 'card-outline', route: '/admin/subscriptions' },
      { key: 'security', label: 'Seguridad', hint: 'Logs y auditoría', icon: 'shield-checkmark-outline', web: '/admin/security' },
      { key: 'settings', label: 'Configuración', hint: 'Impuestos, moneda y negocio', icon: 'settings-outline', route: '/admin/settings' },
      { key: 'business', label: 'Datos del negocio', hint: 'Rubro, contacto y visibilidad', icon: 'storefront-outline', web: '/admin/onboarding' },
    ],
  },
  {
    label: 'Ayuda',
    items: [{ key: 'guide', label: 'Guía del sistema', hint: 'Cómo funciona cada sección', icon: 'help-circle-outline', web: '/admin/guia' }],
  },
];

/** Pestañas directas de la barra inferior de Administración (junto al botón central de Comando). */
export const ADMIN_TABS = ['overview', 'finances', 'branches'];
export const ADMIN_DOCK_TABS = ['overview', 'finances', 'cash', 'settings'] as const;


export const adminItem = (key: string) => ADMIN_NAV.flatMap((group) => group.items).find((item) => item.key === key);

export function isAdminRouteActive(pathname: string, item?: AdminNavItem | null): boolean {
  if (!item?.route) return false;
  return item.route === '/admin' ? pathname === '/admin' : pathname === item.route || pathname.startsWith(`${item.route}/`);
}

export function isAdminCommandSecondaryActive(pathname: string): boolean {
  const dockRoutes = ADMIN_DOCK_TABS.map(adminItem).filter((item): item is AdminNavItem => Boolean(item));
  if (dockRoutes.some((item) => isAdminRouteActive(pathname, item))) return false;
  return pathname.startsWith('/admin');
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function filterAdminCommandItems(query: string): (AdminNavItem & { group: string })[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const all = ADMIN_NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
  if (!terms.length) return all;
  return all.filter((item) => {
    const haystack = normalize([item.group, item.label, item.hint, item.key].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}

export const ADMIN_MORE_GROUPS = [
 {label:'Gestión',keys:['users','branches','inventory','reports']},
 {label:'Tienda online',keys:['website','reviews','business']},
 {label:'Cuenta y sistema',keys:['subscriptions','security','analytics','guide']},
] as const;
export function adminMenuSingleColumn(width:number,fontScale:number){return width<360||fontScale>=1.25;}
