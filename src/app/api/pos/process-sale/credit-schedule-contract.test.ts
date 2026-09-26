import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato de calendario POS', () => {
  const route = readFileSync('src/app/api/pos/process-sale/route.ts', 'utf8')
  const sql = readFileSync('supabase/migrations/20260902010235_credit_first_installment_timing.sql', 'utf8')
  it('verifica la migracion antes de invocar la venta atomica y no ignora modalidades invalidas', () => {
    expect(route.indexOf("rpc('credit_schedule_due_date'")).toBeLessThan(route.indexOf("rpc('process_pos_sale_atomic_v4'"))
    expect(route).toContain("timing !== 'at_start' && timing !== 'next_cycle'")
    expect(route).toContain('creditSchedule: result.credit_schedule')
  })
  it('no modifica filas historicas y persiste modalidad y calendario', () => {
    expect(sql).toContain("'first_installment_timing'")
    expect(sql).toContain("'credit_schedule'")
    expect(sql).not.toMatch(/update\s+public\.credit_installments/i)
    expect(sql).toContain('installment_index - 1')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })
})
