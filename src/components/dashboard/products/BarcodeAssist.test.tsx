import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BarcodeAssist, type GlobalProductMatch } from './BarcodeAssist'

const nescafe: GlobalProductMatch = {
  id: 'g1', gtin: '7891000315507', name: 'Nescafé Tradición 170 g', description: 'Café instantáneo', imageUrl: null,
  brandName: 'Nescafé', categoryName: 'Almacén', tenantBrandId: 'b1', tenantCategoryId: null,
}

function lookup(data: { own: unknown; global: unknown }) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { code: '', kind: '', ...data } })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { vi.unstubAllGlobals() })

describe('asistente del código de barras', () => {
  it('ignora respuestas anteriores y limpia Buscando al cambiar a un código inválido', async () => {
    let finish!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<BarcodeAssist code="7891000315507" onApply={vi.fn()} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Buscando')).toBeInTheDocument()
    rerender(<BarcodeAssist code="bad" onApply={vi.fn()} />)
    expect(screen.queryByLabelText('Buscando')).not.toBeInTheDocument()
    await act(async () => { finish(new Response(JSON.stringify({ success: true, data: { own: null, global: nescafe } }))) })
    expect(screen.queryByRole('button', { name: 'Completar datos' })).not.toBeInTheDocument()
  })
  it('avisa cuando la consulta falla y permite reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    render(<BarcodeAssist code="7891000315507" onApply={vi.fn()} />)
    expect(await screen.findByRole('status')).toHaveTextContent('No se verificaron duplicados')
    expect(screen.getByRole('button', { name: 'Reintentar búsqueda' })).toBeInTheDocument()
  })
  it('avisa si la tienda ya tiene ese código', async () => {
    lookup({ own: { id: 'p1', name: 'Café 170', variant: null }, global: null })
    render(<BarcodeAssist code="7891000315507" onApply={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tenés este código en Café 170')
  })

  it('ofrece completar con el catálogo global', async () => {
    lookup({ own: null, global: nescafe })
    const onApply = vi.fn()
    render(<BarcodeAssist code="7891000315507" onApply={onApply} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Completar datos' }))
    expect(onApply).toHaveBeenCalledWith(nescafe)
    expect(screen.getByRole('button', { name: 'Completado' })).toBeInTheDocument()
  })

  it('dice de qué base abierta vienen los datos', async () => {
    lookup({
      own: null,
      global: {
        ...nescafe, id: 'openfoodfacts:7891000315507', tenantBrandId: null, categoryName: null,
        source: 'openfoodfacts', sourceUrl: 'https://world.openfoodfacts.org/product/7891000315507',
      },
    })
    render(<BarcodeAssist code="7891000315507" onApply={vi.fn()} />)
    const link = await screen.findByRole('link', { name: 'Open Food Facts' })
    expect(link).toHaveAttribute('href', 'https://world.openfoodfacts.org/product/7891000315507')
    expect(screen.getByText(/revisalos antes de guardar/)).toBeInTheDocument()
  })

  it('un código inválido no consulta al servidor', () => {
    const fetchMock = lookup({ own: null, global: null })
    render(<BarcodeAssist code="7891000315508" onApply={vi.fn()} />)
    expect(screen.getByText(/No es un EAN\/UPC válido/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
