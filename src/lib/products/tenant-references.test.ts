import { describe, expect, it, vi } from 'vitest'
import { productReferencesBelongToOrganization } from './tenant-references'

function client(allowed: Record<string, boolean>) {
  return { from: vi.fn((table: string) => {
    let id = ''
    let organization = ''
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: string) => { if (field === 'id') id = value; if (field === 'organization_id') organization = value; return query }),
      maybeSingle: vi.fn(async () => ({ data: allowed[`${table}:${organization}:${id}`] ? { id } : null, error: null })),
    }
    return query
  }) } as never
}

describe('product tenant references', () => {
  it('accepts category and supplier only when both belong to the authorized organization', async () => {
    const db = client({ 'categories:org-a:category-a': true, 'suppliers:org-a:supplier-a': true })
    await expect(productReferencesBelongToOrganization(db, 'org-a', { category_id: 'category-a', supplier_id: 'supplier-a' })).resolves.toBe(true)
  })

  it('rejects a foreign category or supplier without revealing its owner', async () => {
    const db = client({ 'categories:org-a:category-a': true, 'suppliers:org-b:supplier-b': true })
    await expect(productReferencesBelongToOrganization(db, 'org-a', { category_id: 'category-a', supplier_id: 'supplier-b' })).resolves.toBe(false)
  })
})
