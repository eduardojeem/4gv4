/**
 * El selector de categoría del formulario de producto debe mostrar la
 * jerarquía, no una lista plana.
 *
 * Renderiza el ProductModal real y abre el desplegable, que es donde el
 * usuario ve el problema: antes una subcategoría se veía igual que una raíz.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** Abre el desplegable de categorías y devuelve sus opciones. */
async function openCategorySelect() {
  const trigger = screen.getByRole('combobox', { name: /categoría/i })
  await userEvent.click(trigger)
  const listbox = await screen.findByRole('listbox')
  return within(listbox).getAllByRole('option')
}

describe('ProductModal — selector de categorías', () => {
  // Radix Select usa APIs de puntero y scroll que jsdom no implementa; sin
  // estos stubs el desplegable nunca llega a abrirse.
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista las subcategorías debajo de su categoría padre', async () => {
    renderModal()
    const options = await openCategorySelect()
    const labels = options.map((option) => option.textContent ?? '')

    // Celulares primero (alfabético entre raíces), con sus hijas ordenadas.
    expect(labels[0]).toContain('Celulares')
    expect(labels[1]).toContain('Cargadores')
    expect(labels[2]).toContain('Fundas')
    expect(labels[3]).toContain('Notebooks')
  })

  it('indenta las subcategorías para distinguirlas de las raíces', async () => {
    renderModal()
    const options = await openCategorySelect()

    const celulares = options.find((o) => o.textContent?.trim().startsWith('Celulares'))
    const cargadores = options.find((o) => o.textContent?.includes('Cargadores'))

    expect(celulares?.textContent).not.toContain('└─')
    expect(cargadores?.textContent).toContain('└─')
  })

  it('aclara el padre de dos subcategorías con el mismo nombre', async () => {
    renderModal()
    const options = await openCategorySelect()
    const fundas = options.filter((o) => o.textContent?.includes('Fundas'))

    // Hay dos "Fundas": sin el padre serían indistinguibles.
    expect(fundas).toHaveLength(2)
    expect(fundas.some((o) => o.textContent?.includes('en Celulares'))).toBe(true)
    expect(fundas.some((o) => o.textContent?.includes('en Notebooks'))).toBe(true)
  })

  it('no muestra el padre en las categorías raíz', async () => {
    renderModal()
    const options = await openCategorySelect()
    const notebooks = options.find((o) => o.textContent?.trim().startsWith('Notebooks'))

    expect(notebooks?.textContent).not.toContain('en ')
  })

  it('muestra todas las categorías, ninguna se pierde', async () => {
    renderModal()
    const options = await openCategorySelect()

    expect(options).toHaveLength(categories.length)
  })
})
