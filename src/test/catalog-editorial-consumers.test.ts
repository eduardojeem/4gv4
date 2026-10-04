import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('consumidores del catálogo editorial', () => {
  it.each([
    'src/app/api/products/barcode-lookup/route.ts',
    'src/app/api/products/device-options/route.ts',
  ])('%s usa únicamente filas publicadas', (path) => {
    expect(read(path)).toContain(".eq('catalog_status', 'published')")
  })
})
