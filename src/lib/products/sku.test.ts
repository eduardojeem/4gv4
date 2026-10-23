import { describe, expect, it, vi } from 'vitest'
import { findProductSku, normalizeSku } from './sku'

describe('organization-scoped normalized SKU lookup', () => {
  it('normalizes case and surrounding spaces', () => {
    expect(normalizeSku(' AbC_123 ')).toBe('abc_123')
  })
  it('passes the active organization and edited id to an exact DB comparison', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'other', name: 'Product', sku: ' abc ' }], error: null })
    expect(await findProductSku({ rpc }, 'org-a', ' ABC ', 'current')).toEqual({ id: 'other', name: 'Product', sku: ' abc ' })
    expect(rpc).toHaveBeenCalledWith('find_product_sku_conflict', {
      p_organization_id: 'org-a', p_sku: 'abc', p_exclude_id: 'current',
    })
  })
  it('does not use wildcard matching for underscores', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await findProductSku({ rpc }, 'org-b', ' A_B ')).toBeNull()
    expect(rpc.mock.calls[0][1].p_sku).toBe('a_b')
  })
  it('fails closed on lookup errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'lookup failed' } })
    await expect(findProductSku({ rpc }, 'org', 'ABC')).rejects.toThrow('lookup failed')
  })
})
