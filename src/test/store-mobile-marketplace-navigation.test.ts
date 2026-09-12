import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const navSource = readFileSync(
  resolve(process.cwd(), 'src/components/public/StoreMobileBottomNav.tsx'),
  'utf8'
)
const layoutSource = readFileSync(
  resolve(process.cwd(), 'src/app/[organizationSlug]/layout.tsx'),
  'utf8'
)

describe('StoreMobileBottomNav offers access', () => {
  it('uses the highlighted mobile slot for tenant offers instead of duplicating Marketplace', () => {
    expect(navSource).toContain("href: `${tenantPrefix}/ofertas`")
    expect(navSource).toContain("label: 'Ofertas'")
    expect(navSource).toContain('icon: Tag')
    expect(navSource).toContain("ariaLabel: 'Ver ofertas de la tienda'")
    expect(navSource).toContain("pathname.startsWith(`${tenantPrefix}/ofertas`)")
    expect(navSource).not.toContain("label: 'Marketplace'")
  })

  it('only displays the offers shortcut when the public offers section is enabled', () => {
    expect(navSource).toContain('offersEnabled ? [{')
    expect(layoutSource).toContain(
      '<StoreMobileBottomNav offersEnabled={settings?.offers_section?.enabled !== false} />'
    )
  })
})
