import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/public/StoreMobileBottomNav.tsx'),
  'utf8'
)

describe('StoreMobileBottomNav Marketplace access', () => {
  it('keeps Marketplace directly visible in the five-item mobile navigation', () => {
    expect(source).toContain("href: '/marketplace'")
    expect(source).toContain("label: 'Marketplace'")
    expect(source).toContain('icon: Store')
    expect(source).toContain('emphasized: true')
    expect(source).toContain("aria-label={tab.emphasized ? 'Volver al Marketplace' : undefined}")
    expect(source).not.toContain("label: 'Ofertas'")
  })
})
