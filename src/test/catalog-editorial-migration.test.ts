import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004144606_catalog_editorial_workflow.sql'), 'utf8')

describe('migración editorial de catálogos', () => {
  it('expande productos y modelos con estado, fuente, confianza y revisión', () => {
    for (const table of ['global_products', 'global_device_models']) expect(sql).toContain(`alter table public.${table}`)
    for (const column of ['catalog_status', 'source_type', 'source_summary', 'confidence', 'reviewed_by', 'reviewed_at', 'deactivation_reason']) expect(sql).toContain(column)
  })

  it('migra el estado actual y mantiene compatibilidad con is_active', () => {
    expect(sql).toMatch(/when is_active then 'published'[\s\S]+else 'inactive'/i)
    expect(sql).toMatch(/references auth\.users/i)
    expect(sql).toMatch(/check \(catalog_status in \('candidate', 'review', 'published', 'inactive'\)\)/i)
    expect(sql).toMatch(/confidence[\s\S]+between 0 and 1/i)
    expect(sql).toMatch(/create trigger[\s\S]+sync_catalog_editorial_state/i)
  })
})
