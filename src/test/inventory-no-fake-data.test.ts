import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const BUSQUEDA = leer('src/components/admin/advanced-search.tsx')
const PANTALLA = leer('src/components/admin/inventory/inventory-management.tsx')
const HOOK = leer('src/hooks/use-inventory.ts')
const API = leer('src/app/api/products/route.ts')
const MOVIMIENTOS = leer('src/components/admin/inventory/stock-movements.tsx')

/**
 * Cuando no llegaban categorias o proveedores —porque la empresa no cargo
 * ninguno, o porque la peticion fallo en silencio— la busqueda avanzada
 * sustituia por una lista propia. Elegir «Samsung» filtraba por un id que no
 * existe: cero resultados sin explicacion, y el usuario concluia que no tenia
 * stock de Samsung.
 */
describe('la busqueda avanzada no inventa el catalogo', () => {
  it('no quedan proveedores ni categorias de ejemplo', () => {
    expect(BUSQUEDA).not.toContain("{ label: 'Apple Inc.', value: 'apple' }")
    expect(BUSQUEDA).not.toContain("{ label: 'Samsung', value: 'samsung' }")
    expect(BUSQUEDA).not.toContain("{ label: 'Smartphones', value: 'smartphones' }")
    expect(BUSQUEDA).toContain('const effectiveCategoryOptions = categoryOptions')
    expect(BUSQUEDA).toContain('const effectiveSupplierOptions = supplierOptions')
  })

  it('las busquedas guardadas de ejemplo tampoco', () => {
    expect(BUSQUEDA).not.toContain('mockSavedSearches')
    expect(BUSQUEDA).not.toContain("name: 'Smartphones Apple'")
    expect(BUSQUEDA).not.toContain("createdAt: new Date('2024-01-15')")
  })

  it('y las que guarda el usuario sobreviven a cambiar de pestaña', () => {
    // Radix desmonta el contenido inactivo: vivian en estado de React y se
    // perdian al salir de la pestaña.
    expect(BUSQUEDA).toContain("const SAVED_SEARCHES_KEY = 'mipos:inventory:saved-searches'")
    expect(BUSQUEDA).toContain('setSavedSearches(readSavedSearches())')
    expect(BUSQUEDA).toContain('writeSavedSearches(next)')
    // Ventana privada o almacenamiento bloqueado no puede romper la pantalla.
    expect(BUSQUEDA).toContain('} catch {')
  })
})

describe('los rangos se miden en la moneda del negocio', () => {
  it('el tope sale del catalogo y no de un 5.000 fijo', () => {
    expect(BUSQUEDA).not.toContain('value: [0, 5000]')
    expect(BUSQUEDA).not.toContain('max: 5000')
    expect(BUSQUEDA).toContain('priceCeiling')
    expect(BUSQUEDA).toContain('const priceMax = useMemo(')
  })

  it('el techo real llega desde los indicadores', () => {
    expect(PANTALLA).toContain('priceCeiling={snapshot?.maxSalePrice}')
    expect(PANTALLA).toContain('stockCeiling={snapshot?.maxStockQuantity}')
    expect(HOOK).toContain('maxSalePrice: Number(payload.data.maxSalePrice) || 0')
  })

  it('los extremos se leen en guaranies', () => {
    expect(BUSQUEDA).toContain("filter.id === 'priceRange' ? formatCurrency(numero)")
  })
})

describe('la multi-seleccion deja de descartarse', () => {
  it('el cliente manda la seleccion completa', () => {
    expect(PANTALLA).not.toContain("category: categoriesFilter[0] || 'all'")
    expect(PANTALLA).toContain("categoriesFilter.length > 0 ? categoriesFilter.join(',') : 'all'")
    expect(PANTALLA).toContain("suppliersFilter.length > 0 ? suppliersFilter.join(',') : 'all'")
  })

  it('la API la entiende', () => {
    expect(API).toContain('const categoryIds = parseIdList(')
    expect(API).toContain("queryBuilder.in('category_id', categoryIds)")
    expect(API).toContain("queryBuilder.in('supplier_id', supplierIds)")
  })

  it('un solo id sigue usando igualdad', () => {
    // `in` con un elemento funciona, pero `eq` es lo que ya estaba probado.
    expect(API).toContain("queryBuilder.eq('category_id', categoryIds[0])")
  })

  it('el selector simple no miente diciendo «Todas»', () => {
    expect(PANTALLA).toContain('const multiCategoryCount =')
    expect(PANTALLA).toContain('categorías (desde búsqueda avanzada)')
  })
})

describe('el panel de resultados que nunca aparecia', () => {
  it('ya no existe, y la pantalla dice a donde van los resultados', () => {
    // `searchResults` se inicializaba vacio y sus dos unicas asignaciones eran
    // `setSearchResults([])`.
    expect(PANTALLA).not.toContain('setSearchResults')
    expect(BUSQUEDA).not.toContain('results.slice(0, 6)')
    expect(BUSQUEDA).toContain('Los filtros se aplican al catálogo')
    expect(PANTALLA).toContain("setSuccessMessage('Filtros aplicados al catálogo')")
  })
})

describe('los errores dejan de morir en la consola', () => {
  it('categorias y proveedores avisan en pantalla', () => {
    expect(HOOK).toContain('setReferenceDataError(')
    expect(PANTALLA).toContain('{referenceDataError && (')
    expect(PANTALLA).toContain('Los selectores de categoría y proveedor van a quedar vacíos')
  })
})

describe('los movimientos se buscan por producto', () => {
  it('resuelve el termino contra el catalogo', () => {
    expect(MOVIMIENTOS).toContain("from('products')")
    expect(MOVIMIENTOS).toContain('product_id.in.(${ids.join(\',\')})')
  })

  it('y el marcador de posicion lo dice', () => {
    expect(MOVIMIENTOS).toContain('placeholder="Producto, SKU o motivo..."')
  })

  it('sin coincidencias sigue buscando en el motivo', () => {
    expect(MOVIMIENTOS).toContain("query.ilike('notes', `%${termino}%`)")
  })
})
