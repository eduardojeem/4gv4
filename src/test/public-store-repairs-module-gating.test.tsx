import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./change-password-dialog', () => ({ ChangePasswordDialog: () => null }))
vi.mock('@/components/profile/change-password-dialog', () => ({ ChangePasswordDialog: () => null }))

import { ProfileQuickActions } from '@/components/profile/profile-quick-actions'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * La tienda publica no miraba los modulos. «Mis reparaciones» dependia solo de
 * la configuracion del sitio, y `/mis-reparaciones` respondia aunque la
 * organizacion no tuviera taller.
 */
describe('tienda pública sin taller', () => {
  it('el layout resuelve el módulo en el servidor y se lo pasa al footer', () => {
    const layout = leer('src/app/[organizationSlug]/layout.tsx')
    expect(layout).toContain("const repairsModuleEnabled = await isOrganizationModuleEnabled(storefrontOrganization.id, 'repairs')")
    expect(layout).toContain('<PublicFooter initialSettings={settings} repairsModuleEnabled={repairsModuleEnabled} />')
  })

  it('el footer exige el módulo además de la configuración del sitio', () => {
    expect(leer('src/components/public/PublicFooter.tsx')).toContain(
      'const repairsEnabled = repairsModuleEnabled && isPublicRepairsAvailable(company, effectiveSettings?.services)'
    )
  })

  it('la lista y el detalle de reparaciones responden 404 sin el módulo', () => {
    const guardia = "!(await isOrganizationModuleEnabled(organization.id, 'repairs'))) notFound()"
    expect(leer('src/app/(public)/mis-reparaciones/page.tsx')).toContain(guardia)
    expect(leer('src/app/(public)/mis-reparaciones/[ticketId]/page.tsx')).toContain(guardia)
  })

  it('el marketplace no queda afectado: sin tienda no se consulta el módulo', () => {
    // La guardia se aplica solo cuando hay una organización resuelta.
    expect(leer('src/app/(public)/mis-reparaciones/page.tsx')).toContain("if (organization && !(await isOrganizationModuleEnabled(")
    expect(leer('src/app/(public)/perfil/page.tsx')).toContain(
      "const repairsAvailable = organizationId ? await isOrganizationModuleEnabled(organizationId, 'repairs') : true"
    )
  })

  it('si no se pueden leer los módulos, no se oculta nada', () => {
    const helper = leer('src/lib/saas/organization-module-check.ts')
    expect(helper).toContain('return info.effectiveModules.includes(module)')
    expect(helper).toMatch(/catch \(error\) \{[\s\S]*return true/)
  })
})

describe('«Rastrear equipo» en el perfil', () => {
  it('sin taller no aparece en la vista de actividad', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/tienda-demo" variant="marketplace" showAuthorizedPersons={false} showRepairs={false} />)
    expect(screen.queryByRole('link', { name: /Rastrear equipo/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Favoritos/i })).toBeInTheDocument()
  })

  it('por defecto sigue apareciendo', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/tienda-demo" variant="marketplace" showAuthorizedPersons={false} />)
    expect(screen.getByRole('link', { name: /Rastrear equipo/i })).toHaveAttribute('href', '/tienda-demo/mis-reparaciones')
  })

  it('sin taller tampoco aparece en la vista completa', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/tienda-demo" showRepairs={false} />)
    expect(screen.queryByText('Rastrear equipo')).not.toBeInTheDocument()
  })

  it('la página de perfil de la tienda le pasa la decisión', () => {
    expect(leer('src/app/(public)/perfil/profile-client.tsx')).toContain(
      "<ProfileQuickActions role={profile.role || 'cliente'} tenantPrefix={linkPrefix} showRepairs={repairsAvailable} />"
    )
  })
})
