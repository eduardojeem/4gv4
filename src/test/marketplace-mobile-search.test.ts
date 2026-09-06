import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const NAV = leer('src/components/public/marketplace-public-nav.tsx')
const BARRA_INFERIOR = leer('src/components/public/MarketplaceMobileBottomNav.tsx')

/**
 * En el teléfono no había forma de buscar: el buscador del encabezado es
 * `xl:flex` —no aparece por debajo de 1280px— y la barra inferior tiene
 * Inicio, Productos, Categorías y Tiendas, pero no búsqueda.
 *
 * Verificado en el navegador a 375px: la lupa abre una fila de 65px con el
 * campo enfocado, enviar lleva a /marketplace/buscar?q=… y la fila se cierra
 * sola al cambiar de ruta. A 1280px el botón no se muestra.
 */
describe('hay un buscador en el encabezado del teléfono', () => {
  it('la barra inferior no lo tenía', () => {
    // Si algún día se agrega ahí, conviene revisar si este botón sigue haciendo
    // falta o queda duplicado.
    expect(BARRA_INFERIOR).not.toMatch(/buscar/i)
  })

  it('el botón solo aparece donde el buscador no está en la fila', () => {
    // El del encabezado es `xl:flex`: por debajo de eso no hay ninguno.
    expect(NAV).toContain('transition-colors xl:hidden')
    expect(NAV).toContain('xl:hidden')
  })

  it('la fila del buscador también', () => {
    expect(NAV).toContain('id="marketplace-mobile-search"')
    expect(NAV).toContain('px-4 py-2.5 sm:px-6 xl:hidden')
  })
})

describe('el buscador del teléfono se comporta', () => {
  it('abre con el teclado listo', () => {
    // Sin `autoFocus` hay que tocar la lupa y después el campo: dos toques
    // para lo mismo.
    const fila = NAV.slice(NAV.indexOf('id="marketplace-mobile-search"'))
    expect(fila.slice(0, 600)).toContain('autoFocus')
  })

  it('vive dentro del encabezado fijo', () => {
    // Para que siga a mano al desplazarse, que es cuando más se busca.
    const cabecera = NAV.slice(NAV.indexOf('<header className="sticky'), NAV.indexOf('</header>'))
    expect(cabecera).toContain('id="marketplace-mobile-search"')
  })

  it('se cierra al cambiar de ruta, como el menú', () => {
    const efecto = NAV.slice(NAV.indexOf('setMobileDrawerOpen(false)\n    setMobileSearchOpen(false)'))
    expect(efecto.slice(0, 120)).toContain('setMobileSearchOpen(false)')
    expect(NAV).toContain('}, [pathname])')
  })

  it('el botón dice en qué estado está', () => {
    expect(NAV).toContain("aria-label={mobileSearchOpen ? 'Cerrar la búsqueda' : 'Buscar en el marketplace'}")
    expect(NAV).toContain('aria-expanded={mobileSearchOpen}')
    expect(NAV).toContain('aria-controls="marketplace-mobile-search"')
  })

  it('el ícono acompaña al estado', () => {
    expect(NAV).toContain('{mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}')
  })
})
