import { describe, expect, it } from 'vitest'
import { buildCategoryOptions, getCategoryIndent } from './category-tree'

const cat = (id: string, name: string, parent_id: string | null = null) => ({ id, name, parent_id })

describe('buildCategoryOptions', () => {
  it('pone cada hija debajo de su padre', () => {
    const options = buildCategoryOptions([
      cat('fundas', 'Fundas', 'celulares'),
      cat('celulares', 'Celulares'),
      cat('cargadores', 'Cargadores', 'celulares'),
    ])

    expect(options.map((o) => o.category.name)).toEqual(['Celulares', 'Cargadores', 'Fundas'])
    expect(options.map((o) => o.depth)).toEqual([0, 1, 1])
  })

  it('ordena alfabéticamente en cada nivel, no globalmente', () => {
    const options = buildCategoryOptions([
      cat('b', 'Bebidas'),
      cat('a', 'Accesorios'),
      cat('a-z', 'Zapatos', 'a'),
      cat('a-c', 'Cables', 'a'),
    ])

    // Accesorios primero con sus hijas ordenadas, después Bebidas.
    expect(options.map((o) => o.category.name)).toEqual(['Accesorios', 'Cables', 'Zapatos', 'Bebidas'])
  })

  it('expone el nombre del padre para desambiguar hijas homónimas', () => {
    const options = buildCategoryOptions([
      cat('cel', 'Celulares'),
      cat('note', 'Notebooks'),
      cat('cel-f', 'Fundas', 'cel'),
      cat('note-f', 'Fundas', 'note'),
    ])

    const fundas = options.filter((o) => o.category.name === 'Fundas')
    expect(fundas).toHaveLength(2)
    expect(fundas.map((o) => o.parentName).sort()).toEqual(['Celulares', 'Notebooks'])
  })

  it('soporta más de dos niveles', () => {
    const options = buildCategoryOptions([
      cat('a', 'Uno'),
      cat('b', 'Dos', 'a'),
      cat('c', 'Tres', 'b'),
    ])

    expect(options.map((o) => o.depth)).toEqual([0, 1, 2])
    expect(options[2].parentName).toBe('Dos')
  })

  it('trata como raíz a la categoría cuyo padre no existe, en vez de perderla', () => {
    const options = buildCategoryOptions([
      cat('huerfana', 'Huerfana', 'borrada'),
      cat('normal', 'Normal'),
    ])

    expect(options).toHaveLength(2)
    expect(options.find((o) => o.category.id === 'huerfana')?.depth).toBe(0)
  })

  it('no cuelga con un ciclo y no pierde categorías', () => {
    // La API impide guardar ciclos, pero datos viejos podrían tenerlos.
    const options = buildCategoryOptions([
      cat('a', 'A', 'b'),
      cat('b', 'B', 'a'),
      cat('c', 'C'),
    ])

    expect(options).toHaveLength(3)
    expect(options.map((o) => o.category.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('ignora una categoría que se apunta a sí misma', () => {
    const options = buildCategoryOptions([cat('a', 'A', 'a')])

    expect(options).toHaveLength(1)
    expect(options[0].depth).toBe(0)
  })

  it('devuelve lista vacía sin datos', () => {
    expect(buildCategoryOptions([])).toEqual([])
    expect(buildCategoryOptions(null)).toEqual([])
    expect(buildCategoryOptions(undefined)).toEqual([])
  })

  it('conserva el objeto original para no perder campos', () => {
    const original = { id: 'a', name: 'A', parent_id: null, is_active: true }
    const [option] = buildCategoryOptions([original])

    expect(option.category).toBe(original)
  })
})

describe('getCategoryIndent', () => {
  const BRANCH = '└─ '
  const PAD = '  '

  it('no indenta las raices', () => {
    expect(getCategoryIndent(0)).toBe('')
  })

  it('marca las hijas con una rama por nivel', () => {
    expect(getCategoryIndent(1)).toBe(BRANCH)
    expect(getCategoryIndent(2)).toBe(PAD + BRANCH)
    expect(getCategoryIndent(3)).toBe(PAD + PAD + BRANCH)
  })

  it('usa espacios duros para que la indentacion no se colapse en HTML', () => {
    // Un espacio normal al principio lo colapsa el navegador y el usuario
    // veria todas las subcategorias alineadas con las raices.
    expect(getCategoryIndent(2).charCodeAt(0)).toBe(0x00A0)
  })
})
