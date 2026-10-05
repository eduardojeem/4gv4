/**
 * Bases abiertas de productos (Open Food Facts y Open Beauty Facts): cuando un
 * código del fabricante no está en el catálogo de la plataforma, de ahí salen
 * el nombre, la marca y la foto. Son gratuitas y de datos abiertos (ODbL; las
 * fotos, CC BY-SA), por eso la pantalla dice de dónde vino cada dato.
 *
 * Solo sirven para alimentos, bebidas, limpieza, perfumería y cosmética: en
 * electrónica, ropa o ferretería no tienen datos y no se consultan.
 */

export type OpenFactsSource = 'openfoodfacts' | 'openbeautyfacts'

export type OpenFactsProduct = {
  source: OpenFactsSource
  gtin: string
  name: string
  brandName: string | null
  description: string | null
  imageUrl: string | null
  /** La ficha pública, para la atribución. */
  sourceUrl: string
}

export const OPEN_FACTS_LABELS: Record<OpenFactsSource, string> = {
  openfoodfacts: 'Open Food Facts',
  openbeautyfacts: 'Open Beauty Facts',
}

const HOSTS: Record<OpenFactsSource, string> = {
  openfoodfacts: 'world.openfoodfacts.org',
  openbeautyfacts: 'world.openbeautyfacts.org',
}

/** Hosts de las fotos, para copiarlas al almacenamiento de la tienda. */
export const OPEN_FACTS_IMAGE_HOSTS = ['images.openfoodfacts.org', 'images.openbeautyfacts.org'] as const

const FIELDS = 'code,product_name_es,product_name,generic_name_es,generic_name,brands,quantity,image_front_url,image_url'

// Pedido por las bases: identificar la aplicación que consulta.
const USER_AGENT = 'MiTiendaPy/1.0 (+https://www.mitiendapy.com)'

const TIMEOUT_MS = 3500

/** En qué bases buscar, y en qué orden, según el rubro. Vacío: no se consulta. */
export function openFactsSourcesFor(vertical: string | null | undefined): OpenFactsSource[] {
  switch (vertical) {
    case 'food':
      return ['openfoodfacts', 'openbeautyfacts']
    case 'cosmetics':
    case 'barbershop':
      return ['openbeautyfacts', 'openfoodfacts']
    case 'electronics':
    case 'clothing':
    case 'hardware':
      return []
    default:
      // Almacén, minimarket, farmacia u otro: lo más común son alimentos y limpieza.
      return ['openfoodfacts', 'openbeautyfacts']
  }
}

type RawProduct = {
  product_name_es?: string
  product_name?: string
  generic_name_es?: string
  generic_name?: string
  brands?: string
  quantity?: string
  image_front_url?: string
  image_url?: string
}

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** Para comparar sin acentos, guiones ni espacios («Coca-Cola» = «coca cola»). */
const comparable = (value: string) => value.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')

/** Primera letra en mayúscula cuando la base lo trae todo en minúsculas («coca cola»). */
function tidyName(value: string) {
  return value === value.toLowerCase() ? value.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase()) : value
}

/** Arma el producto de la respuesta de la base; null si no hay al menos un nombre. */
export function parseOpenFactsProduct(source: OpenFactsSource, gtin: string, payload: unknown): OpenFactsProduct | null {
  const body = payload as { status?: number; product?: RawProduct } | null
  if (!body || body.status !== 1 || !body.product) return null
  const raw = body.product

  const baseName = clean(raw.product_name_es) || clean(raw.product_name) || clean(raw.generic_name_es) || clean(raw.generic_name)
  if (!baseName) return null

  const brandName = clean(raw.brands).split(',').map((brand) => brand.trim()).find(Boolean) ?? null
  const quantity = clean(raw.quantity)
  let name = tidyName(baseName)
  // «Coca Cola Original 2,25 L»: el tamaño distingue presentaciones del mismo producto.
  if (quantity && !comparable(name).includes(comparable(quantity))) name = `${name} ${quantity}`
  // La marca adelante si el nombre no la menciona («Tradición» → «Nescafé Tradición»).
  if (brandName && !comparable(name).includes(comparable(brandName))) name = `${brandName} ${name}`

  const genericName = clean(raw.generic_name_es) || clean(raw.generic_name)
  const description = genericName && comparable(genericName) !== comparable(baseName) ? genericName : null

  const image = clean(raw.image_front_url) || clean(raw.image_url)
  let imageUrl: string | null = null
  try {
    if (image && OPEN_FACTS_IMAGE_HOSTS.includes(new URL(image).hostname as (typeof OPEN_FACTS_IMAGE_HOSTS)[number])) imageUrl = image
  } catch {
    imageUrl = null
  }

  return {
    source,
    gtin,
    name: name.slice(0, 200),
    brandName,
    description,
    imageUrl,
    sourceUrl: `https://${HOSTS[source]}/product/${gtin}`,
  }
}

/**
 * Busca el código en las bases que corresponden al rubro. Sin conexión, lenta
 * (más de 3,5 s) o sin el producto, devuelve null: el formulario sigue igual.
 */
export async function lookupOpenFacts(
  gtin: string,
  sources: OpenFactsSource[],
  fetchImpl: typeof fetch = fetch,
): Promise<OpenFactsProduct | null> {
  if (!/^\d{8,14}$/.test(gtin)) return null
  for (const source of sources) {
    try {
      const response = await fetchImpl(`https://${HOSTS[source]}/api/v2/product/${gtin}.json?fields=${FIELDS}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // El mismo código se escanea en muchas tiendas: un día de caché alcanza.
        next: { revalidate: 60 * 60 * 24 },
      } as RequestInit)
      if (!response.ok) continue
      const product = parseOpenFactsProduct(source, gtin, await response.json())
      if (product) return product
    } catch {
      // Una base caída no frena a la otra.
    }
  }
  return null
}
