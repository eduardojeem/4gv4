import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CARRUSEL = readFileSync(
  resolve(process.cwd(), 'src/components/public/MarketplaceProductCarousel.tsx'),
  'utf8'
)

/**
 * En /marketplace cada tarjeta medía `w-[78vw]`: en un teléfono de 375px son
 * 292px, así que entraba una sola y no se veía que el carrusel se deslizaba.
 *
 * El primer intento fue `w-[45vw]`, y no alcanzó: la pista del carrusel no mide
 * lo que la pantalla —el contenedor tiene su propio margen— sino 309px de 375.
 * A 45vw entraban 1,8 tarjetas, no dos. Medir contra el viewport fue el error.
 *
 * Medido en el navegador a 375px:
 *
 *   ancho    292px → 151px
 *   completas  1   →   2
 *   alto     399px → 349px
 */
describe('entran dos tarjetas completas en el teléfono', () => {
  it('el ancho se calcula sobre la pista, no sobre la pantalla', () => {
    expect(CARRUSEL).not.toContain('w-[78vw]')
    expect(CARRUSEL).not.toContain('w-[45vw]')
    expect(CARRUSEL).toContain('w-[calc((100%-0.5rem)/2)] max-w-[280px]')
  })

  it('el hueco entre tarjetas también baja en el teléfono', () => {
    // 16px se comían 5% de una pista de 309px: con dos tarjetas, eso es la
    // diferencia entre que entren y que no.
    expect(CARRUSEL).toContain('gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide scroll-smooth sm:gap-4')
  })

  it('el cálculo y el hueco tienen que coincidir', () => {
    // `calc((100% - 0.5rem) / 2)` descuenta exactamente un `gap-2`. Si uno
    // cambia sin el otro, la segunda tarjeta vuelve a quedar cortada.
    expect(CARRUSEL).toContain('0.5rem')
    expect(CARRUSEL).toContain('gap-2 ')
  })

  it('en escritorio queda como estaba', () => {
    // Medido: 256px de ancho y 16px de hueco a 1280px, igual que antes.
    expect(CARRUSEL).toContain('sm:w-64')
    expect(CARRUSEL).toContain('sm:gap-4')
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
