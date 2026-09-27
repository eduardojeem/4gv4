import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const collection = readFileSync(resolve(process.cwd(), 'src/app/api/products/route.ts'), 'utf8')
const item = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/route.ts'), 'utf8')

describe('products API tenant isolation contract', () => {
  it('scopes collection reads and server-owned inserts', () => {
    expect(collection).toContain(".eq('organization_id', organization.id)")
    expect(collection).toContain('organization_id: organization.id')
  })

  it('combines product id with the active organization for item operations', () => {
    const guardedReads = item.match(/\.eq\('organization_id', organization\.id\)/g) ?? []
    expect(guardedReads.length).toBeGreaterThanOrEqual(4)
  })
})
