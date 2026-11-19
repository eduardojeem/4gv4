import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const migration = read('supabase/migrations/20261118120000_pos_variant_own_prices.sql')

describe('migración: el POS cobra el precio de cada variante', () => {
  it('incluye sin cambios el bloque de v2 de la etapa pos-sale-integrity/01 (idempotente en producción)', () => {
    const stage = read('supabase/pending-migrations/pos-sale-integrity/01_pos_variant_lines_and_product_tax.sql')
    const start = stage.indexOf('-- Reemplaza un bloque de una definición de función')
    const end = stage.indexOf('end $migration$;') + 'end $migration$;'.length
    expect(start).toBeGreaterThan(0)
    expect(migration).toContain(stage.slice(start, end))
    expect(migration).toContain("ya tiene IVA por producto: no se modifica")
  })

  it('v5 ya no exige que la variante cueste lo mismo que el producto', () => {
    const v5 = migration.slice(migration.indexOf('create or replace function public.process_pos_sale_atomic_v5'))
    expect(v5).not.toContain("raise exception 'VARIANT_PRICE_REQUIRES_SYNC'")
    expect(v5).toContain("raise exception 'VARIANT_NOT_IN_POS_SCOPE'")
    expect(v5).toContain("raise exception 'POS_VARIANT_MIXED_WITH_PARENT'")
    expect(v5).toContain('adjust_variant_stock_atomic')
  })

  it('v2 usa la misma regla en total, IVA y líneas, y aborta si su código cambió', () => {
    for (const tag of ['variant_total', 'variant_tax', 'variant_lines']) {
      expect(migration).toContain(`'POS_V2_CONTRACT_CHANGED|${tag}'`)
    }
    expect(migration).toContain("ya cobra el precio de cada variante: no se modifica")
  })

  it('las funciones de precio solo las ejecuta el servidor', () => {
    expect(migration).toContain('revoke all on function public.pos_line_unit_price(uuid, uuid, uuid, text) from public, anon, authenticated;')
    expect(migration).toContain('revoke all on function public.pos_product_line_base(uuid, jsonb, uuid, text) from public, anon, authenticated;')
    expect(migration).toMatch(/revoke all on function public\.process_pos_sale_atomic_v5\([^)]*\) from public, anon, authenticated;/)
  })

  it('la regla de la web apunta a la misma migración', () => {
    expect(read('src/lib/products/variant-pricing.ts')).toContain('20261118120000_pos_variant_own_prices.sql')
  })
})
