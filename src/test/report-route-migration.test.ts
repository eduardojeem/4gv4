import { beforeEach, describe, expect, it, vi } from 'vitest'

const { permanentRedirect } = vi.hoisted(() => ({
  permanentRedirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({ permanentRedirect }))

describe('compatibilidad de las rutas históricas de reportes', () => {
  beforeEach(() => permanentRedirect.mockClear())

  it('redirige /dashboard/reports al reporte canónico del admin', async () => {
    const { default: LegacyReportsPage } = await import('@/app/dashboard/reports/page')

    LegacyReportsPage()
    expect(permanentRedirect).toHaveBeenCalledWith('/admin/reports')
  })

  it('redirige /dashboard/reports/products al reporte de productos del admin', async () => {
    const { default: LegacyProductsReportPage } = await import('@/app/dashboard/reports/products/page')

    LegacyProductsReportPage()
    expect(permanentRedirect).toHaveBeenCalledWith('/admin/reports/products')
  })
})
