import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const productsRoute = readFileSync(
  resolve(workspace, 'src/app/api/products/route.ts'),
  'utf8'
)
const productsHook = readFileSync(
  resolve(workspace, 'src/hooks/useProductsSupabase.ts'),
  'utf8'
)
const productsPage = readFileSync(
  resolve(workspace, 'src/app/dashboard/products/page.tsx'),
  'utf8'
)

describe('dashboard products loading contract', () => {
  it('loads the list through the authenticated products API', () => {
    expect(productsHook).toContain(
      'fetch(`/api/products?${params.toString()}`'
    )
    expect(productsHook).not.toMatch(
      /const fetchProducts[\s\S]*?\.from\('products'\)[\s\S]*?const fetchCategories/
    )
  })

  it('enforces tenant scope before using the server database client', () => {
    expect(productsRoute).toContain(
      "withTenantAuth({ permission: 'products.read', module: 'inventory' }"
    )
    expect(productsRoute).toContain(
      ".eq('organization_id', organization.id)"
    )
    expect(productsRoute).toContain('const supabase = createAdminSupabase()')
    expect(productsRoute).toContain(
      'priceMaxParam === null ? null : Number(priceMaxParam)'
    )
  })

  it('keeps dashboard filters and exposes loading failures to the user', () => {
    for (const parameter of [
      'category_id',
      'supplier_id',
      'stock_status',
      'price_min',
      'price_max',
      'is_active',
    ]) {
      expect(productsHook).toContain(parameter)
    }

    expect(productsPage).toContain('No se pudieron cargar los productos')
    expect(productsPage).toContain('Reintentar')
  })
})
