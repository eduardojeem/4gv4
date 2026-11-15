import { render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServicePromotionsSection } from '@/components/public/offers/ServicePromotionsSection'
import { ServicePromotionNote } from '@/components/public/agenda/ServicePromotionNote'
import type { ServicePromotion } from '@/lib/public/service-promotions'

const promo: ServicePromotion = { id: 'p1', name: 'Combo del mes', description: 'Corte + barba con toalla caliente', code: 'COMBO20', type: 'percentage', value: 20, maxDiscount: null, minPurchase: null, endsAt: null }

afterEach(() => vi.unstubAllGlobals())

function renderSection(response: { ok: boolean; body?: unknown }, slug: string | null = 'juanbarber') {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: response.ok, json: async () => response.body })))
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ServicePromotionsSection tenantSlug={slug} tenantPrefix={slug ? `/${slug}` : ''} />
    </SWRConfig>,
  )
}

describe('Ofertas: promos en servicios', () => {
  it('muestra el servicio con su promo y reserva ese servicio en /turnos', async () => {
    renderSection({ ok: true, body: { currency: 'PYG', services: [
      { id: 'svc-1', name: 'Combo Club: Corte + Barba', duration: 60, price: 80000, promotions: [promo] },
      { id: 'svc-2', name: 'Corte de cabello', duration: 45, price: 45000, promotions: [] },
    ] } })
    expect(await screen.findByRole('heading', { name: 'Promos en servicios' })).toBeInTheDocument()
    expect(screen.getByText('Combo Club: Corte + Barba')).toBeInTheDocument()
    expect(screen.queryByText('Corte de cabello')).not.toBeInTheDocument()
    expect(screen.getByText(/COMBO20/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reservar con este descuento/ })).toHaveAttribute('href', '/juanbarber/turnos?servicio=svc-1')
  })

  it('sin agenda online o sin promos de servicios no aparece', async () => {
    const { container } = renderSection({ ok: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Turnos: aviso de la promo del servicio', () => {
  it('aclara que el descuento se aplica al pagar en el local y estima el precio', () => {
    render(<ServicePromotionNote promotion={promo} price={80000} currency="PYG" />)
    const note = screen.getByRole('note', { name: 'Promoción de este servicio' })
    expect(note).toHaveTextContent('Combo del mes · 20% OFF')
    expect(note).toHaveTextContent(/al pagar: el descuento se aplica en el local/)
    expect(note).toHaveTextContent('COMBO20')
  })
})
