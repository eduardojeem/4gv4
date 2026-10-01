import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { catalogForVertical, suggestCategoryLinks, type GlobalCategory } from './global-catalog'
import { planStarterCategories, STARTER_CATEGORIES } from '@/lib/organization/starter-kit'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'

const catalog: GlobalCategory[] = [
  { id: 'acc-tec', name: 'Accesorios', slug: 'accesorios', aliases: [], is_active: true, verticals: ['electronics'] },
  { id: 'cel', name: 'Celulares', slug: 'celulares', aliases: [], is_active: true, verticals: ['electronics'] },
  { id: 'mujer', name: 'Ropa de mujer', slug: 'ropa-de-mujer', aliases: ['Mujer'], is_active: true, verticals: ['clothing'] },
  { id: 'acc-moda', name: 'Accesorios de moda', slug: 'accesorios-de-moda', aliases: ['Accesorios'], is_active: true, verticals: ['clothing'] },
  { id: 'ofertas', name: 'Ofertas', slug: 'ofertas', aliases: [], is_active: true, verticals: [] },
]

describe('rubros en las categorías globales', () => {
  it('cada rubro ve las suyas y las que sirven a todos', () => {
    expect(catalogForVertical(catalog, 'clothing').map((category) => category.id)).toEqual(['mujer', 'acc-moda', 'ofertas'])
    // Sin rubros en la base (columna sin crear), todo como antes.
    expect(catalogForVertical(catalog.map(({ verticals: _v, ...rest }) => rest), 'clothing')).toHaveLength(5)
  })

  it('«Accesorios» de una tienda de ropa se sugiere en la de moda, no en la de celulares', () => {
    const [suggestion] = suggestCategoryLinks([{ id: 't1', name: 'Accesorios', vertical: 'clothing' }], catalog)
    expect(suggestion).toMatchObject({ global_category_id: 'acc-moda', exact: true })
    const [tech] = suggestCategoryLinks([{ id: 't2', name: 'Accesorios', vertical: 'electronics' }], catalog)
    expect(tech.global_category_id).toBe('acc-tec')
  })

  it('el kit de inicio de ropa ya queda vinculado; sin rubros en la base, solo electrónica', () => {
    const plan = planStarterCategories('clothing', [], catalog)
    expect(plan.find((row) => row.name === 'Mujer')?.global_category_id).toBe('mujer')
    expect(plan.find((row) => row.name === 'Accesorios')?.global_category_id).toBe('acc-moda')
    const legacy = planStarterCategories('clothing', [], catalog.map(({ verticals: _v, ...rest }) => rest))
    expect(legacy.every((row) => row.global_category_id === null)).toBe(true)
  })

  it('la migración cubre los nombres del kit de inicio de cada rubro con rama propia', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261006130000_global_category_verticals.sql'), 'utf8')
    for (const vertical of BUSINESS_VERTICALS) expect(sql).toContain(`'${vertical}'`)
    const covered = (vertical: 'clothing' | 'cosmetics' | 'food' | 'hardware') =>
      STARTER_CATEGORIES[vertical].filter((name) => !new RegExp(`[{,]${name}[,}]|'${name}'`).test(sql))
    expect(covered('clothing')).toEqual([])
    expect(covered('cosmetics')).toEqual([])
    expect(covered('food')).toEqual([])
    // «Herramientas» ya existía: la migración le suma el rubro ferretería.
    expect(covered('hardware')).toEqual(['Herramientas'])
    expect(sql).toContain("set verticals = '{electronics,hardware}'")
  })
})
