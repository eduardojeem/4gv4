import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CARRUSEL = readFileSync(
  resolve(process.cwd(), 'src/components/public/MarketplaceProductCarousel.tsx'),
  'utf8'
)

/**
 * En /marketplace cada tarjeta medía `w-[78vw]`: en un teléfono de 375px eso
 * son 292px, o sea que entraba una sola y no se veía que el carrusel se
 * deslizaba. Medido en el navegador a 375px: 292px de ancho y 1,28 tarjetas por
 * pantalla antes; 169px y 2,22 después.
 */
describe('las tarjetas del carrusel entran de a dos en el teléfono', () => {
  it('el ancho ya no es de casi toda la pantalla', () => {
    expect(CARRUSEL).not.toContain('w-[78vw]')
    expect(CARRUSEL).toContain('w-[45vw] min-w-[148px] max-w-[280px]')
  })

  it('el mínimo evita que se aplaste en pantallas muy angostas', () => {
    // A 45vw, un teléfono de 320px daría 144px: por debajo de eso el precio y
    // los botones no entran.
    expect(CARRUSEL).toContain('min-w-[148px]')
  })

  it('en escritorio queda como estaba', () => {
    // Medido: 256px a 1280px de viewport, igual que antes.
    expect(CARRUSEL).toContain('sm:w-64')
  })
})

describe('el contenido acompaña el ancho nuevo', () => {
  it('el relleno interno es menor en el teléfono', () => {
    // `p-4` sobre 169px se come el ancho útil.
    expect(CARRUSEL).toContain('p-2.5 sm:p-4')
  })

  it('los textos bajan un punto y vuelven en escritorio', () => {
    expect(CARRUSEL).toContain('text-xs font-semibold leading-snug text-foreground transition-colors hover:text-primary sm:mt-1.5 sm:text-sm')
    expect(CARRUSEL).toContain('text-[11px] font-semibold hover:underline sm:gap-1.5 sm:text-xs')
  })

  it('los botones siguen en dos columnas', () => {
    // Apilarlos sumaba 66px de alto. Entran porque las etiquetas son cortas:
    // medido, 71px cada uno a 375px, sin desbordar.
    expect(CARRUSEL).toContain('grid grid-cols-2 gap-1 pt-0.5 sm:gap-1.5 sm:pt-1')
  })

  it('«Ir a tienda» se acorta a «Tienda» en el teléfono', () => {
    // No entra completo en 71px.
    expect(CARRUSEL).toContain('<span className="sm:hidden">Tienda</span>')
    expect(CARRUSEL).toContain('<span className="hidden sm:inline">Ir a tienda</span>')
  })

  it('la flecha se va en el teléfono, donde no hay lugar', () => {
    expect(CARRUSEL).toContain('<ArrowRight className="hidden h-3 w-3 sm:inline" />')
  })
})
