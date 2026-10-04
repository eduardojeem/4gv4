import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004143658_atomic_catalog_candidate_imports.sql'), 'utf8')
const products = readFileSync(resolve(process.cwd(), 'src/app/api/superadmin/global-products/route.ts'), 'utf8')
const models = readFileSync(resolve(process.cwd(), 'src/app/api/superadmin/global-device-models/route.ts'), 'utf8')

describe('importación atómica de candidatos', () => {
  it.each(['product', 'device_model'])('implementa importación set-based de %s', (kind) => {
    expect(sql).toMatch(new RegExp(`import_global_${kind}_candidates`, 'i'))
    expect(sql).toMatch(/jsonb_to_recordset/i)
    expect(sql).toMatch(/on conflict/i)
    expect(sql).toMatch(/p_actor_user_id/i)
  })

  it('normaliza GTIN, valida referencias activas y restringe permisos', () => {
    expect(sql).toMatch(/lpad[\s\S]+13/i)
    expect(sql).toMatch(/global_brands[\s\S]+is_active/i)
    expect(sql).toMatch(/global_categories[\s\S]+is_active/i)
    expect(sql.match(/revoke execute/gi)).toHaveLength(2)
    expect(sql.match(/grant execute/gi)).toHaveLength(2)
  })

  it('las rutas ya no insertan candidatos en bucles', () => {
    expect(products).toContain("rpc('import_global_product_candidates'")
    expect(models).toContain("rpc('import_global_device_model_candidates'")
    expect(products).not.toMatch(/for \(const entry of validation\.data\.entries\)/)
    expect(models).not.toMatch(/for \(const row of rows\)/)
  })
})
