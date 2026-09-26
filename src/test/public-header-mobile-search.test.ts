import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/public/PublicHeader.tsx'),
  'utf8'
)

describe('PublicHeader mobile store search', () => {
  it('offers an accessible search toggle only below the existing tablet search', () => {
    expect(source).toContain('const [mobileSearchOpen, setMobileSearchOpen] = useState(false)')
    expect(source).toContain("aria-label={mobileSearchOpen ? 'Cerrar búsqueda' : 'Buscar en la tienda'}")
    expect(source).toContain('aria-expanded={mobileSearchOpen}')
    expect(source).toContain('aria-controls="public-mobile-search"')
    expect(source).toContain('md:hidden')
  })

  it('expands a focused tenant search inside the sticky header', () => {
    const header = source.slice(source.indexOf('<header'), source.indexOf('</header>'))
    const mobileSearch = header.slice(header.indexOf('id="public-mobile-search"'))

    expect(mobileSearch.slice(0, 1200)).toContain('autoFocus')
    expect(mobileSearch.slice(0, 1200)).toContain('onSubmit={handleSearchSubmit}')
    expect(mobileSearch.slice(0, 1200)).toContain("type=\"search\"")
    expect(mobileSearch.slice(0, 1200)).toContain("aria-label=\"Buscar productos en la tienda\"")
  })

  it('closes the mobile search after submitting or navigating', () => {
    expect(source).toContain('setMobileSearchOpen(false)')
    expect(source).toContain('}, [pathname])')
  })

  it('does not duplicate the search field inside the drawer', () => {
    const drawer = source.slice(source.indexOf('id="public-mobile-menu"'))
    expect(drawer).not.toContain('placeholder="Buscar productos..."')
  })
})
