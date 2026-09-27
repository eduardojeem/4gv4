import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927170000_harden_dashboard_profile_access.sql'),
  'utf8',
).toLowerCase()
const compactMigration = migration.replace(/\s+/g, ' ')

describe('dashboard profile security migration', () => {
  it('replaces broad profile grants with explicit column privileges', () => {
    expect(migration).toContain('revoke all on table public.profiles from anon, authenticated')
    expect(compactMigration).toContain('grant select ( username, full_name, job_title, bio, location, avatar_url, website, social_links, updated_at, is_public ) on public.profiles to anon')
    expect(migration).toContain('grant update (')

    const updateGrant = migration.slice(
      migration.indexOf('grant update ('),
      migration.indexOf(') on public.profiles to authenticated', migration.indexOf('grant update (')),
    )

    for (const column of [
      'full_name', 'avatar_url', 'phone', 'department', 'bio', 'website', 'job_title',
      'timezone', 'social_links', 'preferences', 'location', 'updated_at',
    ]) {
      expect(updateGrant).toContain(column)
    }

    for (const protectedColumn of ['role', 'permissions', 'status', 'email', 'username', 'is_public']) {
      expect(updateGrant).not.toMatch(new RegExp(`\\b${protectedColumn}\\b`))
    }
  })

  it('replaces the consolidated policies with tenant-scoped policies', () => {
    for (const policy of [
      'profiles_select_consolidated',
      'profiles_update_consolidated',
      'profiles_insert_consolidated',
      'profiles_delete_admin',
    ]) {
      expect(migration).toContain(`drop policy if exists "${policy}" on public.profiles`)
    }

    for (const policy of [
      'profiles_select_scoped',
      'profiles_update_scoped',
      'profiles_insert_self',
      'profiles_delete_scoped',
      'profiles_select_public',
    ]) {
      expect(migration).toContain(`create policy "${policy}"`)
    }

    expect(migration).toContain('caller_membership.status = \'active\'')
    expect(migration).toContain('target_membership.status = \'active\'')
    expect(migration).toContain('caller_membership.organization_id = target_membership.organization_id')
    expect(migration).toContain("profiles.role <> 'super_admin'")
    expect(migration).toContain("public.get_jwt_role() = 'super_admin'")
  })

  it('keeps anonymous reads opt-in and service role unrestricted', () => {
    expect(migration).toContain('for select to anon using (is_public = true)')
    expect(migration).toContain('grant all on table public.profiles to service_role')
    expect(migration).not.toContain('grant all on table public.profiles to anon')
    expect(migration).not.toContain('grant all on table public.profiles to authenticated')
  })
})
