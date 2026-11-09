import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONAL_CURRENCY_CODES } from '@/lib/regional/contract'

/**
 * Test estático de supabase/migrations/20261109140000_system_settings_fixes.sql:
 * CHECK de moneda con todas las monedas regionales, email vacío permitido y
 * triggers que no pisan el autor con null cuando guarda service_role.
 */
const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261109140000_system_settings_fixes.sql'), 'utf8')
const lower = sql.toLowerCase()

describe('migración 20261109140000_system_settings_fixes', () => {
  it('reemplaza el CHECK de moneda de forma idempotente con todas las monedas de REGIONAL_CURRENCY_CODES', () => {
    expect(lower).toContain('drop constraint if exists system_settings_currency_check')
    expect(lower).toContain('add constraint system_settings_currency_check')
    const check = sql.match(/add constraint system_settings_currency_check\s+check \(currency = any \(array\[([^\]]+)\]/i)
    expect(check).not.toBeNull()
    const codes = check![1].split(',').map((code) => code.trim().replace(/'/g, ''))
    expect([...codes].sort()).toEqual([...REGIONAL_CURRENCY_CODES].sort())
  })

  it('permite email vacío o nulo y sigue validando el formato cuando hay texto', () => {
    expect(lower).toContain('drop constraint if exists system_settings_company_email_check')
    const check = lower.slice(lower.indexOf('add constraint system_settings_company_email_check'))
    expect(check).toContain('company_email is null')
    expect(check).toContain("company_email = ''")
    expect(check).toContain('company_email ~*')
  })

  it('update_system_settings_timestamp conserva el updated_by que manda la ruta', () => {
    const fn = lower.slice(lower.indexOf('create or replace function public.update_system_settings_timestamp'))
    expect(fn).toContain('new.updated_by := coalesce(auth.uid(), new.updated_by)')
    expect(fn.slice(0, fn.indexOf('$$;'))).not.toMatch(/new\.updated_by\s*=\s*auth\.uid\(\)/)
  })

  it('log_settings_change registra el autor aunque auth.uid() sea null', () => {
    const fn = lower.slice(lower.indexOf('create or replace function public.log_settings_change'))
    const body = fn.slice(0, fn.indexOf('$$;', fn.indexOf('$$') + 2))
    expect(body).toContain('coalesce(auth.uid(), new.updated_by)')
  })

  it('solo usa sentencias repetibles', () => {
    expect(lower).not.toMatch(/create function /)
    expect(lower).not.toMatch(/add constraint (?![a-z_]+\s+check)/)
  })
})
