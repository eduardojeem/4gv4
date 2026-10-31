/**
 * Qué muestra el menú del avatar. Lo que tiene pantalla en la app abre acá
 * (`route`); lo que no, abre la web (`web`). Mismos permisos que la web.
 */
export type ProfileMenuEntry = {
  key: 'profile' | 'admin' | 'settings' | 'superadmin' | 'marketplace';
  icon: 'person-circle-outline' | 'shield-checkmark-outline' | 'settings-outline' | 'planet-outline' | 'storefront-outline';
  title: string;
  subtitle: string;
  route?: string;
  web?: string;
};
export type ProfileMenuSection = { key: string; label: string; entries: ProfileMenuEntry[] };

type Access = { isAdmin: boolean; isSuperAdmin: boolean; hasAdministration: boolean };

/** El área de Administración se abre en la app, con el mismo permiso que su pantalla. */
export const canOpenAdministration = ({ isAdmin, isSuperAdmin, hasAdministration }: Access) => isAdmin || isSuperAdmin || hasAdministration;

export function profileMenuSections(access: Access): ProfileMenuSection[] {
  const sections: ProfileMenuSection[] = [
    {
      key: 'account',
      label: 'Cuenta',
      entries: [{ key: 'profile', icon: 'person-circle-outline', title: 'Mi perfil', subtitle: 'Nombre, foto y contraseña', route: '/panel/profile' }],
    },
  ];

  const business: ProfileMenuEntry[] = [];
  if (canOpenAdministration(access)) {
    business.push({ key: 'admin', icon: 'shield-checkmark-outline', title: 'Administración', subtitle: 'Equipo, cajas, finanzas y reseñas', route: '/admin' });
  }
  if (access.isAdmin) {
    business.push({ key: 'settings', icon: 'settings-outline', title: 'Configuración', subtitle: 'Empresa, moneda e impuestos', route: '/admin/settings' });
  }
  if (access.isSuperAdmin) {
    business.push({ key: 'superadmin', icon: 'planet-outline', title: 'Super Admin', subtitle: 'Panel global SaaS', web: '/superadmin' });
  }
  if (business.length) sections.push({ key: 'business', label: 'Comercio', entries: business });

  sections.push({
    key: 'more',
    label: 'Más',
    entries: [{ key: 'marketplace', icon: 'storefront-outline', title: 'Ver el marketplace', subtitle: 'Volver a la vitrina pública', route: '/' }],
  });
  return sections;
}
