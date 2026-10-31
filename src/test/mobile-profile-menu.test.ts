import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { canOpenAdministration, profileMenuSections } from '../../mobile/src/lib/profile-menu'

const read = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')
const keys = (access: Parameters<typeof profileMenuSections>[0]) =>
  profileMenuSections(access).flatMap((section) => section.entries.map((entry) => entry.key))

/**
 * El menú del avatar en la app: Administración abre su área en la app y nada
 * que abra otra pantalla nativa (navegador, aviso) se dispara mientras el menú
 * todavía se está cerrando, que en iOS dejaba la app como congelada.
 */
describe('menú de perfil del panel móvil', () => {
  it('un administrador ve Administración y Configuración, en la app', () => {
    const sections = profileMenuSections({ isAdmin: true, isSuperAdmin: false, hasAdministration: true })
    const business = sections.find((section) => section.key === 'business')!
    expect(business.entries.map((entry) => [entry.key, entry.route])).toEqual([
      ['admin', '/admin'],
      ['settings', '/admin/settings'],
    ])
    expect(business.entries.every((entry) => !entry.web)).toBe(true)
  })

  it('Mi perfil abre la pantalla nativa en la app y no la web', () => {
    const entry = profileMenuSections({ isAdmin: false, isSuperAdmin: false, hasAdministration: false })
      .flatMap((section) => section.entries)
      .find((item) => item.key === 'profile')!
    expect(entry.route).toBe('/panel/profile')
    expect(entry.web).toBeUndefined()
  })

  it('Administración usa el mismo permiso que su pantalla', () => {
    expect(canOpenAdministration({ isAdmin: false, isSuperAdmin: false, hasAdministration: true })).toBe(true)
    expect(canOpenAdministration({ isAdmin: false, isSuperAdmin: true, hasAdministration: false })).toBe(true)
    expect(keys({ isAdmin: false, isSuperAdmin: false, hasAdministration: false })).toEqual(['profile', 'marketplace'])
    // Configuración sigue siendo solo para administradores, como en la web.
    expect(keys({ isAdmin: false, isSuperAdmin: false, hasAdministration: true })).not.toContain('settings')
  })

  it('Super Admin sigue en la web y solo para el super admin', () => {
    expect(keys({ isAdmin: true, isSuperAdmin: false, hasAdministration: true })).not.toContain('superadmin')
    const entry = profileMenuSections({ isAdmin: true, isSuperAdmin: true, hasAdministration: true })
      .flatMap((section) => section.entries)
      .find((item) => item.key === 'superadmin')!
    expect(entry.web).toBe('/superadmin')
  })

  it('el menú de perfil espera a cerrarse antes de abrir la web o un aviso', () => {
    const menus = read('components/panel-menus.tsx')
    const profile = menus.slice(menus.indexOf('function ProfileMenu'))
    expect(profile).toMatch(/onDismiss=\{onDismiss\}/)
    expect(profile).toMatch(/if \(after\) schedule\(after\)/)
    // Ya no abre la web ni el aviso en el mismo toque en que se cierra.
    expect(profile).not.toMatch(/onClose\(\);\s*\n\s*void openWeb/)
    expect(profile).not.toMatch(/onClose\(\);\s*\n\s*Alert\.alert/)
    expect(profile).not.toMatch(/web\('\/admin'\)/)
  })

  it('el menú lateral de Administración también espera para abrir la web', () => {
    const chrome = read('components/admin-chrome.tsx')
    expect(chrome).toMatch(/onDismiss=\{onDismiss\}/)
    expect(chrome).toMatch(/if \(item\.web\) schedule\(\(\) => go\(item\)\)/)
  })

  it('el cajón abre Administración directo, sin pasar por la redirección', () => {
    expect(read('components/panel-menus.tsx')).toMatch(/key === 'administration' \? '\/admin'/)
  })
})
