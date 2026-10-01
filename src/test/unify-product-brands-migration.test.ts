import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261005120000_unify_product_brands.sql'), 'utf8')
const leer = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('unificar la marca de los productos', () => {
  it('sigue la misma regla que la API, en el mismo orden', () => {
    const catalogo = SQL.indexOf('tb.global_brand_id = pg_temp.catalog_brand_for(p2.brand)')
    const nombre = SQL.indexOf('lower(trim(tb.name)) = lower(trim(p2.brand))')
    const crear = SQL.indexOf('insert into public.brands')
    const texto = SQL.lastIndexOf('set brand = b.name')
    expect(catalogo).toBeGreaterThan(0)
    expect(nombre).toBeGreaterThan(catalogo)
    expect(crear).toBeGreaterThan(nombre)
    expect(texto).toBeGreaterThan(crear)
  })

  it('crea una sola marca por tienda aunque dos textos sean la misma del catálogo', () => {
    expect(SQL).toContain('distinct on (p.organization_id, coalesce(g.id::text, lower(trim(p.brand))))')
  })

  it('solo toca productos sin vínculo al vincular, y no borra nada', () => {
    expect(SQL).not.toMatch(/\bdelete\b/i)
    expect((SQL.match(/where p2\.brand_id is null/g) ?? []).length).toBe(2)
  })

  it('la API de productos usa la misma resolución al crear y al editar', () => {
    expect(leer('src/app/api/products/route.ts').match(/resolveProductBrand\(/g)?.length).toBe(2)
    expect(leer('src/app/api/products/[id]/route.ts')).toContain('resolveProductBrand(')
  })
})
