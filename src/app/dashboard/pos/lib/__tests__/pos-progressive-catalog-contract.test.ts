import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('carga progresiva del catálogo POS', () => {
  it('publica la primera página y evita descargar todas en paralelo', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/hooks/usePOSProducts.ts'), 'utf8')
    expect(source).toContain('publishProducts(dbProducts)')
    expect(source).toContain('for (let page = 2; page <= pageCount; page += 1)')
    expect(source).not.toContain('Promise.all(Array.from({ length: pageCount - 1 }')
  })
})
