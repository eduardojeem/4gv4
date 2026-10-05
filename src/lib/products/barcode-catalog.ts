import { validateBarcode } from '@/lib/validations/product-validation'

/**
 * Códigos de barras y el catálogo global de productos.
 *
 * El código del fabricante (EAN-13, EAN-8, UPC-A) es lo único que identifica
 * igual un producto en cualquier rubro: el mismo shampoo trae el mismo código
 * en todas las tiendas. Con él se evita cargar dos veces lo mismo y se
 * completan los datos desde el catálogo de la plataforma (`global_products`).
 */

export type BarcodeKind =
  /** Código del fabricante: sirve para buscar en el catálogo global. */
  | 'manufacturer'
  /** EAN-13 del rango 2xx, que GS1 reserva para uso interno de cada comercio. */
  | 'internal'
  /** No es un EAN/UPC válido (largo o dígito verificador). */
  | 'invalid'
  | 'empty'

export function cleanBarcode(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\s+/g, '')
}

export function classifyBarcode(raw: string | null | undefined): { code: string; kind: BarcodeKind } {
  const code = cleanBarcode(raw)
  if (!code) return { code, kind: 'empty' }
  if (!validateBarcode(code)) return { code, kind: 'invalid' }
  // Los códigos 2xx son de cada comercio: el mismo número puede ser otro
  // producto en otra tienda, así que nunca se buscan en el catálogo global.
  if (code.length === 13 && code.startsWith('2')) return { code, kind: 'internal' }
  return { code, kind: 'manufacturer' }
}

/**
 * Clave con la que se guarda en el catálogo: un UPC-A de 12 dígitos es el
 * mismo producto que su EAN-13 con un 0 adelante, y los lectores devuelven
 * uno u otro según cómo estén configurados.
 */
export function gtinKey(raw: string | null | undefined): string | null {
  const { code, kind } = classifyBarcode(raw)
  if (kind !== 'manufacturer') return null
  return code.length === 12 ? `0${code}` : code
}

/** Las formas en que una tienda pudo haber guardado el mismo código. */
export function barcodeSpellings(raw: string | null | undefined): string[] {
  const code = cleanBarcode(raw)
  if (!code) return []
  const spellings = new Set([code])
  if (/^\d{12}$/.test(code)) spellings.add(`0${code}`)
  if (/^0\d{12}$/.test(code)) spellings.add(code.slice(1))
  return [...spellings]
}

export type CatalogCandidateRow = {
  organization_id: string | null
  barcode: string | null
  name: string | null
  brand: string | null
  global_brand_id: string | null
  global_category_id: string | null
  image_url: string | null
  description: string | null
}

export type GlobalProductCandidate = {
  gtin: string
  name: string
  /** Otros nombres con que lo cargaron las tiendas. */
  otherNames?: string[] | null
  other_names?: string[] | null
  brandName?: string | null
  globalBrandId?: string | null
  globalCategoryId?: string | null
  imageUrl?: string | null
  description?: string | null
  stores?: number
}

function mostFrequent(values: Array<string | null>): string | null {
  const counts = new Map<string, { value: string; count: number }>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('es')
    const entry = counts.get(key) ?? { value: trimmed, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.length - b.value.length)[0]?.value ?? null
}

/**
 * Productos con código del fabricante que el catálogo todavía no tiene,
 * agrupados por código. De cada grupo se propone lo que más se repite entre
 * las tiendas: el nombre, la marca y la categoría con que más lo cargaron.
 */
export function groupGlobalProductCandidates(rows: CatalogCandidateRow[], existing: Set<string>): GlobalProductCandidate[] {
  const groups = new Map<string, CatalogCandidateRow[]>()
  for (const row of rows) {
    const gtin = gtinKey(row.barcode)
    if (!gtin || existing.has(gtin)) continue
    groups.set(gtin, [...(groups.get(gtin) ?? []), row])
  }

  return [...groups.entries()]
    .map(([gtin, group]) => {
      const name = mostFrequent(group.map((row) => row.name)) ?? gtin
      return {
        gtin,
        name,
        otherNames: [...new Set(group.map((row) => row.name?.trim()).filter((value): value is string => Boolean(value) && value !== name))].slice(0, 5),
        brandName: mostFrequent(group.map((row) => row.brand)),
        globalBrandId: mostFrequent(group.map((row) => row.global_brand_id)),
        globalCategoryId: mostFrequent(group.map((row) => row.global_category_id)),
        imageUrl: group.find((row) => row.image_url)?.image_url ?? null,
        description: group.map((row) => row.description?.trim()).find(Boolean) ?? null,
        stores: new Set(group.map((row) => row.organization_id).filter(Boolean)).size,
      }
    })
    .sort((a, b) => b.stores - a.stores || a.name.localeCompare(b.name, 'es'))
}
