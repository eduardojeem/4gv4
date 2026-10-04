import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/superadmin/global-device-models/route.ts'), 'utf8')

describe('API de modelos globales con marca relacionada', () => {
  it('acepta global_brand_id y valida una marca activa', () => {
    expect(route).toContain('global_brand_id')
    expect(route).toMatch(/global_brands[\s\S]+is_active/i)
    expect(route).toContain('La marca elegida no está activa')
  })

  it('conserva brand como fallback compatible', () => {
    expect(route).toMatch(/global_brands\s*\(\s*name\s*\)/i)
    expect(route).toMatch(/brand.*fallback|fallback.*brand/is)
  })
})
