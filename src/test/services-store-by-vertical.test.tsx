import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileQuickActions } from '@/components/profile/profile-quick-actions'
import { customerLinkBenefits } from '@/components/public/CustomerLinkBanner'
import { ProfileAccountSummary } from '@/components/profile/profile-account-summary'
import type { CustomerAccountSummary } from '@/lib/profile/customer-account-summary'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { getBrandTheme } from '@/lib/constants/brand-theme'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const flow = [{ id: 'turnos', title: 'Turnos', description: '', active: true, steps: [{ id: 's1', number: 1, title: 'Elegí tu servicio', description: 'Corte o barba.' }] }]

describe('una barbería no muestra cosas de tienda o de taller', () => {
  it('el catálogo público deja afuera los servicios de la agenda', () => {
    expect(leer('src/app/api/public/products/route.ts')).toContain('.or(NOT_A_SERVICE_FILTER)')
    expect(leer('src/lib/public/public-products.ts')).toContain("'unit_measure.is.null,unit_measure.neq.servicio'")
  })

  it('«Tienda» sigue en el header con el módulo de inventario', () => {
    expect(leer('src/app/[organizationSlug]/layout.tsx')).toContain("const catalogEnabled = await isOrganizationModuleEnabled(storefrontOrganization.id, 'inventory')")
  })

  it('las facetas y categorías del catálogo tampoco cuentan los servicios', () => {
    const servidor = leer('src/lib/api/products-server.ts')
    expect(servidor.match(/NOT_A_SERVICE_FILTER/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('«Cómo atendés» explica cómo reservar y lleva a reservar', () => {
    render(<ProcessSteps brand={getBrandTheme('blue')} flows={flow} variant="services" bookingHref="/barber/turnos" phoneClean="595981123456" />)
    expect(screen.getByRole('heading', { name: '¿Cómo reservar tu turno?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reservar turno/ })).toHaveAttribute('href', '/barber/turnos')
    expect(screen.queryByText(/Explorar Catálogo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/coordinar envíos/)).not.toBeInTheDocument()
  })

  it('una tienda sigue explicando cómo comprar', () => {
    render(<ProcessSteps brand={getBrandTheme('blue')} flows={flow} tenantPrefix="/tienda" />)
    expect(screen.getByRole('heading', { name: '¿Cómo comprar en nuestra tienda?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explorar Catálogo/ })).toHaveAttribute('href', '/tienda/productos')
  })

  it('el perfil de una barbería ofrece reservar y no carritos, créditos ni reparaciones', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/barber" showRepairs={false} showShopping={false} showCredits={false} bookingHref="/barber/turnos" />)
    expect(screen.getByRole('link', { name: /Reservar turno/ })).toHaveAttribute('href', '/barber/turnos')
    expect(screen.queryByText('Carritos en tiendas')).not.toBeInTheDocument()
    expect(screen.queryByText('Mis Favoritos')).not.toBeInTheDocument()
    expect(screen.queryByText('Créditos y cuotas')).not.toBeInTheDocument()
    expect(screen.queryByText('Rastrear equipo')).not.toBeInTheDocument()
  })

  it('«Ser cliente» no promete reparaciones a una barbería', () => {
    expect(customerLinkBenefits({ servicesEnabled: true })).toBe('Accedé a promociones exclusivas, seguimiento de tus compras y tus turnos.')
    expect(customerLinkBenefits({ repairsEnabled: true })).toContain('tus reparaciones')
    expect(customerLinkBenefits()).not.toMatch(/reparaci/)
    expect(leer('src/app/[organizationSlug]/layout.tsx')).toContain('repairsEnabled={repairsModuleEnabled}')
  })

  it('la vista previa en redes describe la tienda, no la plataforma', () => {
    expect(leer('src/app/[organizationSlug]/layout.tsx')).toContain("twitter: { card: 'summary_large_image', title: name")
  })

  it('el estado de cuenta de una barbería no habla de reparaciones ni cuotas', () => {
    const summary = {
      netBalance: 0, storeCredit: 0,
      financing: { pendingAmount: 0, overdueAmount: 0, overdueCount: 0 },
      repairs: { pendingAmount: 0, pendingCount: 0, paidCount: 0 },
      orders: { pendingAmount: 0, pendingCount: 0, paidCount: 0 },
    } as unknown as CustomerAccountSummary
    render(<ProfileAccountSummary summary={summary} tenantPrefix="/barber" features={{ repairs: false, credits: false, orders: true }} />)
    expect(screen.queryByText('Reparaciones por pagar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ver reparaciones/)).not.toBeInTheDocument()
    expect(screen.queryByText('Cuotas de crédito')).not.toBeInTheDocument()
    expect(screen.getByText('Pedidos por pagar')).toBeInTheDocument()
  })

  it('la barra inferior espera a hidratar antes de usar la agenda', () => {
    expect(leer('src/components/public/services/ServicesMobileNav.tsx')).toContain('const agenda = hydrated ? agendaState.agenda : null')
  })

  it('una tienda común conserva todos los accesos', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/tienda" />)
    expect(screen.getByText('Carritos en tiendas')).toBeInTheDocument()
    expect(screen.getByText('Créditos y cuotas')).toBeInTheDocument()
    expect(screen.queryByText('Reservar turno')).not.toBeInTheDocument()
  })
})
