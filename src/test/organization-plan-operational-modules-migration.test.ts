import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260829000002_sync_operational_plan_modules.sql'),
  'utf8',
).toLowerCase()

describe('operational plan modules migration', () => {
  it('assigns services to every tier and orders plus delivery from Basic', () => {
    expect(sql).toContain("when 'free' then array['inventory','pos','crm','repairs','services']")
    expect(sql).toMatch(/when 'basic' then array\[[^\]]*'services'[^\]]*'orders'[^\]]*'delivery'/)
    expect(sql).toMatch(/when 'pro' then array\[[^\]]*'services'[^\]]*'orders'[^\]]*'delivery'/)
    expect(sql).toMatch(/else array\[[^\]]*'services'[^\]]*'orders'[^\]]*'delivery'/)
  })

  it('adds editable commercial features and resynchronizes every plan', () => {
    expect(sql).toContain("'label', 'servicios'")
    expect(sql).toContain("'label', 'pedidos'")
    expect(sql).toContain("'label', 'entregas'")
    expect(sql).toContain('sync_technical_plan_from_subscription_plan(plan_row.tier)')
  })
})
