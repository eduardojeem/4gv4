import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { batchStatus, daysUntil, estimateBatches, needsAttention, type ProductBatch } from '@/lib/inventory/batches'
import { filterDashboardNavGroups } from '@/config/dashboard-navigation'
import { productFormProfile } from '@/lib/products/vertical-product-form'

const batch = (id: string, expires_on: string, quantity: number, over: Partial<ProductBatch> = {}): ProductBatch => ({
  id, product_id: 'p1', variant_id: null, lot_code: null, expires_on, quantity, received_on: '2026-09-01', notes: null,
  discarded_at: null, discarded_reason: null, ...over,
})

const TODAY = '2026-10-10'

describe('lotes y vencimientos', () => {
  it('lo que hay en stock son los lotes que vencen más tarde (se vende primero lo que vence antes)', () => {
    const result = estimateBatches([
      batch('viejo', '2026-10-05', 10),
      batch('medio', '2026-10-20', 10),
      batch('nuevo', '2026-12-31', 10),
    ], 15, TODAY)
    const remaining = Object.fromEntries(result.map((row) => [row.id, row.remaining]))
    expect(remaining).toEqual({ nuevo: 10, medio: 5, viejo: 0 })
    // Ordenados por vencimiento.
    expect(result.map((row) => row.id)).toEqual(['viejo', 'medio', 'nuevo'])
  })

  it('los descartados no cuentan ni avisan', () => {
    const result = estimateBatches([
      batch('tirado', '2026-12-31', 10, { discarded_at: '2026-10-01T00:00:00Z' }),
      batch('vigente', '2026-10-15', 10),
    ], 8, TODAY)
    expect(result.find((row) => row.id === 'tirado')?.remaining).toBe(0)
    expect(result.find((row) => row.id === 'vigente')?.remaining).toBe(8)
    expect(result.filter((row) => needsAttention(row, 60)).map((row) => row.id)).toEqual(['vigente'])
  })

  it('estado según los días que faltan', () => {
    expect(daysUntil('2026-10-09', TODAY)).toBe(-1)
    expect(batchStatus('2026-10-09', TODAY)).toBe('expired')
    expect(batchStatus('2026-10-10', TODAY)).toBe('week')
    expect(batchStatus('2026-11-05', TODAY)).toBe('month')
    expect(batchStatus('2027-01-01', TODAY)).toBe('ok')
  })

  it('un lote ya agotado (estimado) no avisa aunque esté vencido', () => {
    const [row] = estimateBatches([batch('a', '2026-10-01', 5)], 0, TODAY)
    expect(row.status).toBe('expired')
    expect(needsAttention(row, 60)).toBe(false)
  })

  it('alimentos y cosmética piden vencimiento al cargar; ropa no', () => {
    expect(productFormProfile('food').tracksExpiry).toBe(true)
    expect(productFormProfile('cosmetics').tracksExpiry).toBe(true)
    expect(productFormProfile('clothing').tracksExpiry).toBe(false)
  })

  it('el menú muestra Vencimientos solo en los rubros que lo usan', () => {
    const keys = (businessVertical?: string) => filterDashboardNavGroups({
      role: 'admin',
      effectiveModules: ['inventory'],
      hasPermission: () => true,
      businessVertical,
    }).flatMap((group) => group.items.map((item) => item.key))
    expect(keys('food')).toContain('expirations')
    expect(keys('electronics')).not.toContain('expirations')
    // Sin rubro conocido todavía, no se esconde nada.
    expect(keys(undefined)).toContain('expirations')
  })

  it('la migración protege la tabla', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261014120000_product_batches.sql'), 'utf8')
    expect(sql).toContain('alter table public.product_batches enable row level security')
    expect(sql).toMatch(/product_batches_insert[\s\S]*p\.organization_id = product_batches\.organization_id/)
  })
})
