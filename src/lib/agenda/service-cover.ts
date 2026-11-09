import { uploadFile } from '@/lib/supabase-storage'
import { PUBLIC_IMAGE_CACHE_CONTROL } from '@/lib/images/upload-profiles'

/**
 * Portada de un servicio de la agenda. Es la misma foto del producto del
 * catálogo (primera de `images`, espejada en `image_url`): así la tienda, el
 * POS y la página de servicios muestran una sola foto y no quedan copias
 * desconectadas.
 */
export const SERVICE_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const SERVICE_COVER_MAX_BYTES = 5 * 1024 * 1024

export function serviceCoverProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!SERVICE_COVER_TYPES.includes(file.type)) return 'Elegí una foto JPG, PNG, WebP o AVIF.'
  if (file.size === 0) return 'La foto está vacía.'
  if (file.size > SERVICE_COVER_MAX_BYTES) return 'La foto no puede superar 5 MB.'
  return null
}

/** Fotos del producto con la portada nueva primero, sin repetir y dentro del máximo de 10. */
export function imagesWithCover(current: readonly string[] | null | undefined, cover: string): string[] {
  return [cover, ...(current ?? []).filter((url) => url && url !== cover)].slice(0, 10)
}

/** Fotos del producto sin la portada actual: la siguiente pasa a ser la portada. */
export function imagesWithoutCover(current: readonly string[] | null | undefined, cover: string | null | undefined): string[] {
  return (current ?? []).filter((url) => url && url !== cover)
}

/** Lo que se manda a PUT /api/products/[id] para guardar foto y visibilidad juntas. */
export function serviceWebsitePayload(input: { visible: boolean; images?: string[] }) {
  return {
    visibility: input.visible ? 'public' : 'hidden',
    ...(input.images ? { images: input.images, image_url: input.images[0] ?? null } : {}),
  }
}

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

/** Sube la foto al mismo bucket y carpeta que las fotos de productos. */
export async function uploadServiceCover(file: File): Promise<string> {
  const problem = serviceCoverProblem(file)
  if (problem) throw new Error(problem)
  const name = `${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? 'jpg'}`
  const result = await uploadFile('product-images', `products/${name}`, file, {
    upsert: false,
    cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
    contentType: file.type,
  })
  if (!result.success || !result.url) throw new Error(result.error || 'No se pudo subir la portada. Revisá tu conexión.')
  return result.url
}
