import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/mobile/quotes/route.ts'), 'utf8')

describe('mobile quotes read API contract', () => {
  it('requires organization scoped read permission and only selects fields needed by the app', () => {
    expect(source).toContain("withTenantAuth({ permission: 'pos.sales.read', module: 'pos' }")
    expect(source).toContain(".eq('organization_id', organization.id)")
    expect(source).toContain("const QUOTE_READ_COLUMNS = 'id, number, customer_name, status, total, currency, valid_until, created_at'")
    expect(source).not.toContain('customer_phone')
    expect(source).not.toContain('customer_email')
  })

  it('supports pending and closed quote groups without exposing write handlers', () => {
    expect(source).toContain("query.in('status', ['draft', 'sent'])")
    expect(source).toContain("query.in('status', ['rejected', 'cancelled'])")
    expect(source).not.toContain('export const POST')
    expect(source).not.toContain('update(')
    expect(source).not.toContain('insert(')
  })
})
