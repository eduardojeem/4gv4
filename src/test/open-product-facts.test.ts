import { describe, expect, it, vi } from 'vitest'
import {
  lookupOpenFacts,
  openFactsSourcesFor,
  parseOpenFactsProduct,
} from '@/lib/products/open-product-facts'

const cocaCola = {
  status: 1,
  product: {
    product_name_es: 'Coca Cola Original',
    product_name: 'coca cola',
    brands: 'Coca-Cola, The Coca-Cola Company',
    quantity: '2,25 L',
    image_front_url: 'https://images.openfoodfacts.org/images/products/779/089/500/0997/front_en.43.400.jpg',
  },
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('bases abiertas de productos', () => {
  it('arma nombre con tamaño, primera marca, foto y la fuente', () => {
    expect(parseOpenFactsProduct('openfoodfacts', '7790895000997', cocaCola)).toEqual({
      source: 'openfoodfacts',
      gtin: '7790895000997',
      name: 'Coca Cola Original 2,25 L',
      brandName: 'Coca-Cola',
      description: null,
      imageUrl: cocaCola.product.image_front_url,
      sourceUrl: 'https://world.openfoodfacts.org/product/7790895000997',
    })
  })

  it('agrega la marca si el nombre no la dice y ordena las mayúsculas', () => {
    const parsed = parseOpenFactsProduct('openbeautyfacts', '7891000315507', {
      status: 1,
      product: { product_name: 'shampoo reparación total', brands: 'Elvive', generic_name: 'Shampoo para cabello dañado' },
    })
    expect(parsed?.name).toBe('Elvive Shampoo Reparación Total')
    expect(parsed?.description).toBe('Shampoo para cabello dañado')
  })

  it('sin nombre o sin producto no sirve; una foto de otro sitio se descarta', () => {
    expect(parseOpenFactsProduct('openfoodfacts', '1', { status: 0 })).toBeNull()
    expect(parseOpenFactsProduct('openfoodfacts', '1', { status: 1, product: { brands: 'X' } })).toBeNull()
    expect(parseOpenFactsProduct('openfoodfacts', '1', {
      status: 1, product: { product_name: 'Yerba', image_url: 'https://evil.example/x.jpg' },
    })?.imageUrl).toBeNull()
  })

  it('solo se consulta en los rubros donde estas bases tienen datos', () => {
    expect(openFactsSourcesFor('food')).toEqual(['openfoodfacts', 'openbeautyfacts'])
    expect(openFactsSourcesFor('cosmetics')).toEqual(['openbeautyfacts', 'openfoodfacts'])
    expect(openFactsSourcesFor('barbershop')[0]).toBe('openbeautyfacts')
    expect(openFactsSourcesFor('general')).toEqual(['openfoodfacts', 'openbeautyfacts'])
    expect(openFactsSourcesFor(null)).toEqual(['openfoodfacts', 'openbeautyfacts'])
    for (const vertical of ['electronics', 'clothing', 'hardware']) expect(openFactsSourcesFor(vertical)).toEqual([])
  })

  it('si la primera base no lo tiene, prueba la otra', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ status: 0 }, 404))
      .mockResolvedValueOnce(json({ status: 1, product: { product_name: 'Crema Nivea', brands: 'Nivea' } }))
    const found = await lookupOpenFacts('4005808230507', ['openfoodfacts', 'openbeautyfacts'], fetchMock as unknown as typeof fetch)
    expect(found).toMatchObject({ source: 'openbeautyfacts', name: 'Crema Nivea' })
    expect(fetchMock.mock.calls[0][0]).toContain('world.openfoodfacts.org/api/v2/product/4005808230507.json')
    expect(fetchMock.mock.calls[1][0]).toContain('world.openbeautyfacts.org/api/v2/product/4005808230507.json')
    // Se identifica ante las bases, como piden.
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'User-Agent': expect.stringContaining('MiTiendaPy') })
  })

  it('sin conexión, sin rubro compatible o con un código raro devuelve null sin romper', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(lookupOpenFacts('7790895000997', ['openfoodfacts', 'openbeautyfacts'], failing as unknown as typeof fetch)).resolves.toBeNull()
    expect(failing).toHaveBeenCalledTimes(2)

    const unused = vi.fn()
    await expect(lookupOpenFacts('7790895000997', [], unused as unknown as typeof fetch)).resolves.toBeNull()
    await expect(lookupOpenFacts('abc/../x', ['openfoodfacts'], unused as unknown as typeof fetch)).resolves.toBeNull()
    expect(unused).not.toHaveBeenCalled()
  })
})
