import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ADMIN_MORE_GROUPS,
  adminMenuSingleColumn,
  ADMIN_DOCK_TABS,
  adminItem,
  filterAdminCommandItems,
  isAdminCommandSecondaryActive,
  isAdminRouteActive,
} from '../../mobile/src/lib/admin-nav'

const readMobile = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')

describe('navegación de administración móvil y Centro de Comando', () => {
  it('mantiene las 4 pestañas nativas del dock junto al Centro de Comando', () => {
    expect([...ADMIN_DOCK_TABS]).toEqual(['overview', 'finances', 'cash', 'settings'])
    expect(ADMIN_DOCK_TABS.every((key) => Boolean(adminItem(key)?.route))).toBe(true)
    const keys=ADMIN_MORE_GROUPS.flatMap(group=>group.keys);
    expect(keys).toContain('security');
    expect(keys).toContain('subscriptions');
    expect(keys).toContain('business');
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys,...ADMIN_DOCK_TABS].sort()).toEqual(['overview','analytics','reports','cash','inventory','finances','users','branches','website','reviews','subscriptions','security','settings','business','guide'].sort());
  })

  it('distingue rutas activas del dock de rutas secundarias del Centro de Comando', () => {
    const overview = adminItem('overview')
    const settings = adminItem('settings')

    expect(isAdminRouteActive('/admin', overview)).toBe(true)
    expect(isAdminRouteActive('/admin/cash', overview)).toBe(false)
    expect(isAdminRouteActive('/admin/settings/regional', settings)).toBe(true)

    expect(isAdminCommandSecondaryActive('/admin')).toBe(false)
    expect(isAdminCommandSecondaryActive('/admin/finances')).toBe(false)
    expect(isAdminCommandSecondaryActive('/admin/cash')).toBe(false)
    expect(isAdminCommandSecondaryActive('/admin/settings/company')).toBe(false)

    expect(isAdminCommandSecondaryActive('/admin/users')).toBe(true)
    expect(isAdminCommandSecondaryActive('/admin/branches')).toBe(true)
    expect(isAdminCommandSecondaryActive('/admin/website/home')).toBe(true)
    expect(isAdminCommandSecondaryActive('/admin/reviews')).toBe(true)
  })

  it('filtra módulos sin importar tildes o mayúsculas', () => {
    expect(filterAdminCommandItems('analitica').map((i) => i.key)).toContain('analytics')
    expect(filterAdminCommandItems('resenas').map((i) => i.key)).toContain('reviews')
    expect(filterAdminCommandItems('seguridad logs').map((i) => i.key)).toContain('security')
    expect(filterAdminCommandItems('inexistente-xyz')).toEqual([])
  })

  it('unifica los accesos al menú y conserva el cierre antes del navegador',()=>{
    const menu=readMobile('components/admin-command-menu.tsx'),chrome=readMobile('components/admin-chrome.tsx');
    expect(chrome).not.toContain('AdminDrawer');
    expect(menu).toContain('Buscar sección');
    expect(menu).toContain('Volver al Panel');
    expect(menu).toContain('onDismiss={onDismiss}');
    expect(menu).toContain('schedule(action)');
    expect(menu).not.toContain('returnHeroCard');
    expect(menu).not.toContain('En vivo');
    expect(chrome).not.toContain('fetchOverview');
  });
  it('deduplica analítica y conserva la búsqueda por visitas',()=>{expect(filterAdminCommandItems('visitas').map(item=>item.key)).toEqual(['analytics']);});
  it('permite leer opciones completas en pantallas chicas o letra ampliada',()=>{expect(adminMenuSingleColumn(320,1)).toBe(true);expect(adminMenuSingleColumn(390,1.3)).toBe(true);expect(adminMenuSingleColumn(390,1)).toBe(false);});
});
