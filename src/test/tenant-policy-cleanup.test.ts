import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260929223000_remove_cross_tenant_legacy_policies.sql',
)

describe('limpieza de políticas RLS heredadas', () => {
  it('elimina sólo las políticas permissive globales reemplazadas por políticas tenant-aware', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('drop policy if exists "products_delete_policy" on public.products;')
    expect(sql).toContain('drop policy if exists "products_insert_policy" on public.products;')
    expect(sql).toContain('drop policy if exists "products_update_policy" on public.products;')
    expect(sql).toContain('drop policy if exists "Admins can manage website settings" on public.website_settings;')

    expect(sql).not.toContain('drop policy if exists "miembros del tenant pueden')
    expect(sql).not.toContain('drop policy if exists "tenant admins can')
    expect(sql).not.toContain('drop policy if exists "website_settings_publication_gate"')
    expect(sql).not.toMatch(/disable\s+row\s+level\s+security/i)
  })
})
