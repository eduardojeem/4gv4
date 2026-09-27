import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/admin/users/route.ts'), 'utf8')

describe('admin users tenant isolation contract', () => {
  it('builds the private user population from organization memberships', () => {
    expect(route).toContain(".from('organization_members')")
    expect(route).toContain(".eq('organization_id', context.organizationId)")
    expect(route).toContain('assertUserInOrganization')
  })

  it('scopes wholesale permissions to the active organization', () => {
    expect(route).toContain("query = query.eq('organization_id', organizationId)")
  })
})
