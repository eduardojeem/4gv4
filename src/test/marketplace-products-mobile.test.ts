import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CLIENTE = readFileSync(
  resolve(process.cwd(), 'src/components/public/ProductsClient.tsx'),
  'utf8'
)

/**
 * En /marketplace/productos la grilla no declaraba columnas para el teléfono, y
 * el valor por defecto es una: una tarjeta de 343×554 por fila, o sea un
 * producto por pantalla. La vista compacta sí tenía `grid-cols-2`; la vista por
 * defecto, que es la que se ve al entrar, no.
 *
 * Medido en el navegador a 375px:
 *
 *   columnas    1     →  2
 *   ancho     343px   → 166px
 *   alto      554px   → 384px
 */
describe('la grilla de productos entra de a dos en el teléfono', () => {
  it('la vista por defecto declara dos columnas', () => {
    expect(CLIENTE).toContain("'grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4'")
  })

  it('la vista compacta sigue como estaba', () => {
    // Esta ya era de dos: el problema era solo la otra.
    expect(CLIENTE).toContain("'grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'")
  })

  it('en escritorio no cambia nada', () => {
    // Medido: cuatro columnas de 287px a 1280px.
    expect(CLIENTE).toContain('md:grid-cols-3 lg:grid-cols-4')
  })
})

/**
 * A 166px de ancho, dos botones por fila no entraban (138px sobre 132) y en el
 * celular quedaban desparejos: el botón medía 44px y el enlace 28. Ahora la
 * tarjeta abre el detalle y queda una sola acción a lo ancho.
 */
describe('el contenido de la tarjeta entra en el ancho nuevo', () => {
  it('una sola acción a todo el ancho', () => {
    expect(CLIENTE).toContain('<span>Ver en la tienda</span>')
    expect(CLIENTE).toContain('flex h-9 w-full items-center justify-center')
    expect(CLIENTE).not.toContain('<span>Detalle</span>')
  })
})

/**
 * `truncate` estaba puesto en el contenedor de marca y categoría, que es flex:
 * ahí no hace nada, porque quien tiene que poder encogerse es cada hijo. Los dos
 * spans pedían 197px sobre 132 disponibles.
 */
describe('marca y categoría se recortan en vez de desbordar', () => {
  it('el recorte va en cada hijo, no en el contenedor flex', () => {
    expect(CLIENTE).not.toContain('flex items-center gap-2 text-[10px] text-muted-foreground truncate')
    expect(CLIENTE).toContain('min-w-0 shrink-0 truncate font-medium text-foreground')
    expect(CLIENTE).toContain('<span className="min-w-0 truncate">{displayCategoryName(product.category.name)}</span>')
  })

  it('la marca se recorta última, porque es la que identifica', () => {
    // `shrink-0` en la marca hace que ceda primero la categoría.
    const bloque = CLIENTE.slice(CLIENTE.indexOf('{product.brand && ('))
    expect(bloque.slice(0, 200)).toContain('shrink-0')
  })
})
