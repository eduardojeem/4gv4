import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'

const routeSource = readFileSync(resolve(process.cwd(), 'src/app/api/repairs/route.ts'), 'utf8')

vi.mock('@/lib/auth/require-auth', () => ({
  requireStaff: vi.fn(async () => ({
    authenticated: true,
    user: { id: 'test-user' },
    role: 'admin',
  })),
  getAuthResponse: vi.fn(() => null),
}))

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: vi.fn(async () => null),
}))

describe('GET /api/repairs', () => {
  it('returns a structured error when active organization is missing', async () => {
    const { GET } = await import('./route')
    const res = await GET({ headers: new Headers() } as Request)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('ACTIVE_ORGANIZATION_REQUIRED')
  })

  it('keeps POS search scoped and resolves matching customers server-side', () => {
    expect(routeSource).toContain("searchParams.get('chargeable') === 'true'")
    expect(routeSource).toContain(".from('customers')")
    expect(routeSource).toContain(".eq('organization_id', ctx.organizationId)")
    expect(routeSource).toContain(".eq('branch_id', ctx.branchId)")
    expect(routeSource).toContain('ticket_number.ilike.')
    expect(routeSource).toContain('customer_id.in.')
    expect(routeSource).toContain(".not('status', 'in',")
  })
})
