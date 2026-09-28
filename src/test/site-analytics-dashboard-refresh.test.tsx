import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SiteAnalyticsDashboard } from '@/components/site-analytics/SiteAnalyticsDashboard'

const emptySummary = {
  range: { days: 7, from: '2026-09-01', to: '2026-09-07', timezone: 'America/Asuncion' },
  totals: { page_views: 0, visitors: 0, sessions: 0, bounce_rate: 0, pages_per_session: 0 },
  previous: { page_views: 0, visitors: 0, orders: 0, revenue: 0 },
  active_now: 0,
  sales: { orders: 0, revenue: 0, average_order_value: 0, conversion_rate: 0 },
  daily: [],
  top_pages: [],
  top_products: [],
  sources: [],
  devices: [],
  countries: [],
  searches: { total: 0, without_results: 0, top_terms: [], without_results_terms: [] },
  interactions: { whatsapp_click: 0, phone_click: 0, add_to_cart: 0, order_placed: 0 },
  funnel: { sessions: 0, viewed_product: 0, added_to_cart: 0, contacted_or_ordered: 0 },
  by_site: [],
  top_organizations: [],
}

// get_site_analytics_summary reprocesa todos los eventos crudos de la ventana
// pedida: sin este apagado por defecto, dejar el dashboard abierto le pegaria
// a Supabase cada tanto sin que nadie lo este mirando.
describe('SiteAnalyticsDashboard: actualizacion manual por defecto', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { summary: emptySummary } }) })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('no vuelve a pedir datos solo por dejar pasar el tiempo', async () => {
    render(<SiteAnalyticsDashboard endpoint="/api/superadmin/analytics/website" variant="platform" />)
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(fetch).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('activar "Automático" hace que vuelva a pedir datos solo, y "Manual" lo apaga', async () => {
    render(<SiteAnalyticsDashboard endpoint="/api/superadmin/analytics/website" variant="platform" />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(fetch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Automático' }))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(fetch).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(fetch).toHaveBeenCalledTimes(3)

    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
