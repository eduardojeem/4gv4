import { describe, expect, it } from 'vitest'

import { paginateCustomers, SEARCH_RESULTS_LIMIT } from './pagination'

const padron = (cantidad: number) =>
  Array.from({ length: cantidad }, (_, index) => ({ id: String(index + 1) }))

const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id)

/**
 * Recorrer el padron y buscar no son lo mismo. Al buscar, la lista ya viene
 * recortada y ordenada por relevancia: partirla en paginas obligaba a navegar
 * para llegar a alguien que el buscador ya habia encontrado. Y `currentPage`
 * venia de antes de escribir, asi que se caia en el medio de los resultados en
 * vez de arriba.
 */
describe('buscar no pagina', () => {
  it('muestra todas las coincidencias de una', () => {
    const resultado = paginateCustomers(padron(37), {
      isSearching: true,
      currentPage: 1,
      itemsPerPage: 10,
    })

    expect(resultado.visible).toHaveLength(37)
    expect(resultado.totalPages).toBe(1)
    expect(resultado.truncated).toBe(false)
  })

  it('la pagina en la que se estaba antes de escribir no arrastra', () => {
    // Este era el sintoma: buscabas desde la pagina 4 y aterrizabas en el medio
    // de los resultados, no en el mejor.
    const resultado = paginateCustomers(padron(25), {
      isSearching: true,
      currentPage: 4,
      itemsPerPage: 10,
    })

    expect(resultado.currentPage).toBe(1)
    expect(ids(resultado.visible)[0]).toBe('1')
  })

  it('con muchos resultados corta y lo dice', () => {
    const resultado = paginateCustomers(padron(SEARCH_RESULTS_LIMIT + 40), {
      isSearching: true,
      currentPage: 1,
      itemsPerPage: 10,
    })

    expect(resultado.visible).toHaveLength(SEARCH_RESULTS_LIMIT)
    expect(resultado.totalItems).toBe(SEARCH_RESULTS_LIMIT + 40)
    expect(resultado.truncated).toBe(true)
  })

  it('el tope se puede ajustar', () => {
    const resultado = paginateCustomers(padron(10), {
      isSearching: true,
      currentPage: 1,
      itemsPerPage: 10,
      limit: 3,
    })

    expect(ids(resultado.visible)).toEqual(['1', '2', '3'])
    expect(resultado.truncated).toBe(true)
  })

  it('sin coincidencias no inventa paginas', () => {
    const resultado = paginateCustomers([], { isSearching: true, currentPage: 1, itemsPerPage: 10 })
    expect(resultado.visible).toHaveLength(0)
    expect(resultado.totalPages).toBe(1)
    expect(resultado.truncated).toBe(false)
  })
})

describe('recorrer el padron sigue paginando', () => {
  it('devuelve la pagina pedida', () => {
    const resultado = paginateCustomers(padron(25), {
      isSearching: false,
      currentPage: 2,
      itemsPerPage: 10,
    })

    expect(ids(resultado.visible)).toEqual(['11', '12', '13', '14', '15', '16', '17', '18', '19', '20'])
    expect(resultado.totalPages).toBe(3)
    expect(resultado.currentPage).toBe(2)
  })

  it('una pagina que ya no existe vuelve a la primera, no a la ultima', () => {
    // Al angostar un filtro, lo que se busca esta arriba.
    const resultado = paginateCustomers(padron(12), {
      isSearching: false,
      currentPage: 9,
      itemsPerPage: 10,
    })

    expect(resultado.currentPage).toBe(1)
    expect(ids(resultado.visible)[0]).toBe('1')
  })

  it('la ultima pagina puede venir incompleta', () => {
    const resultado = paginateCustomers(padron(12), {
      isSearching: false,
      currentPage: 2,
      itemsPerPage: 10,
    })

    expect(ids(resultado.visible)).toEqual(['11', '12'])
  })

  it('sin clientes no hay paginas ni pagina cero', () => {
    const resultado = paginateCustomers([], { isSearching: false, currentPage: 1, itemsPerPage: 10 })
    expect(resultado.totalPages).toBe(0)
    expect(resultado.currentPage).toBe(1)
    expect(resultado.visible).toHaveLength(0)
  })

  it('un tamaño de pagina invalido no divide por cero', () => {
    const resultado = paginateCustomers(padron(3), {
      isSearching: false,
      currentPage: 1,
      itemsPerPage: 0,
    })

    expect(Number.isFinite(resultado.totalPages)).toBe(true)
    expect(resultado.visible).toHaveLength(1)
  })

  it('nunca devuelve una pagina menor a uno', () => {
    const resultado = paginateCustomers(padron(30), {
      isSearching: false,
      currentPage: 0,
      itemsPerPage: 10,
    })

    expect(resultado.currentPage).toBe(1)
  })
})
