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
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

const push = vi.fn()
let currentParams = new URLSearchParams('')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/marketplace/buscar',
  useSearchParams: () => currentParams,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => <a href={String(href)} {...rest}>{children}</a>,
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...rest }: any) => <img alt={alt} {...rest} />,
}))

vi.mock('../Favorites', () => ({ FavoriteButton: () => <button type="button">fav</button> }))
vi.mock('../MarketplaceProductModal', () => ({ MarketplaceProductModal: () => null }))

const { ProductsClient } = await import('../ProductsClient')

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
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => { vi.useRealTimers() })

  it('no reescribe la URL cuando recibe el termino que la URL ya trae', async () => {
    currentParams = new URLSearchParams('q=teclado')

    render(<ProductsClient products={[producto('Teclado mecanico')]} initialQuery="teclado" hideSearch />)

    await act(async () => { vi.advanceTimersByTime(600) })

    expect(push, `reescribio la URL: ${JSON.stringify(push.mock.calls)}`).not.toHaveBeenCalled()
  })

  it('con initialQuery vacio y ?q= presente si la borraria (el bug original)', async () => {
    // Deja escrito por que la pagina tiene que pasar el termino: si alguien vuelve
    // a montar el componente sin el, esto documenta exactamente lo que pasa.
    currentParams = new URLSearchParams('q=teclado')

    render(<ProductsClient products={[producto('Teclado mecanico')]} initialQuery="" />)

    await act(async () => { vi.advanceTimersByTime(600) })

    expect(push).toHaveBeenCalledWith('/marketplace/buscar?', { scroll: false })
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
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!
        .set!.call(input, 'notebook')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    // Llega la respuesta del termino anterior, mas corto.
    currentParams = new URLSearchParams('q=note')
    await act(async () => {
      rerender(<ProductsClient products={[producto('Notebook')]} initialQuery="note" />)
    })

    expect(input.value).toBe('notebook')
  })
})
