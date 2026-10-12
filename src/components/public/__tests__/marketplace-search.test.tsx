/**
 * La busqueda del marketplace se borraba sola.
 *
 * /marketplace/buscar filtra en el servidor y monta ProductsClient, que tiene su
 * propio buscador sincronizado con la URL: si el texto del input y `?q=` difieren,
 * a los 400 ms reescribe la URL con el input. Como se lo montaba con
 * `initialQuery=""` y la URL traia el termino, la sincronizacion borraba la
 * busqueda recien hecha — y solo cuando habia resultados, porque esa seccion es
 * condicional a que los haya.
 */
import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

const push = vi.fn()
const replace = vi.fn()
let currentParams = new URLSearchParams('')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/marketplace/buscar',
  useSearchParams: () => currentParams,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children?: React.ReactNode; href?: string; [key: string]: unknown }) => <a href={String(href)} {...(rest as Record<string, unknown>)}>{children}</a>,
}))

/* eslint-disable @next/next/no-img-element -- The next/image test double must render a native image. */
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...rest }: { alt: string; [key: string]: unknown }) => <img alt={alt} {...(rest as Record<string, unknown>)} />,
}))
/* eslint-enable @next/next/no-img-element */

vi.mock('../Favorites', () => ({ FavoriteButton: () => <button type="button">fav</button> }))
vi.mock('../MarketplaceProductModal', () => ({ MarketplaceProductModal: () => null }))

const { ProductsClient } = await import('../ProductsClient')
const { MarketplaceSearchBox } = await import('../MarketplaceSearchBox')

function producto(name: string): MarketplaceProduct {
  return {
    id: name, name, sku: name, description: null, brand: 'Genius',
    sale_price: 90000, wholesale_price: null, stock_quantity: 3, in_stock: true,
    is_active: true, featured: false, has_offer: false, offer_price: null,
    image: null, images: null, unit_measure: 'unidad', barcode: null,
    organization_id: 'o1', organization_name: 'Tienda', organization_slug: 'tienda',
  } as MarketplaceProduct
}

describe('la busqueda del marketplace no se borra sola', () => {
  beforeEach(() => {
    push.mockClear()
    replace.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => { vi.useRealTimers() })

  it('mantiene contraste explícito y tamaño táctil en el botón de buscar', () => {
    render(<MarketplaceSearchBox />)
    const button = screen.getByRole('button', { name: 'Buscar' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveClass('bg-cyan-700', 'text-white', 'hover:bg-cyan-800', 'min-h-11')
  })

  it('no reescribe la URL cuando recibe el termino que la URL ya trae', async () => {
    currentParams = new URLSearchParams('q=teclado')

    render(<ProductsClient products={[producto('Teclado mecanico')]} initialQuery="teclado" hideSearch />)

    await act(async () => { vi.advanceTimersByTime(600) })

    expect(push, `reescribio la URL: ${JSON.stringify(push.mock.calls)}`).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('con initialQuery vacio y ?q= presente si la borraria (el bug original)', async () => {
    // Deja escrito por que la pagina tiene que pasar el termino: si alguien vuelve
    // a montar el componente sin el, esto documenta exactamente lo que pasa.
    currentParams = new URLSearchParams('q=teclado')

    render(<ProductsClient products={[producto('Teclado mecanico')]} initialQuery="" />)

    await act(async () => { vi.advanceTimersByTime(600) })

    expect(replace).toHaveBeenCalledWith('/marketplace/buscar?', { scroll: false })
    expect(push).not.toHaveBeenCalled()
  })

  it('deja un solo buscador cuando la pantalla ya tiene el suyo', () => {
    currentParams = new URLSearchParams('q=teclado')

    const { unmount } = render(
      <ProductsClient products={[producto('Teclado mecanico')]} initialQuery="teclado" hideSearch />
    )
    expect(screen.queryByPlaceholderText('Buscar productos...')).not.toBeInTheDocument()
    unmount()

    currentParams = new URLSearchParams('')
    render(<ProductsClient products={[producto('Teclado mecanico')]} initialQuery="" />)
    expect(screen.getByPlaceholderText('Buscar productos...')).toBeInTheDocument()
  })
})

describe('una respuesta vieja no pisa lo que se esta escribiendo', () => {
  beforeEach(() => {
    push.mockClear()
    replace.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => { vi.useRealTimers() })

  it('mantiene el texto cuando llega la respuesta de un termino anterior', async () => {
    // En /marketplace/productos: escribis "note", sale el pedido, seguis hasta
    // "notebook", y cuando volvia la respuesta de "note" el campo retrocedia.
    currentParams = new URLSearchParams('')

    const { rerender } = render(
      <ProductsClient products={[producto('Notebook')]} initialQuery="" />
    )

    const input = screen.getByPlaceholderText('Buscar productos...') as HTMLInputElement
    await act(async () => {
      input.focus()
      fireEvent.change(input, { target: { value: 'notebook' } })
    })

    // Llega la respuesta del termino anterior, mas corto.
    currentParams = new URLSearchParams('q=note')
    await act(async () => {
      rerender(<ProductsClient products={[producto('Notebook')]} initialQuery="note" />)
    })

    expect(input.value).toBe('notebook')
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(replace).toHaveBeenCalledWith('/marketplace/buscar?q=notebook', { scroll: false })
  })

  it('no restaura una búsqueda anterior después de limpiar el campo', () => {
    currentParams = new URLSearchParams('q=notebook')
    const { rerender } = render(<ProductsClient products={[]} initialQuery="notebook" />)
    const input = screen.getByPlaceholderText('Buscar productos...')
    fireEvent.change(input, { target: { value: '' } })
    currentParams = new URLSearchParams('q=note')
    rerender(<ProductsClient products={[]} initialQuery="note" />)
    expect(input).toHaveValue('')
  })

  it('acepta navegación externa cuando no hay una edición local pendiente', () => {
    currentParams = new URLSearchParams('q=note')
    const { rerender } = render(<ProductsClient products={[]} initialQuery="note" />)
    currentParams = new URLSearchParams('q=teclado')
    rerender(<ProductsClient products={[]} initialQuery="teclado" />)
    expect(screen.getByPlaceholderText('Buscar productos...')).toHaveValue('teclado')
  })

  it('acepta navegación externa después de confirmar la búsqueda escrita', () => {
    currentParams = new URLSearchParams('q=note')
    const { rerender } = render(<ProductsClient products={[]} initialQuery="note" />)
    const input = screen.getByPlaceholderText('Buscar productos...')
    fireEvent.change(input, { target: { value: 'notebook' } })
    currentParams = new URLSearchParams('q=notebook')
    rerender(<ProductsClient products={[]} initialQuery="notebook" />)
    currentParams = new URLSearchParams('q=note')
    rerender(<ProductsClient products={[]} initialQuery="note" />)
    expect(input).toHaveValue('note')
  })
})
