import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('admin reviews API contract & security', () => {
  it('limits direct public review reads to non-sensitive columns', () => {
    const migration = read('supabase/migrations/20260913090000_verified_organization_reviews.sql')

    expect(migration).toContain('REVOKE ALL ON public.organization_reviews FROM anon, authenticated')
    expect(migration).toContain('GRANT SELECT (')
    const publicGrant = migration.slice(migration.indexOf('GRANT SELECT ('), migration.indexOf(') ON public.organization_reviews'))
    expect(publicGrant).not.toContain('reviewer_email')
    expect(publicGrant).not.toContain('sale_id')
    expect(publicGrant).not.toContain('repair_id')
  })

  it('protects routes with withAdminAuth and scopes all queries to organization_id', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    // Protegido con autenticación de admin
    expect(route).toContain('withAdminAuth(getHandler)')
    expect(route).toContain('withAdminAuth(patchBulkHandler)')

    // Aislamiento multitenant estricto
    expect(route).toContain(".eq('organization_id', orgId)")
  })

  it('supports search, rating, status and sorting in GET query', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain("searchParams.get('status')")
    expect(route).toContain("searchParams.get('rating')")
    expect(route).toContain("searchParams.get('search')")
    expect(route).toContain("searchParams.get('sort')")
    expect(route).toContain('rating_desc')
    expect(route).toContain('rating_asc')
  })

  it('calculates consistent published and verified stats in the database', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain('satisfactionRate')
    expect(route).toContain('breakdown')
    expect(route).toContain('get_organization_review_admin_stats')
    expect(route).toContain('verifiedCount')
    expect(route).toContain('respondedCount')
  })

  it('supports auditable bulk moderation without ordinary permanent deletion', () => {
    const route = read('src/app/api/admin/reviews/route.ts')

    expect(route).toContain('bulkActionSchema')
    expect(route).toContain("'approve'")
    expect(route).toContain("'reject'")
    expect(route).toContain("'show'")
    expect(route).toContain("'hide'")
    expect(route).toContain('moderation_reason')
    expect(route).toContain('moderated_by')
    expect(route).not.toContain("action === 'delete'")
    expect(route).not.toContain("action === 'approve_all_pending'")
    expect(route).toContain(".in('id', ids)")
  })

  it('maintains single review operations in [id]/route.ts', () => {
    const singleRoute = read('src/app/api/admin/reviews/[id]/route.ts')

    expect(singleRoute).toContain('withAdminAuth')
    expect(singleRoute).toContain(".eq('organization_id', orgId)")
    expect(singleRoute).toContain(".eq('id', id)")
    expect(singleRoute).toContain('business_response')
    expect(singleRoute).toContain('moderation_status')
    expect(singleRoute).toContain('moderation_reason')
    expect(singleRoute).not.toContain('.delete()')
  })

  it('creates one-use verified invitations only from completed tenant records', () => {
    const invitations = read('src/app/api/admin/reviews/invitations/route.ts')

    expect(invitations).toContain('withAdminAuth')
    expect(invitations).toContain(".eq('organization_id', orgId)")
    expect(invitations).toContain(".eq('status', 'completed')")
    expect(invitations).toContain(".eq('status', 'entregado')")
    expect(invitations).toContain('randomBytes(32)')
    expect(invitations).toContain("createHash('sha256')")
    expect(invitations).toContain('organization_review_invites')
  })
})
