import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La migración se probó contra una copia de la base local (venta con
 * reparación y saldo a favor anulada, gasto desde caja, seña devuelta y
 * retenida, transferencia sin caja). Estos tests cuidan que no se pierdan
 * las piezas que hacen falta para esos casos.
 */
const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261110120000_cash_finance_block2.sql'), 'utf8').replace(/
/g, '
')

describe('migración del bloque 2 de caja y Finanzas', () => {
  it('la anulación devuelve reparaciones, saldo a favor, puntos y turno', () => {
    expect(sql).toContain('create or replace function public.void_pos_sale(')
    expect(sql).toContain('update public.repair_payments\n    set voided_at = now()')
    expect(sql).toContain("'sale_void', p_sale_id, p_actor_id")
    expect(sql).toContain("'void-sale:' || p_sale_id::text")
    expect(sql).toContain('set sale_id = null, pos_idempotency_key = null, pos_request_hash = null')
    // Un servicio no suma stock al anular.
    expect(sql).toContain("lower(coalesce(product.unit_measure, '')) <> 'servicio'")
  })

  it('el gasto desde caja crea el gasto y lo paga con la sesión, solo desde el servidor', () => {
    expect(sql).toContain('create or replace function public.server_record_cash_expense_atomic(')
    expect(sql).toContain('perform public.assert_service_cash_actor(p_actor_user_id);')
    expect(sql).toMatch(/grant execute on function public\.server_record_cash_expense_atomic\([^)]*\) to service_role;/)
    expect(sql).toMatch(/revoke all on function public\.server_record_cash_expense_atomic\([^)]*\) from public, anon, authenticated;/)
  })

  it('el pago de gastos y sueldos en efectivo arma el tipo del movimiento como enum', () => {
    expect(sql).toContain("then 'cash_out' else 'cash_in' end)::public.cash_movement_type")
    expect(sql).toContain("'new.type::text = case'")
  })

  it('la seña de una cancelada se resuelve una vez y solo desde el servidor', () => {
    expect(sql).toContain("check (outcome = any (array['withdrawn'::text, 'unrepairable'::text, 'cancelled'::text]))")
    expect(sql).toContain("raise exception 'REPAIR_DEPOSIT_ALREADY_SETTLED'")
    expect(sql).toMatch(/grant execute on function public\.settle_cancelled_repair_deposit\([^)]*\) to service_role;/)
  })

  it('los parches fallan si cambió el texto esperado y no se aplican dos veces', () => {
    for (const code of [
      'POS_V2_STOCK_CHECK_CONTRACT_CHANGED',
      'POS_V2_STOCK_UPDATE_CONTRACT_CHANGED',
      'REPAIR_PAYMENT_CASH_CONTRACT_CHANGED',
      'REPAIR_DEPOSIT_CASH_CONTRACT_CHANGED',
    ]) expect(sql).toContain(code)
    expect(sql).toContain("if position('pos_item_skips_stock' in source) = 0 then")
  })

  it('el precio queda fijo después de un cierre sin reparar', () => {
    expect(sql).toContain('create trigger repair_closeouts_lock_price after insert on public.repair_closeouts')
  })
})
