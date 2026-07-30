import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const migration = readFileSync(
  resolve(
    workspace,
    'supabase/migrations/20260728220234_reconcile_security_advisor_warnings.sql'
  ),
  'utf8'
)
const publicReviewsRoute = readFileSync(
  resolve(workspace, 'src/app/api/public/reviews/route.ts'),
  'utf8'
)

describe('Security Advisor hardening contracts', () => {
  it.each([
    'public.downgrade_overdue_accounts()',
    'public.expire_stale_orders()',
    'public.perform_maintenance_task(text)',
    'public.record_database_growth_snapshot()',
  ])('keeps %s on the server-only allowlist', (functionSignature) => {
    expect(migration).toContain(`'${functionSignature}'`)
  })

  it('removes anonymous execution and pins mutable search paths', () => {
    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon'
    )
    expect(migration).toContain(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public'
    )
  })

  it('replaces unrestricted audit inserts with actor and tenant checks', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can insert audit logs"'
    )
    expect(migration).toContain('user_id = (SELECT auth.uid())')
    expect(migration).toContain(
      'membership.organization_id = audit_log.organization_id'
    )
    expect(migration).not.toMatch(
      /CREATE POLICY "Authenticated users can insert own audit logs"[\s\S]*?WITH CHECK \(true\)/
    )
  })

  it('accepts public reviews only through server-side moderation', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Anyone can submit a review"'
    )
    expect(publicReviewsRoute).toContain('is_approved: false')
    expect(publicReviewsRoute).not.toContain('is_approved: true')
  })

  it('removes broad avatar listing and scopes object operations', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Public Access Avatars"'
    )
    expect(migration).toContain(
      "(storage.foldername(name))[1] = (SELECT auth.uid())::TEXT"
    )
    expect(migration).toContain(
      "ARRAY['object.get_authenticated_info', 'object.get_authenticated']"
    )
    expect(migration).toContain("actor.role IN ('owner', 'admin')")
    expect(migration).not.toContain(
      'CREATE POLICY "Public Access Avatars"'
    )
  })
})
