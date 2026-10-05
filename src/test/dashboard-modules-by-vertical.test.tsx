import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { filterDashboardNavGroups } from '@/config/dashboard-navigation'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { SubscriptionStatusProvider, type SubscriptionStatusData } from '@/contexts/SubscriptionStatusContext'
import { getSuggestedModules } from '@/lib/organization/business-profile'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const menuFor = (effectiveModules: readonly string[]) =>
  filterDashboardNavGroups({ role: 'admin', effectiveModules, hasPermission: () => true })
    .flatMap((group) => group.items.map((item) => item.key))

describe('dashboard menu by business vertical', () => {
  it('lets a service-only barbershop reach its services, agenda and register', () => {
    // «Prestación de servicios» sin inventario: los servicios se cargan en Productos.
    const menu = menuFor(['crm', 'services', 'pos'])
    expect(menu).toEqual(expect.arrayContaining(['agenda', 'products', 'pos', 'cash-register', 'customers']))
    expect(menu).not.toContain('categories')
    expect(menu).not.toContain('suppliers')
    expect(menu).not.toContain('repairs')
    expect(menu).not.toContain('orders')
  })

  it('gives a clothing store its catalog and orders but no agenda or workshop', () => {
    const menu = menuFor(getSuggestedModules('clothing', 'retail'))
    expect(menu).toEqual(expect.arrayContaining(['products', 'categories', 'brands', 'orders', 'promotions']))
    expect(menu).not.toContain('agenda')
    expect(menu).not.toContain('repairs')
  })

  it('gives a phone repair shop its workshop', () => {
    const menu = menuFor(getSuggestedModules('electronics', 'repair'))
    expect(menu).toEqual(expect.arrayContaining(['repairs', 'repair-inventory', 'technician', 'products']))
  })
})

const status: SubscriptionStatusData = {
  status: 'active', isBlocked: false, isTrialing: false, trialDaysLeft: null, periodDaysLeft: null,
  planCode: 'BASIC', planName: 'Basic', repairPhotoLimit: 0, repairPhotoUpgradePlan: null,
  modules: ['services'], entitledModules: ['services'], enabledModules: null,
  effectiveModules: ['services'], businessVertical: 'barbershop', operatingModel: 'service', downgradedFromExpiry: false,
  moduleTrials: [], trialedModules: [], organizationName: 'Barber', organizationLogoUrl: null,
}

describe('module gate with alternatives', () => {
  it('opens when any of the listed modules is in use', () => {
    render(<SubscriptionStatusProvider value={status}>
      <OrganizationModuleGate module={['inventory', 'services']}><p>Catálogo</p></OrganizationModuleGate>
    </SubscriptionStatusProvider>)
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
  })
})

describe('dashboard routes are closed without their module', () => {
  it('protects catalog, register and module screens even when opened by URL', () => {
    expect(read('src/app/dashboard/products/layout.tsx')).toContain("module={['inventory', 'services']}")
    for (const route of ['categories', 'brands', 'suppliers', 'products-modern', 'catalog']) {
      expect(read(`src/app/dashboard/${route}/layout.tsx`)).toContain('<OrganizationModuleGate module="inventory">')
    }
    expect(read('src/app/dashboard/pos/layout.tsx')).toContain('<OrganizationModuleGate module="pos">')
    // Distinguen «no está en tu plan» de «lo ocultaste en el perfil del negocio».
    for (const page of ['agenda/page.tsx', 'credits/page.tsx', 'quotes/page.tsx', 'promotions/page.tsx', 'inventory-count/page.tsx']) {
      expect(read(`src/app/dashboard/${page}`)).toContain('<OrganizationModuleGate')
    }
  })

  it('only offers the overview shortcuts the account can use', () => {
    const dashboard = read('src/app/dashboard/page.tsx')
    expect(dashboard).toContain("hasPos ? [{ title: 'Nueva venta'")
    expect(dashboard).toContain("hasServices ? [{ title: 'Nuevo turno'")
    expect(dashboard).toContain('{hasPos && <CashStatusBanner')
    expect(dashboard).toContain("hasInventory ? [{ title: 'Stock bajo'")
  })
})
