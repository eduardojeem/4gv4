import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/app/dashboard/products/page.tsx')
const GRID = leer('src/components/dashboard/products-modern/ProductGrid.tsx')

/**
 * `fetchProducts` pone `loading = true` en cada recarga, no solo en la primera,
 * y la grilla devuelve esqueletos cuando esa bandera está activa. Cualquier
 * refresco —venga de donde venga— hacía desaparecer la lista entera y volver a
 * pintarla: eso es lo que se siente como «se actualiza solo».
 */
describe('recargar no vacía la pantalla de productos', () => {
  it('distingue la primera carga de una recarga', () => {
    expect(PAGINA).toContain('const isFirstLoad = (loading || isPending) && products.length === 0')
    expect(PAGINA).toContain('const isRefreshing = (loading || isPending) && products.length > 0')
  })

  it('las tres vistas solo muestran esqueleto sin datos', () => {
    // Grilla, tabla y vista compacta: si alguna sigue recibiendo `loading`
    // crudo, esa vista se sigue vaciando.
    const usos = [...PAGINA.matchAll(/loading=\{isFirstLoad\}/g)]
    expect(usos.length).toBe(3)
    expect(PAGINA).not.toContain('loading={loading || isPending}\n              />')
  })

  it('la paginación no desaparece durante una recarga', () => {
    // Perder la paginación mueve el resto de la página hacia arriba, que es
    // parte de lo que se ve como un salto.
    expect(PAGINA).toContain('{!isFirstLoad && displayedProducts.length > 0 && (')
    expect(PAGINA).not.toContain('{!loading && displayedProducts.length > 0 && (')
  })

  it('avisa que está actualizando en vez de vaciar', () => {
    expect(PAGINA).toContain('Actualizando productos')
    expect(PAGINA).toContain('aria-live="polite"')
  })

  it('la grilla sigue mostrando esqueleto cuando se lo piden', () => {
    // No se toca el componente: sigue sirviendo para la primera carga, que es
    // cuando el esqueleto ayuda.
    expect(GRID).toContain('if (loading)')
  })
})
