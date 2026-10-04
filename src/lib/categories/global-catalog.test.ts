import { describe, expect, it } from 'vitest'
import {
  categorySlug,
  findGlobalCategoryByName,
  planCategoryLinks,
  sortGlobalCategories,
} from './global-catalog'

const catalogo = [
  { id: 'c-elec', name: 'Electrónica', slug: 'electronica', aliases: ['Tecnología'], sort_order: 1 },
  { id: 'c-cel', name: 'Celulares', slug: 'celulares', parent_id: 'c-elec', aliases: ['Telefonía'], sort_order: 1 },
  { id: 'c-acc', name: 'Accesorios', slug: 'accesorios', parent_id: 'c-elec', sort_order: 2 },
  { id: 'c-vieja', name: 'Descontinuada', slug: 'descontinuada', is_active: false, sort_order: 9 },
]

describe('catálogo global de categorías', () => {
  it('reconoce el mismo nombre escrito distinto y sus alias', () => {
    expect(categorySlug('Electrónica')).toBe('electronica')
    expect(findGlobalCategoryByName('electronica', catalogo)?.id).toBe('c-elec')
    expect(findGlobalCategoryByName('  Tecnología ', catalogo)?.id).toBe('c-elec')
    expect(findGlobalCategoryByName('telefonia', catalogo)?.id).toBe('c-cel')
  })

  it('no propone una categoría dada de baja', () => {
    expect(findGlobalCategoryByName('Descontinuada', catalogo)).toBeNull()
  })

  it('ordena como árbol: padre, después sus hijas', () => {
    expect(sortGlobalCategories(catalogo).map((c) => c.id)).toEqual(['c-elec', 'c-cel', 'c-acc', 'c-vieja'])
  })

  it('termina ante ciclos, conserva huérfanas y no repite IDs', () => {
    const corruptCatalog = [
      { id: 'root', name: 'Raíz', slug: 'raiz', sort_order: 1 },
      { id: 'child', name: 'Hija', slug: 'hija', parent_id: 'root', sort_order: 1 },
      { id: 'cycle-a', name: 'Ciclo A', slug: 'ciclo-a', parent_id: 'cycle-b', sort_order: 1 },
      { id: 'cycle-b', name: 'Ciclo B', slug: 'ciclo-b', parent_id: 'cycle-a', sort_order: 1 },
      { id: 'orphan', name: 'Huérfana', slug: 'huerfana', parent_id: 'missing', sort_order: 1 },
      { id: 'child', name: 'Hija duplicada', slug: 'hija-duplicada', parent_id: 'root', sort_order: 2 },
    ]

    const ids = sortGlobalCategories(corruptCatalog).map((category) => category.id)

    expect(ids).toEqual(['root', 'child', 'cycle-a', 'cycle-b', 'orphan'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  /** Hoy hay 116 categorías de empresas y ninguna vinculada. */
  it('vincula por nombre solo las que están sueltas', () => {
    const plan = planCategoryLinks(
      [
        { id: 't1', name: 'Celulares' },
        { id: 't2', name: 'telefonía' },
        { id: 't3', name: 'Panadería' },
        { id: 't4', name: 'Accesorios', global_category_id: 'c-elec' },
      ],
      catalogo,
    )

    expect(plan).toEqual([
      { id: 't1', global_category_id: 'c-cel' },
      { id: 't2', global_category_id: 'c-cel' },
    ])
  })
})
