import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260928004000_reapply_global_content_policies.sql',
)

describe('global policy repair migration', () => {
  it('reapplies every policy that can mutate platform-wide content', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    for (const table of [
      'global_categories',
      'variant_attributes',
      'variant_attribute_options',
      'posts',
      'system_settings_audit',
    ]) {
      expect(sql).toContain(`on public.${table}`)
    }
    expect(sql).toContain("public.get_jwt_role() = 'super_admin'")
  })

  it('removes legacy organization-admin policies before recreating safe policies', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

    expect(sql).toContain('drop policy if exists "solo admins pueden insertar en audit log"')
    expect(sql).toContain('drop policy if exists "global_categories_superadmin_update"')
    expect(sql).not.toMatch(/profiles\.role\s*=\s*'admin'/)
  })
})
