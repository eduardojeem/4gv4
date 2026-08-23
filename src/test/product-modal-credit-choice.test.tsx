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

function renderModal(product: Parameters<typeof ProductModal>[0]['product'] = null) {
  return render(
    <ProductModal
      product={product}
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      categories={[]}
      brands={[]}
      suppliers={[]}
    />
  )
}

/** Producto ya existente con planes propios cargados. */
const productWithPlans = {
  id: 'prod-1',
  name: 'Producto con planes',
  sku: 'SKU-1',
  sale_price: 500_000,
  purchase_price: 300_000,
  stock_quantity: 5,
  installments_enabled: true,
  installments_public: true,
  installments_plans: [{ count: 4, rate: 5 }],
} as unknown as Parameters<typeof ProductModal>[0]['product']

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

  it('un producto que ya tiene planes propios no vuelve a preguntar', async () => {
    renderModal(productWithPlans)
    await openPricingTab()

    // Ya viene con cuotas activas y un plan cargado: se edita, no se elige.
    expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Agregar plan rápido/i)).toBeInTheDocument())
  })

  it('vuelve a preguntar en el siguiente producto nuevo', async () => {
    const { rerender } = renderModal()
    await openPricingTab()
    await enableInstallments()

    // Primer producto: se elige armar a mano.
    fireEvent.click(await screen.findByText(START_BLANK))
    await waitFor(() => expect(screen.queryByText(CHOICE_HEADING)).not.toBeInTheDocument())

    // Se abre el modal para otro producto sin desmontarlo.
    rerender(
      <ProductModal
        product={productWithPlans}
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        categories={[]}
        brands={[]}
        suppliers={[]}
      />
    )
    rerender(
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

    await openPricingTab()
    await enableInstallments()

    // La eleccion tiene que estar disponible otra vez.
    expect(await screen.findByText(CHOICE_HEADING)).toBeInTheDocument()
  })

  it('explica cómo funcionan las cuotas antes de activarlas', async () => {
    renderModal()
    await openPricingTab()

    const guide = await screen.findByText(/¿Cómo funcionan las cuotas\?/i)
    expect(guide).toBeInTheDocument()

    // El detalle arranca cerrado; al abrirlo aparecen los pasos.
    await userEvent.click(guide)
    expect(screen.getByText(/El recargo es un porcentaje que se suma/i)).toBeInTheDocument()
    expect(screen.getByText(/quedan guardados y vuelven al reactivarla/i)).toBeInTheDocument()
  })

  it('la explicación dice sobre qué precio se calcula', async () => {
    const settings = getWebsiteSettingsDefaults()
    settings.product_credit_defaults!.calculationBase = 'cost'
    websiteSettings = settings

    renderModal()
    await openPricingTab()
    await userEvent.click(await screen.findByText(/¿Cómo funcionan las cuotas\?/i))

    expect(screen.getByText(/La cuota se calcula sobre precio de costo/i)).toBeInTheDocument()
  })

  it('ofrece un link a la configuración que no pierde el formulario', async () => {
    renderModal()
    await openPricingTab()
    await userEvent.click(await screen.findByText(/¿Cómo funcionan las cuotas\?/i))

    const link = screen.getAllByRole('link', { name: /Configurar predeterminados/i })[0]
    expect(link).toHaveAttribute('href', '/dashboard/products/credit-defaults')
    // Pestaña nueva: el modal tiene datos sin guardar.
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('el link también está en el panel de elección', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()

    await screen.findByText(CHOICE_HEADING)
    expect(screen.getByRole('link', { name: /Configurar predeterminados/i }))
      .toHaveAttribute('href', '/dashboard/products/credit-defaults')
  })

  it('la explicación sigue disponible mientras se arman planes a mano', async () => {
    renderModal()
    await openPricingTab()
    await enableInstallments()
    fireEvent.click(await screen.findByText(START_BLANK))

    await waitFor(() => expect(screen.getByText(/Agregar plan rápido/i)).toBeInTheDocument())
    expect(screen.getByText(/¿Cómo funcionan las cuotas\?/i)).toBeInTheDocument()
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
