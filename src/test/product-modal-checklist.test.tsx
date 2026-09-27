/**
 * Panel de progreso al crear un producto nuevo.
 *
 * Los 4 campos obligatorios viven en dos pestañas distintas y antes solo te
 * enterabas de que faltaba alguno al ser rebotado en el guardado.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: getWebsiteSettingsDefaults(),
    isLoading: false,
    error: null,
    isSaving: false,
    updateSetting: vi.fn(),
    refetch: vi.fn(),
  }),
  useWebsiteSettings: () => ({ settings: getWebsiteSettingsDefaults(), isLoading: false, error: null }),
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

const categories = [
  { id: 'notebooks', name: 'Notebooks', parent_id: null },
  { id: 'celulares', name: 'Celulares', parent_id: null },
  { id: 'cel-fundas', name: 'Fundas', parent_id: 'celulares' },
  { id: 'cel-cargadores', name: 'Cargadores', parent_id: 'celulares' },
  { id: 'note-fundas', name: 'Fundas', parent_id: 'notebooks' },
] as unknown as Parameters<typeof ProductModal>[0]['categories']

function renderModal() {
  return render(
    <ProductModal
      product={null}
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      categories={categories}
      brands={[]}
      suppliers={[]}
    />
  )
}



describe('ProductModal — progreso de campos obligatorios', () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aparece al crear un producto', () => {
    renderModal()

    expect(screen.getByTestId('new-product-checklist')).toBeInTheDocument()
    expect(screen.getByText('Para poder guardar')).toBeInTheDocument()
  })

  it('arranca sin nada completo y lista los 4 obligatorios', () => {
    renderModal()
    const panel = screen.getByTestId('new-product-checklist')

    expect(panel).toHaveTextContent('0/4')
    expect(panel).toHaveTextContent('Nombre del producto')
    expect(panel).toHaveTextContent('SKU / Codigo')
    expect(panel).toHaveTextContent('Categoria')
    expect(panel).toHaveTextContent('Precio de venta')
  })

  it('avisa en que pestaña esta cada faltante', () => {
    renderModal()
    const panel = screen.getByTestId('new-product-checklist')

    // El precio esta en otra pestaña: es el que el usuario no encontraba.
    expect(panel).toHaveTextContent('Precios')
    expect(panel).toHaveTextContent('Básica')
  })

  it('avanza en vivo al completar un campo', async () => {
    renderModal()

    fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
      target: { value: 'Cargador rapido' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('new-product-checklist')).toHaveTextContent('1/4')
    })
  })

  it('lleva a la pestaña del campo que falta al hacer clic', async () => {
    renderModal()

    const panel = screen.getByTestId('new-product-checklist')
    const priceRow = within(panel).getByText('Precio de venta').closest('button')
    fireEvent.click(priceRow!)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /precio/i })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('no aparece al editar un producto existente', () => {
    render(
      <ProductModal
        product={{ id: 'p1', name: 'Ya existe', sku: 'SKU-1', sale_price: 1000, stock_quantity: 1 } as never}
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        categories={categories}
        brands={[]}
        suppliers={[]}
      />
    )

    expect(screen.queryByTestId('new-product-checklist')).not.toBeInTheDocument()
  })
})
