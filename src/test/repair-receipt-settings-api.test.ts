import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/repairs/receipt-settings/route.ts'), 'utf8')
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260905120000_repair_receipt_settings.sql'), 'utf8')

describe('repair receipt settings persistence', () => {
  it('scopes reads and writes to the authenticated organization', () => {
    expect(route).toContain(".eq('organization_id', context.organization.id)")
    expect(route).toContain("permission: 'repairs.orders.read'")
    expect(route).toContain("permission: 'settings.manage'")
  })

  it('stores settings centrally and records an audit event', () => {
    expect(route).toContain('repair_receipt_settings')
    expect(route).toContain("action: 'repair_receipt_settings.updated'")
    expect(migration).toContain('repair_receipt_settings jsonb')
  })
})
