/**
 * Al activar cuotas en un producto, el modal debe ofrecer usar los datos
 * predeterminados o cargar unos nuevos desde cero.
 *
 * Renderiza el ProductModal real: es la única forma de verificar que la
 * elección aparece donde el usuario la va a buscar y que aplicar los
 * predeterminados realmente carga los planes en el formulario.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

let websiteSettings: WebsiteSettings | null = null

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: websiteSettings,
    isLoading: false,
    error: null,
    isSaving: false,
    updateSetting: vi.fn(),
    refetch: vi.fn(),
  }),
  useWebsiteSettings: () => ({ settings: websiteSettings, isLoading: false, error: null }),
}))

vi.mock('@/hooks/use-can-view-cost', () => ({ useCanViewCost: () => true }))
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [], loading: false, refetch: vi.fn(), createCategory: vi.fn() }),
}))
vi.mock('@/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ suppliers: [], loading: false, refetch: vi.fn(), createSupplier: vi.fn() }),
}))
vi.mock('@/hooks/useBrands', () => ({
  useBrands: () => ({ brands: [], loading: false, refetch: vi.fn(), createBrand: vi.fn() }),
}))
vi.mock('@/hooks/use-shared-settings', () => ({
  useSharedSettings: () => ({ settings: { currency: 'PYG', taxRate: 10 }, loading: false }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { ProductModal } from '@/components/dashboard/product-modal'

const CHOICE_HEADING = /¿Cómo querés configurar las cuotas\?/i
const USE_DEFAULTS = /Usar datos predeterminados/i
const START_BLANK = /Cargar nuevos desde cero/i

function renderModal() {
  return render(
    <ProductModal
      product={null}
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      categories={[]}
      brands={[]}
      suppliers={[]}
    />
  )
}

/** Abre la pestaña donde viven los precios y las cuotas.
 *  Radix Tabs no reacciona a fireEvent.click en jsdom: necesita los eventos de
 *  puntero completos que emite userEvent. */
async function openPricingTab() {
  const tab = screen.getByRole('tab', { name: /precio/i })
  await userEvent.click(tab)
  await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'))
}

async function enableInstallments() {
  const toggle = await screen.findByLabelText('Activar cuotas / financiación')
  fireEvent.click(toggle)
}

describe('ProductModal — elección de datos de cuotas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    websiteSettings = getWebsiteSettingsDefaults()
  })

  it('no muestra nada de cuotas mientras la financiación está apagada', async () => {
    renderModal()
    await openPricingTab()

    expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument()
    expect(screen.getByText(/Activá la financiación para configurar/i)).toBeInTheDocument()
  })

  it('al activar cuotas ofrece las dos alternativas', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()

    expect(await screen.findByText(CHOICE_HEADING)).toBeInTheDocument()
    expect(screen.getByText(USE_DEFAULTS)).toBeInTheDocument()
    expect(screen.getByText(START_BLANK)).toBeInTheDocument()
  })

  it('informa qué base de cálculo se va a usar', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()

    expect(await screen.findByText(/Base configurada: Precio de venta/i)).toBeInTheDocument()
  })

  it('refleja la base de costo cuando así está configurada', async () => {
    const settings = getWebsiteSettingsDefaults()
    settings.product_credit_defaults!.calculationBase = 'cost'
    websiteSettings = settings

    renderModal()
    await openPricingTab()
    await enableInstallments()

    expect(await screen.findByText(/Base configurada: Precio de costo/i)).toBeInTheDocument()
  })

  it('"cargar nuevos desde cero" lleva al armado manual', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()

    fireEvent.click(await screen.findByText(START_BLANK))

    await waitFor(() => expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument())
    // Aparece el armado manual de planes.
    expect(screen.getByText(/Agregar plan rápido/i)).toBeInTheDocument()
  })

  it('"usar predeterminados" carga los planes configurados', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()

    fireEvent.click(await screen.findByText(USE_DEFAULTS))

    await waitFor(() => expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument())

    // Los defaults traen 3, 6 y 12 cuotas: los chips quedan marcados como ya usados.
    await waitFor(() => {
      expect(screen.getByText('✓ 3c')).toBeInTheDocument()
      expect(screen.getByText('✓ 6c')).toBeInTheDocument()
      expect(screen.getByText('✓ 12c')).toBeInTheDocument()
    })
  })

  it('sin predeterminados activos va directo al armado manual', async () => {
    const settings = getWebsiteSettingsDefaults()
    settings.product_credit_defaults!.enabled = false
    websiteSettings = settings

    renderModal()
    await openPricingTab()
    await enableInstallments()

    await waitFor(() => expect(screen.getByText(/Agregar plan rápido/i)).toBeInTheDocument())
    expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument()
  })
})
