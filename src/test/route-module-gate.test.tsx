import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/dashboard/customers'
let status = {
  effectiveModules: ['pos', 'crm'] as string[],
  entitledModules: ['pos', 'crm'] as string[],
  moduleTrials: [] as Array<{ module: string }>,
  businessVertical: 'electronics',
}

vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => status }))
vi.mock('@/components/admin/PlanGate', () => ({ PlanGate: () => <p>Mejorá tu plan</p> }))

const { RouteModuleGate } = await import('@/components/admin/RouteModuleGate')

const dibujar = () => render(<RouteModuleGate><p>Contenido</p></RouteModuleGate>)

beforeEach(() => {
  pathname = '/dashboard/customers'
  status = { effectiveModules: ['pos', 'crm'], entitledModules: ['pos', 'crm'], moduleTrials: [], businessVertical: 'electronics' }
})

describe('el bloqueo único por ruta', () => {
  it('con el módulo activo muestra la página', () => {
    dibujar()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('con el módulo apagado por la tienda dice que está desactivado, no que mejore el plan', () => {
    status = { ...status, effectiveModules: ['pos'] }
    dibujar()
    expect(screen.getByText('Módulo desactivado para esta organización')).toBeInTheDocument()
    expect(screen.queryByText('Mejorá tu plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
  })

  it('si el plan no lo incluye ofrece mejorarlo', () => {
    pathname = '/admin/finances'
    dibujar()
    expect(screen.getByText('Mejorá tu plan')).toBeInTheDocument()
  })

  it('protege las páginas que no tenían bloqueo: Informes y Monitor de caja', () => {
    pathname = '/admin/reports/products'
    dibujar()
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
    pathname = '/admin/cash-monitor'
    status = { ...status, effectiveModules: ['crm'], entitledModules: ['crm'] }
    dibujar()
    expect(screen.getAllByText('Mejorá tu plan').length).toBeGreaterThan(0)
  })

  it('una sección de otro rubro avisa en vez de mostrarse', () => {
    pathname = '/dashboard/vencimientos'
    status = { ...status, effectiveModules: ['inventory'], entitledModules: ['inventory'] }
    dibujar()
    expect(screen.getByText('Esta sección no es para el rubro de tu negocio')).toBeInTheDocument()
  })

  it('las secciones sin módulo se muestran siempre', () => {
    pathname = '/admin/settings'
    status = { ...status, effectiveModules: [] }
    dibujar()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })
})

describe('dónde está puesto', () => {
  it('envuelve las páginas del admin y del dashboard', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/app/admin/layout.tsx'), 'utf8')).toContain('<RouteModuleGate>{children}</RouteModuleGate>')
    expect(readFileSync(resolve(process.cwd(), 'src/app/dashboard/layout.tsx'), 'utf8')).toContain('<RouteModuleGate>{children}</RouteModuleGate>')
  })

  it('los accesos directos del admin piden lo mismo que el menú', () => {
    const portada = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')
    expect(portada).toContain("isRouteAvailable('/admin/finances', effectiveModules)")
    expect(portada).toContain("isRouteAvailable('/admin/inventory', effectiveModules)")
    expect(portada).toContain("isRouteAvailable('/admin/cash-monitor', effectiveModules)")
  })
})
