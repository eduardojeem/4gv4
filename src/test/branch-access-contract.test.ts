import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('user branch access contract', () => {
  it('lists only branches the active organization membership can access', () => {
    const route = read('src/app/api/branches/route.ts')

    expect(route).toContain('listAccessibleBranchesForUser')
    expect(route).not.toContain(".from('branches')")
  })

  it('does not grant a default branch to unassigned operational staff', () => {
    const server = read('src/lib/branches/server.ts')

    expect(server).toContain('listAccessibleBranchesForUser')
    expect(server).toContain("membership.role === 'owner' || membership.role === 'admin'")
    expect(server).not.toContain("source: 'default' }\n  }\n\n  return { branchId: null")
  })

  it('validates repair reads through the shared branch resolver', () => {
    const route = read('src/app/api/repairs/route.ts')

    expect(route).toContain("resolveRepairRouteContext(request, 'repairs.orders.read')")
    expect(route).not.toContain("request.headers.get('x-branch-id')")
  })

  it('validates cash-register creation against user branch access', () => {
    const route = read('src/app/api/pos/cash-registers/route.ts')

    expect(route).toContain('resolveBranchScopeForUser')
    expect(route).toContain('strict: true')
  })

  it('requires an active organization membership before assigning branches', () => {
    const route = read('src/app/api/admin/users/[id]/branches/route.ts')

    expect(route).toContain(".eq('status', 'active')")
    expect(route).toContain('PRIMARY_BRANCH_ASSIGNMENT_REQUIRED')
  })

  it('scopes branch user details through the verified branch organization', () => {
    const route = read('src/app/api/admin/branches/[id]/route.ts')

    expect(route).toContain('loadBranchDetail')
    expect(route).toContain(".from('user_branch_assignments')")
    expect(route).toContain(".from('organization_members')")
    expect(route).toContain(".eq('organization_id', branch.organization_id)")
    expect(route).toContain('export function GET')
  })

  it('initializes new branch inventory through a tenant-scoped server contract', () => {
    const route = read('src/app/api/admin/branches/route.ts')

    expect(route).toContain('parseBranchInventoryInitialization')
    expect(route).toContain('initializeBranchInventory')
    expect(route).toContain(".eq('organization_id', organizationId)")
    expect(route).toContain(".from('branch_inventory')")
  })

  it('normalizes defaults and backfills operational staff without assignments', () => {
    const migration = read('supabase/migrations/20260801164000_normalize_user_branch_access.sql')

    expect(migration).toContain('organizations_without_default')
    expect(migration).toContain("membership.role in ('manager', 'cashier', 'technician', 'seller')")
    expect(migration).toContain('not exists (')
    expect(migration).not.toContain('return coalesce')
  })
})
