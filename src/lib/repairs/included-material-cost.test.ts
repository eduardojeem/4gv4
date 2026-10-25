import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))
import { resolveIncludedMaterialCosts } from './included-material-cost'

function client(rows: Array<{ id: string; purchase_price: number | null }>) {
  const calls: Array<[string, unknown]> = []
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => { calls.push([column, value]); return builder }),
    in: vi.fn(async (column: string, value: unknown) => { calls.push([column, value]); return { data: rows, error: null } }),
  }
  return { from: vi.fn(() => builder), calls }
}

// S2: el costo del material incluido sale del servicio de origen, no del cliente.
describe('resolveIncludedMaterialCosts', () => {
  const parts = [
    { lineType: 'service' as const, unitCost: 0, productId: 'service-1' },
    { lineType: 'included_material' as const, unitCost: 0, sourceProductId: 'service-1' },
    { lineType: 'included_material' as const, unitCost: 5_000, sourceProductId: null },
    { lineType: 'charged_part' as const, unitCost: 1 },
  ]

  it('uses the purchase price of the source service, scoped to the organization', async () => {
    const db = client([{ id: 'service-1', purchase_price: 100_000 }])
    const resolved = await resolveIncludedMaterialCosts(parts, 'org-1', db as never)
    expect(resolved?.[1].unitCost).toBe(100_000)
    expect(db.calls).toContainEqual(['organization_id', 'org-1'])
    // Sin servicio de origen (líneas ya guardadas o manuales) no se toca nada.
    expect(resolved?.[2].unitCost).toBe(5_000)
    expect(resolved?.[3].unitCost).toBe(1)
  })

  it('ignores a cost invented by a client without cost permission', async () => {
    const db = client([{ id: 'service-1', purchase_price: 100_000 }])
    const forged = [{ lineType: 'included_material' as const, unitCost: 1, sourceProductId: 'service-1' }]
    expect((await resolveIncludedMaterialCosts(forged, 'org-1', db as never))?.[0].unitCost).toBe(100_000)
  })

  it('rejects a source service that belongs to another organization', async () => {
    const db = client([])
    expect(await resolveIncludedMaterialCosts(parts, 'org-1', db as never)).toBeNull()
  })

  it('does not query the database when no line has a source service', async () => {
    const db = client([])
    const plain = [{ lineType: 'charged_part' as const, unitCost: 1 }]
    expect(await resolveIncludedMaterialCosts(plain, 'org-1', db as never)).toBe(plain)
    expect(db.from).not.toHaveBeenCalled()
  })
})
