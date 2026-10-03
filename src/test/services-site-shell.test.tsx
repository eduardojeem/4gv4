import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/don-pepe/inicio',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: state.settings }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/components/public/cart/PublicCartButton', () => ({ PublicCartButton: () => <button type="button">Carrito</button> }))
// La tienda de productos no se prueba acá: alcanza con saber cuál se eligió.
vi.mock('@/components/public/PublicHeader', () => ({ PublicHeader: () => <header>Encabezado de tienda</header> }))
vi.mock('@/components/public/StoreMobileBottomNav', () => ({ StoreMobileBottomNav: () => <nav>Barra de tienda</nav> }))

import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { StorefrontHeader, StorefrontMobileNav } from '@/components/public/StorefrontShell'
import type { StorefrontStyle } from '@/lib/website/storefront-style'

const agenda = {
  currency: 'PYG',
  services: [{ id: 's1', name: 'Corte', duration: 30, price: 50000, professionalIds: [] }],
  professionals: [],
}

function pintar(ui: ReactNode, style: StorefrontStyle) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StorefrontStyleProvider style={style}>{ui}</StorefrontStyleProvider>
    </SWRConfig>
  )
}

beforeEach(() => {
  state.settings = {
    company_info: { name: 'Barbería Don Pepe', slug: 'don-pepe', whatsapp: '595981123456', address: 'Av. España 1234', hours: { weekdays: 'Lun a Sáb 9 a 20' } },
    booking_section: { enabled: true, title: 'Reservá', subtitle: '', showTeam: true },
  }
})
afterEach(() => vi.unstubAllGlobals())

describe('la plantilla Servicios es un sitio de servicios, no una tienda', () => {
  it('las demás plantillas siguen con el encabezado y la barra de la tienda', () => {
    pintar(<><StorefrontHeader /><StorefrontMobileNav /></>, 'fashion')
    expect(screen.getByText('Encabezado de tienda')).toBeInTheDocument()
    expect(screen.getByText('Barra de tienda')).toBeInTheDocument()
  })

  it('encabezado con secciones del negocio y «Reservar turno», sin buscador ni marketplace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => agenda }))
    pintar(<StorefrontHeader catalogEnabled={false} />, 'services')

    const nav = screen.getByRole('navigation', { name: 'Secciones del sitio' })
    expect(within(nav).getByRole('link', { name: 'Servicios' })).toHaveAttribute('href', '/don-pepe/inicio#servicios')
    expect(within(nav).queryByRole('link', { name: 'Tienda' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Reservar turno/ })).toHaveAttribute('href', '/don-pepe/inicio#reservar')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.queryByText(/Marketplace/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carrito' })).not.toBeInTheDocument()
  })

  it('si vende productos, suma «Tienda» y el carrito', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    pintar(<StorefrontHeader catalogEnabled />, 'services')
    expect(screen.getByRole('link', { name: 'Tienda' })).toHaveAttribute('href', '/don-pepe/productos')
    expect(screen.getByRole('button', { name: 'Carrito' })).toBeInTheDocument()
  })

  it('sin reservas online, el botón pide el turno por WhatsApp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    pintar(<StorefrontHeader catalogEnabled={false} />, 'services')
    expect(await screen.findByRole('link', { name: /Pedir turno/ })).toHaveAttribute('href', 'https://wa.me/595981123456')
    expect(screen.queryByRole('link', { name: 'Turnos' })).not.toBeInTheDocument()
  })

  it('en el celular: Reservar al centro, cómo llegar y WhatsApp; nada de carrito ni ofertas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => agenda }))
    pintar(<StorefrontMobileNav />, 'services')
    const nav = screen.getByRole('navigation', { name: 'Accesos rápidos' })
    expect(await within(nav).findByRole('link', { name: /Reservar/ })).toHaveAttribute('href', '/don-pepe/inicio#reservar')
    expect(within(nav).getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
    expect(within(nav).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/595981123456')
    expect(within(nav).queryByText(/Carrito|Ofertas/)).not.toBeInTheDocument()
  })
})
