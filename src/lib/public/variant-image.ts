/**
 * La foto que corresponde a la variante elegida.
 *
 * La pagina de detalle cambiaba la foto al elegir un color, pero los modales
 * (vista rapida, oferta destacada y marketplace) seguian mostrando la del
 * producto: elegir «Negro» dejaba la remera blanca en pantalla. La regla vive
 * aca para que las tres vistas muestren lo mismo.
 */

export type VariantImageSource = {
  attributes?: Record<string, string> | null
  image_url?: string | null
}

/** Algunas variantes traen la foto en `image_url` y otras entre sus atributos. */
export function variantImageSource(variant?: VariantImageSource | null): string | null {
  const direct = variant?.image_url?.trim()
  if (direct) return direct
  const fromAttributes = variant?.attributes?.image_url?.trim()
  return fromAttributes || null
}

function variantColor(variant?: VariantImageSource | null): string | null {
  const attributes = variant?.attributes
  if (!attributes) return null
  return attributes.color?.trim() || attributes.Color?.trim() || null
}

/**
 * Las fotos del producto mas las de sus variantes, sin repetidos ni vacios.
 * `transform` permite pasar la resolucion de URL de cada vista.
 */
export function galleryWithVariantImages(
  productImages: Array<string | null | undefined>,
  variants: VariantImageSource[] = [],
  transform: (image: string) => string = (image) => image,
): string[] {
  const seen = new Set<string>()
  const gallery: string[] = []

  for (const candidate of [...productImages, ...variants.map(variantImageSource)]) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue
    const image = transform(trimmed)
    if (!image || seen.has(image)) continue
    seen.add(image)
    gallery.push(image)
  }

  return gallery
}

/**
 * Posicion en la galeria de la foto de la variante elegida. Si la variante no
 * tiene foto propia, se usa la de otra variante del mismo color: los talles de
 * un mismo color comparten la foto. Devuelve -1 si no hay ninguna.
 */
export function variantImageIndex(
  gallery: string[],
  variant?: VariantImageSource | null,
  siblings: VariantImageSource[] = [],
  transform: (image: string) => string = (image) => image,
): number {
  if (!variant || gallery.length === 0) return -1

  const own = variantImageSource(variant)
  if (own) {
    const index = gallery.indexOf(transform(own))
    if (index !== -1) return index
  }

  const color = variantColor(variant)
  if (!color) return -1

  for (const sibling of siblings) {
    if (variantColor(sibling)?.toLowerCase() !== color.toLowerCase()) continue
    const image = variantImageSource(sibling)
    if (!image) continue
    const index = gallery.indexOf(transform(image))
    if (index !== -1) return index
  }

  return -1
}
