import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

type QueryCall = { method: string; args: unknown[] }

let calls: Record<string, QueryCall[]> = {}

function createFakeClient() {
  return {
    from(table: string) {
      const recorded = calls[table] ?? (calls[table] = [])

      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            return (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              Promise.resolve({ data: [], count: 0, error: null }).then(onFulfilled, onRejected)
          }
          return (...args: unknown[]) => {
            recorded.push({ method: String(prop), args })
            return builder
          }
        },
      }) as Record<string | symbol, unknown>

      return builder
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => createFakeClient(),
}))

const { getMarketplaceBrands, getMarketplaceOrganizations, getMarketplaceProductsPage } =
  await import('@/lib/public/marketplace')

/** El unico `.or(...)` que se le mando a esa tabla. */
function orArg(table: string) {
  const call = (calls[table] ?? []).find((c) => c.method === 'or')
  return call ? String(call.args[0]) : null
}

const UUID = '3f1c9a52-8b7e-4c1d-9a0f-2e5d7b6c4a13'

beforeEach(() => { calls = {} })

/**
 * El termino de busqueda se interpolaba crudo dentro de un `.or(...)` de
 * PostgREST, donde la coma separa condiciones. No se podian anular los filtros de
 * tienda y visibilidad —van con AND aparte— pero si agregar condiciones propias
 * sobre columnas que nunca se publican: con `?q=zzz%,cost_price.gt.500000,...`
 * el resultado respondia si/no sobre el costo, y por biseccion se reconstruia el
 * costo y el margen de cualquier producto del marketplace.
 */
describe('el termino de busqueda no puede agregar condiciones propias', () => {
  const inyeccion = 'zzz%,cost_price.gt.500000,name.ilike.%zzz'

  /**
   * Lo que hace segura la expresion no es que desaparezca el texto inyectado
   * —queda, como texto literal a buscar— sino que no queden condiciones de mas.
   * PostgREST separa las condiciones por coma, asi que cada parte tiene que ser
   * una de las nuestras.
   */
  function condiciones(filtro: string | null, columnas: string[]) {
    expect(filtro, 'no se armo la expresion').toBeTruthy()
    const partes = filtro!.split(',')
    expect(partes, `condiciones de mas: ${filtro}`).toHaveLength(columnas.length)
    partes.forEach((parte, i) => {
      expect(parte.startsWith(`${columnas[i]}.ilike.%`), `condicion ajena: ${parte}`).toBe(true)
    })
  }

  it('lo sanitiza en el catalogo de productos', async () => {
    await getMarketplaceProductsPage(10, { q: inyeccion })

    condiciones(orArg('products'), ['name', 'sku', 'brand', 'description'])
    // El `cost_price.gt.500000` sobrevive como texto a buscar, no como filtro.
    expect(orArg('products')).not.toContain('%,cost_price')
  })

  it('lo sanitiza en el directorio de empresas', async () => {
    await getMarketplaceOrganizations(10, { q: 'acme,plan.eq.enterprise' })

    condiciones(orArg('organizations'), ['name', 'slug'])
  })

  it('conserva el punto y el guion bajo, que son parte de codigos reales', async () => {
    // Sanitizar de mas rompe la busqueda: un SKU `ABC-1.5L` tiene que encontrarse.
    await getMarketplaceProductsPage(10, { q: 'ABC-1.5L_max' })

    expect(orArg('products')).toContain('name.ilike.%ABC-1.5L_max%')
  })

  it('busca en nombre, SKU, marca y descripcion', async () => {
    // Antes solo nombre y marca, asi que el mismo termino daba resultados
    // distintos segun si lo escribias en /buscar o en /productos.
    await getMarketplaceProductsPage(10, { q: 'funda' })

    const filtro = orArg('products')
    for (const columna of ['name', 'sku', 'brand', 'description']) {
      expect(filtro, columna).toContain(`${columna}.ilike.%funda%`)
    }
  })
})

/**
 * El id de categoria tambien se interpolaba dentro de un `.or(...)`. Comprobar
 * que sea UUID lo cierra y de paso evita mandarle a la base una consulta que solo
 * puede fallar.
 */
describe('el id de categoria se comprueba antes de interpolarlo', () => {
  it('no consulta nada con un id que no es UUID', async () => {
    const resultado = await getMarketplaceProductsPage(10, { categoria: 'x,parent_id.not.is.null' })

    expect(calls.categories, 'se consulto con un id armado a mano').toBeUndefined()
    expect(resultado).toEqual({ products: [], total: 0 })
  })

  it('tampoco en el listado de marcas', async () => {
    const marcas = await getMarketplaceBrands(10, { categoria: 'no-es-uuid' })

    expect(calls.categories).toBeUndefined()
    expect(marcas).toEqual([])
  })

  it('con un UUID valido sigue incluyendo las subcategorias', async () => {
    await getMarketplaceProductsPage(10, { categoria: UUID })

    expect(orArg('categories')).toBe(
      `id.eq.${UUID},parent_id.eq.${UUID},global_category_id.eq.${UUID}`
    )
  })
})

/**
 * /marketplace/buscar traia las 160 filas mas recientes y filtraba en JavaScript:
 * un producto fuera de esas 160 era inencontrable aunque escribieras su nombre
 * exacto, y lo mismo con las empresas.
 */
describe('la busqueda global consulta la base', () => {
  const pagina = leer('src/app/marketplace/buscar/page.tsx')

  it('le pasa el termino a las dos consultas', () => {
    expect(pagina).toContain('getMarketplaceProductsPage(PRODUCT_RESULTS, { q: query || undefined })')
    expect(pagina).toContain('getMarketplaceOrganizations(ORGANIZATION_RESULTS, { q: query || undefined })')
  })

  it('ya no filtra en JavaScript', () => {
    expect(pagina).not.toContain('normalizeSearch')
    expect(pagina).not.toContain('.filter((product)')
    expect(pagina).not.toContain('.filter((organization)')
  })

  it('le pasa el termino al componente que muestra los resultados', () => {
    // Con `initialQuery=""` el componente reescribia la URL sin el termino a los
    // 400 ms y borraba la busqueda recien hecha.
    expect(pagina).toContain('initialQuery={query}')
    expect(pagina).not.toContain('initialQuery=""')
  })

  it('cuenta sobre el total del rango, no sobre lo que alcanzo a traer', () => {
    expect(pagina).toContain('productPage.total')
    expect(pagina).toContain('hiddenProducts')
  })
})
