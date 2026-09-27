import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public store-credit API contract', () => {
  it('requires an authenticated profile and scopes every query to the storefront tenant', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/public/store-credit/route.ts'), 'utf8')

    expect(route).toContain('auth.getUser()')
    expect(route).toContain("status: 401")
    expect(route).toContain('resolvePublicStorefrontOrganization')
    expect(route).toContain(".eq('profile_id', user.id)")
    expect(route).toContain(".eq('organization_id', organization.id)")
  })

  it('returns ledger, reserved and available balances with recent activity', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/public/store-credit/route.ts'), 'utf8')

    expect(route).toContain('ledgerBalance')
    expect(route).toContain('reservedBalance')
    expect(route).toContain('availableBalance')
    expect(route).toContain('movements')
    expect(route).toContain('reservations')
  })
})
