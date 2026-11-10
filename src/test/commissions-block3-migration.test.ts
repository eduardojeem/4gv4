import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Probado contra una copia de la base local: venta de producto + reparación
 * (el vendedor comisiona solo el producto), garantía sin cargo (sin fija),
 * reparación entregada con saldo y cobrada 40 días después (se comisiona al
 * cobrarse) y turno cobrado por la cajera (comisiona el barbero).
 */
const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111120000_commissions_block3.sql'), 'utf8').replace(/\r\n/g, '\n')

describe('migración de comisiones (bloque 3)', () => {
  it('la base del vendedor descuenta reparaciones y servicios de otro profesional', () => {
    expect(sql).toContain('select sum(repair_payment.amount) from public.repair_payments repair_payment')
    expect(sql).toContain('and professional.employee_id <> attribution.employee_id')
  })

  it('el servicio de un turno lo comisiona el profesional vinculado', () => {
    expect(sql).toContain('add column if not exists user_id uuid references auth.users(id) on delete set null')
    expect(sql).toContain('create trigger appointments_capture_commission_professional')
    expect(sql.match(/coalesce\(professional\.employee_id, attribution\.employee_id\)/g)).toHaveLength(2)
  })

  it('una reparación cobrada después se comisiona al completar el pago, solo para eventos en vivo', () => {
    expect(sql).toContain("when attribution.capture_basis = 'live_event' then greatest(attribution.occurred_at, attribution.created_at)")
  })

  it('una reparación sin cargo no paga comisión fija', () => {
    expect(sql).toContain("and ranked.calculation_type = 'fixed'\n      and ranked.basis_amount <= 0")
  })

  it('conserva permisos y el resto del cálculo', () => {
    expect(sql).toContain('grant execute on function public.calculate_earned_commissions(uuid,date,date,uuid) to authenticated,service_role;')
    expect(sql).toContain("'terminal-status:'")
    expect(sql).toContain("'after-sales:'")
  })
})
