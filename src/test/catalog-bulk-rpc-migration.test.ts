import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004142816_atomic_catalog_links.sql'), 'utf8')

describe('RPC atómicas de vínculos de catálogo', () => {
  it.each(['category', 'brand'])('implementa vínculos de %s de forma set-based', (kind) => {
    expect(sql).toMatch(new RegExp(`apply_global_${kind}_links`, 'i'))
    expect(sql).toMatch(/jsonb_to_recordset/i)
    expect(sql).toMatch(/expected_name/i)
    expect(sql).toMatch(/jsonb_build_object[\s\S]+requested[\s\S]+failed/i)
  })

  it('restringe ambas funciones al backend', () => {
    expect(sql.match(/security definer/gi)).toHaveLength(2)
    expect(sql.match(/set search_path = ''/gi)).toHaveLength(2)
    expect(sql.match(/revoke execute on function public\.apply_global_(?:category|brand)_links\(jsonb, uuid\) from public, anon, authenticated/gi)).toHaveLength(2)
    expect(sql.match(/grant execute on function public\.apply_global_(?:category|brand)_links\(jsonb, uuid\) to service_role/gi)).toHaveLength(2)
  })
})
