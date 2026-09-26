import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831193000_correct_delivered_repair_internal_cost.sql'),
  'utf8',
)

describe('delivered repair internal cost correction migration', () => {
  it('creates an admin-only idempotent correction RPC for delivered repairs', () => {
    expect(sql).toContain('create or replace function public.correct_delivered_repair_internal_cost')
    expect(sql).toContain("target_repair.status <> 'entregado'")
    expect(sql).toContain("membership_role is null or membership_role not in ('owner', 'admin', 'super_admin')")
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('REPAIR_COST_IDEMPOTENCY_CONFLICT')
    expect(sql).toContain('grant execute on function public.correct_delivered_repair_internal_cost')
    expect(sql).toContain('to service_role')
  })

  it('updates internal costs and appends history without changing commercial or inventory data', () => {
    expect(sql).toContain('update public.repair_parts')
    expect(sql).toContain('set unit_cost = corrected_unit_cost')
    expect(sql).toContain('insert into public.repair_cost_revisions')
    expect(sql).toContain('insert into public.repair_cost_revision_parts')
    expect(sql).toContain('partsInternalCost')
    expect(sql).not.toContain('update public.branch_inventory')
    expect(sql).not.toContain('insert into public.product_movements')
    expect(sql).not.toContain('insert into public.repair_payments')
  })

  it('corrects a delivered final price without inventing refunds or changing inventory', () => {
    expect(sql).toContain('create or replace function public.correct_delivered_repair_final_price')
    expect(sql).toContain("raise exception 'REPAIR_FINAL_PRICE_BELOW_PAID|%' ")
    expect(sql).toContain('final_cost = normalized_final_total')
    expect(sql).toContain('payment_status = new_payment_status')
    expect(sql).toContain("'commercialPriceCorrection', true")
  })
})
