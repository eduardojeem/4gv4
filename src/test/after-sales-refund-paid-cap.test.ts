import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { afterSalesMutationError } from '@/lib/after-sales/resolution'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115230000_after_sales_refund_paid_cap.sql'), 'utf8')

describe('reintegros de reparaciones limitados a lo pagado', () => {
  it('las dos funciones de posventa controlan lo efectivamente pagado', () => {
    const create = sql.slice(sql.indexOf('server_create_after_sales_case_atomic('))
    const resolveFn = sql.slice(sql.indexOf('server_resolve_after_sales_case_atomic('), sql.indexOf('server_create_after_sales_case_atomic('))
    expect(create).toContain("refund>greatest(0,coalesce(parent.paid_amount,0)) then raise exception 'AFTER_SALES_REFUND_EXCEEDS_PAID'")
    expect(resolveFn).toContain("refund+prior_refunds>greatest(0,coalesce(parent.paid_amount,0)) then raise exception 'AFTER_SALES_REFUND_EXCEEDS_PAID'")
    // Sigue valiendo el tope por precio final y los permisos no se abren.
    expect(sql.match(/AFTER_SALES_REFUND_EXCEEDS_CAP/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql).toContain('from public,anon,authenticated;')
    expect(sql).not.toMatch(/grant execute[^;]*to (anon|authenticated)/i)
  })

  it('explica el rechazo en palabras simples', async () => {
    const response = afterSalesMutationError({ code: 'P0001', message: 'AFTER_SALES_REFUND_EXCEEDS_PAID' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/no puede superar lo que el cliente pagó/)
  })
})
