import { removeAccents } from './city-normalizer'

/**
 * Cada tienda crea sus propias categorías («Electrónica», «Electronica»,
 * «Cosina»…). La vidriera de rubros del marketplace las junta por palabras
 * clave para mostrar cuántos productos hay de verdad y llevar a ellos, en vez
 * de buscar el nombre del rubro como texto (que casi no encontraba nada).
 */

export type ShowcaseRubroId =
  | 'audio'
  | 'computacion'
  | 'electrodomesticos'
  | 'belleza'
  | 'muebles'
  | 'moda'
  | 'electronica'
  | 'servicios'

/**
 * En orden de prioridad: una categoría va al primer rubro que la reconoce.
 * «Audio y Video» es audio antes que electrónica, «Accesorios de belleza» es
 * belleza y no accesorios de celular.
 */
const RUBRO_KEYWORDS: [ShowcaseRubroId, string[]][] = [
  ['audio', ['audio', 'auricular', 'auriculares', 'parlante', 'parlantes', 'sonido', 'video', 'tv', 'television', 'televisor', 'televisores']],
  ['computacion', ['computacion', 'computadora', 'computadoras', 'notebook', 'notebooks', 'laptop', 'teclado', 'teclados', 'mouse', 'impresora', 'impresoras', 'tinta', 'tintas', 'toner', 'almacenamiento', 'red', 'redes', 'internet', 'router', 'monitor', 'monitores', 'pendrive', 'memoria', 'memorias']],
  ['electrodomesticos', ['electrodomestico', 'electrodomesticos', 'heladera', 'heladeras', 'lavarropa', 'lavarropas', 'climatizacion', 'aire', 'aires', 'cocina', 'cocinas', 'cosina', 'utensilio', 'utensilios', 'microondas', 'ventilador', 'ventiladores', 'freezer']],
  ['belleza', ['belleza', 'estetica', 'perfume', 'perfumes', 'perfumeria', 'maquillaje', 'cosmetica', 'cosmeticos', 'cabello', 'peluqueria', 'barberia', 'skincare']],
  ['muebles', ['hogar', 'mueble', 'muebles', 'limpieza', 'pileta', 'piletas', 'cesped', 'jardin', 'jardineria', 'decoracion', 'colchon', 'colchones', 'bazar']],
  ['moda', ['moda', 'ropa', 'remera', 'remeras', 'indumentaria', 'reloj', 'relojes', 'relojeria', 'calzado', 'calzados', 'joya', 'joyas', 'bijou']],
  ['electronica', ['electronica', 'electronico', 'celular', 'celulares', 'pantalla', 'pantallas', 'lcd', 'oled', 'cctv', 'alarma', 'alarmas', 'camara', 'camaras', 'cargador', 'cargadores', 'cable', 'cables', 'tablet', 'tablets', 'smartwatch']],
  ['servicios', ['servicio', 'servicios']],
]

export function rubroForCategory(categoryName: string | null | undefined): ShowcaseRubroId | null {
  if (!categoryName) return null
  const words = new Set(removeAccents(categoryName).split(/[^a-z0-9]+/).filter(Boolean))
  for (const [rubro, keywords] of RUBRO_KEYWORDS) {
    if (keywords.some((keyword) => words.has(keyword))) return rubro
  }
  return null
}

export type ShowcaseProduct = { id: string; name: string; image: string | null; href: string }
export type ShowcaseRubroStats = { count: number; categoryIds: string[]; products: ShowcaseProduct[] }

type CatalogProduct = {
  id: string
  name: string
  image?: string | null
  featured?: boolean
  organization_slug: string
  category?: { id: string; name: string } | null
}

/** Con menos productos, la tarjeta prometería un rubro casi vacío. */
export const MIN_PRODUCTS_PER_RUBRO = 3
const PRODUCTS_PER_CARD = 3

export function buildCategoryShowcase(products: CatalogProduct[]): Partial<Record<ShowcaseRubroId, ShowcaseRubroStats>> {
  const stats: Partial<Record<ShowcaseRubroId, ShowcaseRubroStats & { categorySet: Set<string> }>> = {}
  // Primero los destacados con foto: son las mejores miniaturas del rubro.
  const ordered = [...products].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
  for (const product of ordered) {
    const rubro = rubroForCategory(product.category?.name)
    if (!rubro || !product.category) continue
    const entry = stats[rubro] ?? (stats[rubro] = { count: 0, categoryIds: [], products: [], categorySet: new Set<string>() })
    entry.count++
    entry.categorySet.add(product.category.id)
    if (product.image && entry.products.length < PRODUCTS_PER_CARD) {
      entry.products.push({
        id: product.id,
        name: product.name,
        image: product.image,
        href: `/${product.organization_slug}/productos/${product.id}`,
      })
    }
  }
  const result: Partial<Record<ShowcaseRubroId, ShowcaseRubroStats>> = {}
  for (const [rubro, entry] of Object.entries(stats) as [ShowcaseRubroId, NonNullable<(typeof stats)[ShowcaseRubroId]>][]) {
    if (entry.count < MIN_PRODUCTS_PER_RUBRO) continue
    result[rubro] = { count: entry.count, categoryIds: [...entry.categorySet].sort(), products: entry.products }
  }
  return result
}
