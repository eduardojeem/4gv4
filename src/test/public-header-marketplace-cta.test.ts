import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/public/PublicHeader.tsx'),
  'utf8'
)

describe('PublicHeader Marketplace CTA', () => {
  it('shows a prominent Marketplace return action below the mobile header row', () => {
    expect(source).toContain('lg:hidden')
    expect(source).toContain('Volver al Marketplace')
    expect(source).toContain('Explorar más tiendas')
    expect(source).toContain('href="/marketplace"')
    expect(source).toContain('bg-primary text-primary-foreground')
  })
})
