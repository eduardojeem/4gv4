import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleDisplayName, PLAN_FEATURES } from '@/lib/saas/plan-feature-catalog'
import { ORGANIZATION_MODULES } from '@/lib/organization/business-profile'

const leer = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('nombres de módulos iguales al plan', () => {
  it('cada módulo del sistema tiene su nombre en el catálogo de planes', () => {
    for (const organizationModule of ORGANIZATION_MODULES) {
      expect(PLAN_FEATURES.some((feature) => feature.module === organizationModule), organizationModule).toBe(true)
    }
    expect(moduleDisplayName('repairs')).toBe('Módulo de Reparaciones')
  })

  it('las pantallas de módulos toman el nombre del catálogo, no uno propio', () => {
    for (const path of [
      'src/components/superadmin/organizations/OrganizationDetailView.tsx',
      'src/components/superadmin/organizations/EditOrganizationDialog.tsx',
      'src/components/admin/settings/BusinessProfileCard.tsx',
      'src/components/dashboard/onboarding/OnboardingClient.tsx',
    ]) {
      const source = leer(path)
      expect(source, path).toContain('moduleDisplayName(')
      expect(source, path).not.toMatch(/Taller & SAT|Analítica & KPIs|Tienda Online Pública|Directorio de Clientes/)
    }
  })
})
