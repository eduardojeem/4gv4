import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'
import { StorefrontHeader, StorefrontMobileNav } from '@/components/public/StorefrontShell'
import { PublicFooter } from '@/components/public/PublicFooter'
import { ServicesGrid } from '@/components/public/inicio/ServicesGrid'
import type { Service } from '@/types/website-settings'

const state = vi.hoisted(() => ({ settings: null as (WebsiteSettings & { paymentControls?: Record<string, boolean> }) | null, offers: [] as unknown[] }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tienda/inicio' }))
vi.mock('@/components/public/storefront-style-context', () => ({ useStorefrontStyle: () => 'informatica-electronica' }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: state.settings }) }))
vi.mock('@/hooks/use-hydrated', () => ({ useHydrated: () => true }))
vi.mock('swr', () => ({ default: (key: string | null) => ({ data: key ? state.offers : undefined }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ count: 0 }) }))
vi.mock('@/contexts/cart-drawer-context', () => ({ useCartDrawer: () => ({ open: vi.fn() }) }))
vi.mock('@/components/public/AuthModal', () => ({ AuthModal: () => null }))
vi.mock('@/components/public/PublicHeader', () => ({ PublicHeader: (props: object) => <div data-testid="header-flags">{JSON.stringify(props)}</div> }))

beforeEach(() => {
  state.settings = { company_info: { name: 'Comercio' }, offers_section: { enabled: true }, checkout: { commerceMode: 'whatsapp', payment: { cash: { enabled: true, label: 'Efectivo' }, card: { enabled: true, label: 'Tarjeta' }, transfer: { enabled: false }, digital_wallet: { enabled: false } } }, paymentControls: { cash: true, card: false } } as unknown as typeof state.settings
  state.offers = [{ id: 'p', sale_price: 100, offer_price: 80, has_offer: true }]
})
it('transporta los módulos del servidor al encabezado especializado', () => {
  render(<StorefrontHeader initialSettings={state.settings} catalogEnabled={false} servicesModuleEnabled={false} repairsModuleEnabled={false} />)
  const props = JSON.parse(screen.getByTestId('header-flags').textContent!)
  expect(props).toMatchObject({ catalogEnabled: false, repairsModuleEnabled: false, servicesModuleEnabled: false })
})
it('sin Inventario la barra móvil no ofrece catálogo, ofertas ni carrito', () => {
  render(<StorefrontMobileNav initialSettings={state.settings} catalogEnabled={false} />)
  expect(screen.queryByText('Productos')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Ver ofertas de la tienda' })).toBeNull()
  expect(screen.queryByText('Carrito')).toBeNull()
  expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
})
it('el modo WhatsApp no ofrece carrito y las ofertas ocultas se retiran al actualizar', () => {
  const view = render(<StorefrontMobileNav initialSettings={state.settings} />)
  expect(screen.queryByText('Carrito')).toBeNull()
  expect(screen.getByRole('link', { name: 'Ver ofertas de la tienda' })).toBeInTheDocument()
  state.settings = { ...state.settings!, offers_section: { ...state.settings!.offers_section!, enabled: false } }
  view.rerender(<StorefrontMobileNav initialSettings={state.settings} />)
  expect(screen.queryByRole('link', { name: 'Ver ofertas de la tienda' })).toBeNull()
})
it('el pie muestra solo métodos configurados y autorizados', () => {
  render(<PublicFooter initialSettings={state.settings} />)
  const footer = within(screen.getByRole('contentinfo'))
  expect(footer.getByText('Efectivo', { exact: true })).toBeInTheDocument()
  expect(footer.queryByText('Tarjeta', { exact: true })).toBeNull()
  expect(footer.queryByText(/SIPAP|Pagos QR|Cuotas/)).toBeNull()
})
it('no anuncia pagos mientras sus controles no están disponibles', () => {
  state.settings = { ...state.settings!, paymentControls: undefined }
  render(<PublicFooter initialSettings={state.settings} />)
  expect(screen.queryByText('Medios de pago informados:')).toBeNull()
})
it('un servicio sin teléfono no ofrece el WhatsApp de la plataforma', () => {
  render(<ServicesGrid services={[{ id: 's', title: 'Asesoramiento', active: true, description: 'Atención del negocio.' } as Service]} fallbackContactHref="/tienda/servicios" descriptionFallback="Consultá condiciones y disponibilidad." />)
  expect(screen.getByRole('link', { name: 'Consultar', exact: true })).toHaveAttribute('href', '/tienda/servicios')
  expect(screen.queryByRole('link', { name: 'Consultar por WhatsApp' })).toBeNull()
  expect(screen.queryByText(/Calidad garantizada/)).toBeNull()
})
