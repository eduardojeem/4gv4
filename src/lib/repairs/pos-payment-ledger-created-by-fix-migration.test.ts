import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_fix_pos_repair_payments_statement_created_by.sql'))

const sql = migrationName
  ? readFileSync(resolve(process.cwd(), 'supabase/migrations', migrationName), 'utf8')
  : ''

describe('POS repair payment statement trigger fix', () => {
  it('no longer reads the missing repairs.created_by column', () => {
    expect(migrationName).toBeTruthy()
    expect(sql).toContain('create or replace function public.capture_pos_repair_payments_statement()')
    expect(sql).not.toContain('new_rows.created_by')
    expect(sql).not.toContain('changed.created_by')
  })

  it('keeps attributing the payment to the sale author and stays private', () => {
    expect(sql).toContain('sale.created_by as sale_created_by')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('grant execute on function public.capture_pos_repair_payments_statement() to service_role')
  })
})
