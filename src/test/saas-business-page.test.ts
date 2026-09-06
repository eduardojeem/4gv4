import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/components/saas/landing/saas-business-page-content.tsx')
const MARKETPLACE = leer('src/lib/public/marketplace.ts')

/** El archivo sin comentarios: varios explican lo que se quitó y lo nombran. */
const SOLO_CODIGO = PAGINA
  .split('\n')
  .filter((linea) => {
    const t = linea.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  })
  .join(' ')

/**
 * /saas/negocios se titula «Negocios y Comercios Adheridos» y presenta a los
 * comercios que usan la plataforma. Cuando había menos de cuatro adheridos, la
 * lista se completaba con seis comercios inventados —con calificaciones,
 * cantidades de productos, ciudades y direcciones inventadas— sin ninguna marca
 * que los distinguiera de los reales.
 */
describe('solo se muestran negocios reales', () => {
  it('no queda ningún negocio inventado', () => {
    expect(SOLO_CODIGO).not.toContain('DEMO_PREMIER_STORES')
    expect(PAGINA).not.toContain('MegaTech')
    expect(PAGINA).not.toMatch(/id: 'demo-\d'/)
  })

  it('la lista es la que viene del servidor, sin relleno', () => {
    expect(PAGINA).toContain('const combinedStores = initialOrganizations')
  })

  it('sin negocios no se muestra una cinta vacía dando vueltas', () => {
    expect(PAGINA).toContain('{combinedStores.length > 0 && (')
  })

  it('distingue «no hay ninguno» de «el filtro no encontró»', () => {
    // Decir lo segundo cuando pasa lo primero manda a probar filtros que no van
    // a devolver nada.
    expect(PAGINA).toContain('Todavía no hay negocios publicados')
    expect(PAGINA).toContain('No se encontraron tiendas con ese filtro')
  })
})

/**
 * Aparte de los negocios inventados, la tarjeta inventaba datos de los negocios
 * reales: una tienda sin productos mostraba «+150 productos» y una sin reseñas
 * «4.9 (50)» — una calificación y cincuenta reseñas que no existían.
 */
describe('no se inventan datos de un negocio real', () => {
  it('no queda el respaldo de 150 productos', () => {
    // El texto del estado ahora vive en `describeCatalogState`, compartido con
    // el directorio del marketplace; acá solo se comprueba que se lo use.
    expect(PAGINA).not.toContain('store.products_count || 150')
    expect(PAGINA).toContain('describeCatalogState(store)')
  })

  it('no queda la calificación de 4.9 inventada', () => {
    expect(SOLO_CODIGO).not.toContain('review_rating_avg ?? 4.9')
    expect(SOLO_CODIGO).not.toContain('store.review_count ?? 50')
  })

  it('sin reseñas lo dice, en vez de mostrar estrellas', () => {
    expect(PAGINA).toContain('Sin reseñas todavía')
    expect(PAGINA).toContain('{(store.review_count ?? 0) > 0 ? (')
  })

  it('la cinta tampoco muestra estrellas sin reseñas', () => {
    const cinta = PAGINA.slice(
      PAGINA.indexOf('CINTA MARQUEE'),
      PAGINA.indexOf('SHOWCASE MODERNO')
    )
    expect(cinta).toContain('{(store.review_count ?? 0) > 0 && (')
    expect(cinta).not.toContain('review_rating_avg ?? 4.9')
  })

  it('el conteo ya no lleva un «+» delante de un número exacto', () => {
    // «+480 productos» se lee como «más de 480», y es el conteo exacto.
    expect(PAGINA).not.toContain('+{store.products_count')
  })
})

/**
 * `products_count` salía de contar las filas que le tocaban a cada tienda dentro
 * de un pozo global capado en `limit * 4`: una tienda con muchos productos
 * recientes se lo llevaba entero y las demás mostraban 0 aunque tuvieran
 * catálogo.
 */
describe('el conteo de productos es de cada empresa', () => {
  it('se cuenta aparte, sin tope por empresa', () => {
    expect(MARKETPLACE).toContain('const productCountByOrganization = new Map<string, number>()')
    expect(MARKETPLACE).toContain('products_count: productCountByOrganization.get(organization.id) ?? 0')
  })

  it('ya no se deriva del pozo de productos destacados', () => {
    expect(MARKETPLACE).not.toContain('products_count: organizationProducts.length')
  })
})
