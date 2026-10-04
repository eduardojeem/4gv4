import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004143347_link_device_models_to_global_brands.sql'), 'utf8')

describe('relación de modelos con marcas globales', () => {
  it('agrega la FK restrictiva sin volverla obligatoria durante expand', () => {
    expect(sql).toMatch(/add column if not exists global_brand_id uuid/i)
    expect(sql).toMatch(/references public\.global_brands\s*\(id\)\s*on delete restrict/i)
    expect(sql).not.toMatch(/global_brand_id\s+uuid\s+not null/i)
  })

  it('solo rellena coincidencias inequívocas por nombre o alias', () => {
    expect(sql).toMatch(/count\(distinct[\s\S]+having count\(distinct/i)
    expect(sql).toMatch(/global_brand_id is null/i)
    expect(sql).toMatch(/unique[\s\S]+global_brand_id[\s\S]+lower\(model\)/i)
  })
})
