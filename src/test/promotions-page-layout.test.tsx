/**
 * Organización de /dashboard/promotions.
 *
 * La pagina mezclaba dos trabajos distintos en una sola columna: los descuentos
 * (lo de todos los dias) y la configuracion de como se ve /ofertas. Los tres
 * editores de la tienda publica quedaban arriba de todo, asi que la lista de
 * promociones —el motivo de entrar a la seccion— caia muy abajo.
 *
 * Estos tests fijan el reparto: cada bloque en su pestaña, y la lista visible
 * de entrada sin tener que hacer scroll ni clics.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import PromotionsPage from '@/app/dashboard/promotions/page'

const permissions = { all: true }

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => permissions.all }),
}))

vi.mock('@/hooks/use-promotions', () => ({
  usePromotions: () => ({
    promotions: [],
    loading: false,
    stats: { total: 3, active: 2, expired: 1, totalUsage: 0 },
    filters: {},
    createPromotion: vi.fn(),
    updatePromotion: vi.fn(),
    deletePromotion: vi.fn(),
    togglePromotionStatus: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    bulkDeletePromotions: vi.fn(),
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    getPromotionStatus: vi.fn(),
    isPromotionExpiringSoon: vi.fn(),
    getTopPerformingPromotions: () => [],
    getUnusedPromotions: () => [],
    exportPromotions: vi.fn(),
    cleanupExpiredPromotions: vi.fn(),
    validatePromotionCode: vi.fn(),
    getUsagePerDay: vi.fn(),
    getQuotaPercent: vi.fn(),
    expiringSoonArray: [],
    expiredActiveArray: [],
  }),
}))

vi.mock('@/components/auth/permission-guard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/PlanGate', () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Los bloques se reemplazan por marcadores: lo que se prueba es donde queda
// cada uno, no lo que dibuja cada componente por dentro.
vi.mock('@/components/dashboard/promotions', () => ({
  PromotionStats: () => <div>BLOQUE Estadísticas</div>,
  PromotionFilters: () => <div>BLOQUE Filtros</div>,
  PromotionList: () => <div>BLOQUE Lista de promociones</div>,
  PromotionAlerts: () => <div>BLOQUE Alertas</div>,
  PromotionAnalytics: () => <div>BLOQUE Analítica</div>,
  OffersCarouselSettingsCard: () => <div>BLOQUE Carrusel automático</div>,
}))

vi.mock('@/components/admin/website/OffersSectionEditor', () => ({
  OffersSectionEditor: () => <div>BLOQUE Editor de sección pública</div>,
}))

vi.mock('@/components/admin/website/PromotionalCarouselEditor', () => ({
  PromotionalCarouselEditor: () => <div>BLOQUE Editor de campañas</div>,
}))

vi.mock('@/components/dashboard/promotions/PromotionDialog', () => ({
  PromotionDialog: () => null,
}))

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

beforeEach(() => {
  permissions.all = true
})

/** next/dynamic resuelve el modulo en una microtarea. */
async function renderPage() {
  const view = render(<PromotionsPage />)
  await screen.findByText('BLOQUE Lista de promociones')
  return view
}

describe('/dashboard/promotions — reparto en pestañas', () => {
  it('abre en la lista de promociones, sin editores de la tienda delante', async () => {
    await renderPage()

    expect(screen.getByText('BLOQUE Lista de promociones')).toBeInTheDocument()
    expect(screen.getByText('BLOQUE Estadísticas')).toBeInTheDocument()
    // Los tres editores de /ofertas ya no empujan la lista hacia abajo.
    expect(screen.queryByText('BLOQUE Editor de sección pública')).toBeNull()
    expect(screen.queryByText('BLOQUE Editor de campañas')).toBeNull()
    expect(screen.queryByText('BLOQUE Carrusel automático')).toBeNull()
  })

  it('agrupa los tres controles de la tienda en la segunda pestaña', async () => {
    await renderPage()

    await userEvent.click(screen.getByRole('tab', { name: /Página pública/ }))

    expect(await screen.findByText('BLOQUE Editor de sección pública')).toBeInTheDocument()
    expect(screen.getByText('BLOQUE Carrusel automático')).toBeInTheDocument()
    // Cada editor entra por su propio dynamic import: se resuelven por separado.
    expect(await screen.findByText('BLOQUE Editor de campañas')).toBeInTheDocument()
  })

  it('distingue por nombre los dos carruseles, que antes se confundían', async () => {
    await renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /Página pública/ }))

    expect(screen.getByText(/Carrusel automático de productos rebajados/)).toBeInTheDocument()
    expect(screen.getByText('Carrusel de campañas')).toBeInTheDocument()
  })

  it('deja las alertas fuera de las pestañas, para que no se pierdan', async () => {
    await renderPage()

    expect(screen.getByText('BLOQUE Alertas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Página pública/ }))
    expect(screen.getByText('BLOQUE Alertas')).toBeInTheDocument()
  })

  it('mantiene a mano las dos acciones principales y esconde las ocasionales', async () => {
    await renderPage()

    expect(screen.getByRole('button', { name: /Nueva promoción/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cómo funciona/ })).toBeInTheDocument()
    // Exportar dejo de ocupar dos botones del encabezado.
    expect(screen.queryByRole('button', { name: /^CSV$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^JSON$/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(await screen.findByText(/Descargar CSV/)).toBeInTheDocument()
  })

  it('sin permiso de edición explica por qué la pestaña pública está vacía', async () => {
    permissions.all = false
    await renderPage()

    await userEvent.click(screen.getByRole('tab', { name: /Página pública/ }))

    expect(await screen.findByText(/No tenés permiso para editar la página pública/)).toBeInTheDocument()
    expect(screen.queryByText('BLOQUE Editor de sección pública')).toBeNull()
  })
})
