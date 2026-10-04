import { describe, expect, it } from 'vitest'
import { parseCatalogAdminQuery } from './admin-query'

describe('parseCatalogAdminQuery', () => {
  it('usa valores seguros por defecto', () => {
    expect(parseCatalogAdminQuery(new URLSearchParams())).toEqual({
      q: '', status: 'all', brand: null, category: null, sort: 'name', page: 1, pageSize: 50,
    })
  })

  it('limita página y tamaño y descarta filtros desconocidos', () => {
    const query = parseCatalogAdminQuery(new URLSearchParams('q=++&status=hack&sort=nope&page=-2&pageSize=101&brand=x&category=y'))
    expect(query).toEqual({ q: '', status: 'all', brand: null, category: null, sort: 'name', page: 1, pageSize: 100 })
  })

  it('acepta filtros UUID y órdenes cerrados', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(parseCatalogAdminQuery(new URLSearchParams(`q=Galaxy&status=inactive&sort=usage_desc&page=3&pageSize=25&brand=${id}&category=${id}`)))
      .toEqual({ q: 'Galaxy', status: 'inactive', brand: id, category: id, sort: 'usage_desc', page: 3, pageSize: 25 })
  })
})
