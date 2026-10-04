import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004143951_catalog_admin_queries.sql'), 'utf8')

describe('consultas administrativas de catálogo', () => {
  it('agrega usos sin topes y pagina después de filtrar', () => {
    expect(sql).toMatch(/get_global_products_admin/i)
    expect(sql).toMatch(/get_global_device_models_admin/i)
    expect(sql).toMatch(/count\(distinct[\s\S]+organization_id/i)
    expect(sql).toMatch(/limit p_page_size[\s\S]+offset/i)
    expect(sql).not.toMatch(/20000|5000/)
  })

  it('declara truncamiento solo para candidatos y restringe acceso', () => {
    expect(sql).toMatch(/candidatesTotal/i)
    expect(sql).toMatch(/truncated/i)
    expect(sql.match(/revoke execute/gi)?.length).toBeGreaterThanOrEqual(2)
  })
})
