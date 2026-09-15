import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketplaceProductModal } from '@/components/public/MarketplaceProductModal'
import { pickOrganizationContact, type MarketplaceProduct } from '@/lib/public/marketplace'

vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('next/navigation', () => ({ usePathname: () => '/marketplace/productos' }))

const base = {
  id: 'p1',
  name: 'Perfume 9 PM',
  sale_price: 283000,
  offer_price: 243000,
  has_offer: true,
  in_stock: true,
  stock_quantity: 10,
  images: [],
  organization_id: 'org-1',
  organization_slug: 'store-center',
  organization_name: 'Store Center',
  organization_city: 'Asunción',
} as unknown as MarketplaceProduct

describe('detalle de producto del marketplace: contacto de la tienda', () => {
  it('muestra las redes de la tienda y la consulta por WhatsApp sobre ese producto', () => {
    render(
      <MarketplaceProductModal
        open
        onClose={vi.fn()}
        product={{
          ...base,
          organization_contact: {
            instagram: 'https://instagram.com/storecenter',
            facebook: 'StoreCenterPY',
            tiktok: '@storecenter',
            whatsapp: '0981 123 456',
          },
        }}
      />
    )

    const seller = within(screen.getByRole('region', { name: 'Vendido por Store Center' }))
    expect(seller.getByRole('link', { name: 'Instagram de Store Center: @storecenter' })).toHaveAttribute('href', 'https://instagram.com/storecenter')
    expect(seller.getByRole('link', { name: 'Facebook de Store Center: StoreCenterPY' })).toHaveAttribute('href', 'https://facebook.com/StoreCenterPY')
    expect(seller.getByRole('link', { name: /TikTok de Store Center/ })).toHaveAttribute('href', 'https://tiktok.com/@storecenter')

    const whatsapp = seller.getByRole('link', { name: /Consultar por WhatsApp/ })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/)
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain('«Perfume 9 PM»')
  })

  it('sin redes ni WhatsApp no deja un bloque vacío', () => {
    render(<MarketplaceProductModal open onClose={vi.fn()} product={base} />)

    const seller = within(screen.getByRole('region', { name: 'Vendido por Store Center' }))
    expect(seller.queryByText('Seguila en')).not.toBeInTheDocument()
    expect(seller.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })

  it('muestra cuánto se ahorra con la oferta', () => {
    render(<MarketplaceProductModal open onClose={vi.fn()} product={base} />)
    expect(screen.getByText(/Ahorrás/)).toHaveTextContent('40.000')
  })

  it('toma de «Sitio Web» solo los datos cargados', () => {
    expect(pickOrganizationContact({ instagram: ' tienda ', facebook: '', whatsapp: 123 })).toEqual({
      instagram: 'tienda', facebook: null, tiktok: null, whatsapp: null,
    })
    expect(pickOrganizationContact({ address: 'Centro' })).toBeNull()
    expect(pickOrganizationContact(null)).toBeNull()
  })
})
