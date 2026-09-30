import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalProductsManager } from '../GlobalProductsManager'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const payload = {
  success: true,
  data: [
    { id: 'p1', gtin: '7505694352426', name: 'AmpSentrix 20W', brand_name: 'AmpSentrix', global_brand_id: 'amp', global_category_id: null, description: null, image_url: null, is_active: true, stores: 1 },
    { id: 'p2', gtin: '7504451958178', name: 'AmpSentrix Cable', brand_name: null, global_brand_id: 'amp', global_category_id: 'car', description: null, image_url: null, is_active: true, stores: 0 },
  ],
  candidates: [],
  candidatesTotal: 0,
  productsWithBarcode: 2,
  brands: [{ id: 'amp', name: 'AmpSentrix' }],
  categories: [{ id: 'acc', name: 'Accesorios', parent_id: null }, { id: 'car', name: 'Cargadores', parent_id: 'acc' }],
}

function servidor() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({ success: true, updated: 1 }))
    return new Response(JSON.stringify(payload))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { vi.unstubAllGlobals() })

describe('catálogo global de productos', () => {
  it('agrupa por categoría con lo sin clasificar primero y la madre a la vista', async () => {
    servidor()
    render(<GlobalProductsManager />)
    await screen.findByText('AmpSentrix 20W')
    const headings = screen.getAllByRole('button', { expanded: true }).map((button) => button.textContent)
    expect(headings[0]).toContain('Sin categoría')
    expect(headings[1]).toContain('Accesorios › Cargadores')
  })

  it('asigna una categoría a los elegidos de una vez', async () => {
    const fetchMock = servidor()
    render(<GlobalProductsManager />)
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Elegir AmpSentrix 20W' }))

    fireEvent.change(screen.getByRole('combobox', { name: 'Categoría a asignar' }), { target: { value: 'car' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/superadmin/global-products', expect.objectContaining({ method: 'POST' })))
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ action: 'bulk-update', ids: ['p1'], global_category_id: 'car' })
  })

  it('por marca agrupa por la marca del catálogo', async () => {
    servidor()
    render(<GlobalProductsManager />)
    await screen.findByText('AmpSentrix 20W')
    fireEvent.click(screen.getByRole('button', { name: 'Por marca' }))
    const [group] = screen.getAllByRole('button', { expanded: true })
    expect(group).toHaveTextContent('AmpSentrix')
    expect(within(group).getByText('2')).toBeInTheDocument()
  })
})
