import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync('src/app/api/pos/process-sale/route.ts', 'utf8')
const sql = readFileSync('supabase/migrations/20261104120000_pos_credit_custom_installments.sql', 'utf8')

describe('contrato de cuotas por monto en la venta POS', () => {
  it('la ruta usa la v6 y solo vuelve a la v5 cuando la venta no necesita la v6', () => {
    expect(route).toContain("supabase.rpc('process_pos_sale_atomic_v6', atomicSaleArgs)")
    expect(route).toContain("rpc('process_pos_sale_atomic_v5', atomicSaleArgs)")
    expect(route).toContain('credit?.installment_amounts || credit?.policy_override')
    // El recargo se deriva en el servidor, nunca se toma el que manda el cliente.
    expect(route).toContain('credit.interest_rate = impliedInterestRate(')
    // La política se verifica antes de procesar la venta.
    expect(route.indexOf('checkCreditPosPolicy({')).toBeLessThan(route.indexOf("rpc('process_pos_sale_atomic_v6'"))
  })

  it('la migración es atómica, server-only y valida los montos', () => {
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
    expect(sql).toContain('security definer')
    expect(sql).toMatch(/revoke all on function public\.process_pos_sale_atomic_v6\([^)]*\) from public, anon, authenticated;/)
    expect(sql).toMatch(/grant execute on function public\.process_pos_sale_atomic_v6\([^)]*\) to service_role;/)
    expect(sql).toContain("raise exception 'CREDIT_SCHEDULE_BELOW_PRINCIPAL")
    expect(sql).toContain("raise exception 'CREDIT_SCHEDULE_RATE_TOO_HIGH")
    expect(sql).toContain("raise exception 'CREDIT_LIMIT_EXCEEDED")
    expect(sql).toContain('installment_amount <> round(installment_amount, digits)')
    // El cobro de la primera cuota se hace después de fijar los montos.
    expect(sql.indexOf("base_credit := (p_credit - 'installment_amounts' - 'first_payment')"))
      .toBeLessThan(sql.indexOf('perform public.collect_pos_first_installment('))
    // No toca migraciones ni filas históricas fuera del crédito recién creado.
    expect(sql).not.toMatch(/delete\s+from\s+public\.credit_installments/i)
    expect(sql).toContain('where credit_id = created_credit_id and installment_number = entry.ordinality')
  })
})
