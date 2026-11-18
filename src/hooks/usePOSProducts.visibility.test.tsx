import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'visibility-test' }) }))
vi.mock('./useRealTimeSync', () => ({ useProductRealTimeSync: () => ({ getConnectionHealth: () => ({}), subscribe: vi.fn(), unsubscribe: vi.fn() }) }))
import { usePOSProducts } from './usePOSProducts'
import { mapProductForPOS, type PosProductRow } from '@/app/dashboard/pos/lib/pos-product-mapper'
const product = { id: 'p', name: 'Crema', sku: 'P-1', sale_price: 100, stock_quantity: 7, category_id: null, is_active: true, visibility: 'hidden', hide_price: true, organization_id: 'org', warranty_info: 'Cobertura registrada' }
afterEach(() => vi.unstubAllGlobals())
it('el catálogo POS conserva la publicación y los detalles del negocio', () => {
  expect(mapProductForPOS(product as PosProductRow)).toMatchObject({ visibility: 'hidden', hide_price: true, organization_id: 'org', warranty_info: 'Cobertura registrada' })
})
it('actualiza solo publicación y conserva stock y precio actuales, incluso al reabrir', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { products: [product], total: 1 } }) }))
  const { result, unmount } = renderHook(() => usePOSProducts())
  await waitFor(() => expect(result.current.products).toHaveLength(1))
  act(() => result.current.syncProductVisibility('p', { visibility: 'wholesale', hide_price: false }))
  expect(result.current.products[0]).toMatchObject({ visibility: 'wholesale', hide_price: false, stock_quantity: 7, sale_price: 100 })
  unmount()
  const reopened = renderHook(() => usePOSProducts())
  expect(reopened.result.current.products[0]).toMatchObject({ visibility: 'wholesale', hide_price: false, stock_quantity: 7, sale_price: 100 })
})
