import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('paginación administrativa de catálogos', () => {
  it.each([
    ['products', 'get_global_products_admin'],
    ['device-models', 'get_global_device_models_admin'],
  ])('%s usa parser común y agregación SQL', (routeName, rpc) => {
    const route = read(`src/app/api/superadmin/global-${routeName}/route.ts`)
    expect(route).toContain('parseCatalogAdminQuery')
    expect(route).toContain(`rpc('${rpc}'`)
    expect(route).not.toMatch(/PRODUCT_ROW_CAP|USAGE_ROW_CAP|limit\(5000\)/)
    expect(route).toContain('candidatesTotal')
    expect(route).toContain('truncated')
  })
})
