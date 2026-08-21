import { beforeEach, describe, expect, it, vi } from 'vitest'

const productsLimit = vi.fn()
const inventoryIn = vi.fn()
const repairMaybeSingle = vi.fn()
const ctx = {
  organizationId: 'org-1', branchId: 'branch-1', userId: 'user-1',
  role: 'admin', organizationRole: 'admin',
  supabase: { from: vi.fn() },
}

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => ctx),
  isNextResponse: vi.fn(() => false),
}))

describe('GET /api/repairs/inventory/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active tenant products with branch stock, cost, price and tax', async () => {
    productsLimit.mockResolvedValue({
      data: [{
        id: 'product-1', sku: 'OLED-1', name: 'Pantalla OLED', purchase_price: 300_000,
        sale_price: 500_000, tax_rate: 10, updated_at: '2026-08-20T10:00:00Z',
      }],
      error: null,
    })
    inventoryIn.mockResolvedValue({
      data: [{ product_id: 'product-1', stock_quantity: 4, updated_at: '2026-08-20T11:00:00Z' }],
      error: null,
    })
    const productBuilder = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: productsLimit,
    }
    const inventoryBuilder = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: inventoryIn,
    }
    ctx.supabase.from.mockImplementation((table: string) => (
      table === 'products' ? productBuilder : inventoryBuilder
    ))

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/repairs/inventory/search?q=pantalla'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toEqual([expect.objectContaining({
      productId: 'product-1', availableStock: 4, unitCost: 300_000,
      unitPrice: 500_000, taxRate: 10,
    })])
    expect(productBuilder.eq).toHaveBeenCalledWith('organization_id', 'org-1')
    expect(inventoryBuilder.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
  })

  it('requires at least two search characters', async () => {
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/repairs/inventory/search?q=p'))

    expect(response.status).toBe(400)
    expect(ctx.supabase.from).not.toHaveBeenCalled()
  })

  it('uses the server-verified wholesale price for a wholesale repair customer', async () => {
    repairMaybeSingle.mockResolvedValue({ data: { id: 'repair-1', customer: { customer_type: 'wholesale' } }, error: null })
    productsLimit.mockResolvedValue({ data: [{ id: 'product-1', sku: 'BAT-1', name: 'Batería', purchase_price: 100_000, sale_price: 180_000, wholesale_price: 150_000, tax_rate: 10, updated_at: 'v1' }], error: null })
    inventoryIn.mockResolvedValue({ data: [{ product_id: 'product-1', stock_quantity: 3, updated_at: 'v2' }], error: null })
    const repairBuilder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: repairMaybeSingle }
    const productBuilder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: productsLimit }
    const inventoryBuilder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: inventoryIn }
    ctx.supabase.from.mockImplementation((table: string) => table === 'repairs' ? repairBuilder : table === 'products' ? productBuilder : inventoryBuilder)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/repairs/inventory/search?q=bateria&repairId=repair-1'))
    const body = await response.json()

    expect(body.customerIsWholesale).toBe(true)
    expect(body.items[0]).toEqual(expect.objectContaining({ unitPrice: 150_000, retailPrice: 180_000, wholesalePriceApplied: true }))
  })
})
