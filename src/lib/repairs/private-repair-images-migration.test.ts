import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260928012000_make_repair_images_private.sql',
)

function migration() {
  return readFileSync(migrationPath, 'utf8')
}

describe('private repair images migration', () => {
  it('aborts on an unrecognized stored value before changing rows or bucket privacy', () => {
    const sql = migration()
    const preflight = sql.indexOf('RAISE EXCEPTION')
    const conversion = sql.indexOf('UPDATE public.repair_images')
    const privacyCutover = sql.indexOf("public = false")

    expect(preflight).toBeGreaterThan(-1)
    expect(preflight).toBeLessThan(conversion)
    expect(preflight).toBeLessThan(privacyCutover)
    expect(sql).toContain('pg_temp.repair_image_path')
  })

  it('decodes historical public URLs into exact internal paths', () => {
    const sql = migration()

    expect(sql).toContain('/storage/v1/object/public/repair-images/')
    expect(sql).toContain('pg_temp.url_decode')
    expect(sql).toMatch(/UPDATE public\.repair_images[\s\S]+SET image_url = pg_temp\.repair_image_path\(image_url\)/)
  })

  it('makes the bucket private and removes every repair-images Storage policy', () => {
    const sql = migration()

    expect(sql).toContain("VALUES ('repair-images', 'repair-images', false)")
    expect(sql).toContain('FROM pg_policies')
    expect(sql).toContain("schemaname = 'storage'")
    expect(sql).toContain("tablename = 'objects'")
    expect(sql).toContain("ILIKE '%repair-images%'")
    expect(sql).toContain('DROP POLICY')
  })

  it.each(['select', 'insert', 'update', 'delete']) (
    'scopes the repair_images %s policy through the parent repair organization',
    (operation) => {
      const sql = migration().toLowerCase()
      const start = sql.indexOf(`create policy "repair_images_tenant_${operation}"`)
      const next = sql.indexOf('create policy', start + 1)
      const policy = sql.slice(start, next === -1 ? undefined : next)

      expect(start).toBeGreaterThan(-1)
      expect(policy).toContain('from public.repairs')
      expect(policy).toContain('r.id = repair_images.repair_id')
      expect(policy).toContain('organization_members')
      expect(policy).toContain('membership.organization_id = r.organization_id')
      expect(policy).toContain('membership.user_id = auth.uid()')
    },
  )
})
