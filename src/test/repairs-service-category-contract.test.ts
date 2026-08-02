import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const productsHook = readFileSync(
  resolve(workspace, 'src/hooks/useProductsSupabase.ts'),
  'utf8'
)
const inventoryContext = readFileSync(
  resolve(workspace, 'src/app/dashboard/repairs/inventory/context/InventoryContext.tsx'),
  'utf8'
)

describe('repairs service category contract', () => {
  it('creates the service category through the tenant-authenticated API', () => {
    expect(productsHook).toContain("fetch('/api/categories'")
    expect(productsHook).not.toMatch(
      /const createCategory[\s\S]*?\.from\('categories'\)[\s\S]*?\.insert\(/
    )
  })

  it('preserves the category API error for the service form', () => {
    expect(inventoryContext).toContain(
      'throw new Error(catRes.error || "No se pudo crear la categoría de Servicios")'
    )
  })
})
