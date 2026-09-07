import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('repair loyalty permission migration', () => {
  const migration = readFileSync(join(
    process.cwd(), 'supabase', 'migrations',
    '20260905215553_allow_repair_loyalty_awards.sql',
  ), 'utf8')

  it('permite acreditar desde POS o desde el cierre autorizado de reparaciones', () => {
    expect(migration).toContain("has_org_permission(p_organization_id, ''pos.sales.create'')")
    expect(migration).toContain("has_org_permission(p_organization_id, ''repairs.orders.update'')")
    expect(migration).toContain('pg_get_functiondef')
  })

  it('falla de forma segura si la función instalada no coincide', () => {
    expect(migration).toContain('Expected loyalty permission condition was not found')
  })
})
