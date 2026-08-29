import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260829000001_add_organization_business_profile.sql'),
  'utf8',
).toLowerCase()

describe('organization business profile migration', () => {
  it('adds the canonical profile columns without changing existing plan data', () => {
    expect(sql).toContain('add column if not exists business_vertical')
    expect(sql).toContain('add column if not exists operating_model')
    expect(sql).toContain('add column if not exists enabled_modules')
    expect(sql).not.toContain('update public.plans')
  })

  it('uses null enabled modules as the backwards-compatible state', () => {
    expect(sql).toMatch(/enabled_modules\s+text\[\]/)
    expect(sql).not.toMatch(/enabled_modules\s+text\[\][^;]*default/)
  })

  it('constrains every persisted enum-like value', () => {
    expect(sql).toContain('organizations_business_vertical_check')
    expect(sql).toContain('organizations_operating_model_check')
    expect(sql).toContain('organizations_enabled_modules_check')
    expect(sql).toContain("business_vertical = any")
    expect(sql).toContain("operating_model = any")
  })

  it('backfills legacy repair organizations without disabling existing modules', () => {
    expect(sql).toContain("company_info'->>'businesstype")
    expect(sql).toContain("then 'repair'")
    expect(sql).toContain("then 'electronics'")
    expect(sql).toContain('enabled_modules is null')
  })
})
