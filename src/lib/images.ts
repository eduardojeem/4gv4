import { getPublicUrl } from './supabase-storage'
import { isSupportedImageSource } from './image-url-policy'

/**
 * Qué imágenes NO pasan por el optimizador de Vercel (`/_next/image`).
 *
 * Las de las tiendas y de otros sitios se sirven directo: las fotos se
 * comprimen a WebP al subirlas, y cada transformación de Vercel cuenta contra
 * un cupo pago que, agotado, responde 402 y deja la foto en blanco. Solo las
 * imágenes fijas del propio sitio (`/images/...`), que son pocas y siempre las
 * mismas, se siguen optimizando.
 */
export const shouldBypassImageOptimization = (source?: string | null): boolean => {
  if (!source) return true
  const value = source.trim()
  if (!value) return true
  if (value.startsWith('data:') || value.startsWith('blob:')) return true
  // Next/Image rejects local URLs with a cache-busting query unless every
  // exact search pattern is configured. These assets are already WebP files.
  if (value.startsWith('/') && /[?#]/.test(value)) return true
  if (value === '/placeholder-product.svg' || /\.(?:svg|gif)(?:$|[?#])/i.test(value)) return true
  // Protocolo relativo («//cdn…»): también es de otro sitio.
  if (value.startsWith('//')) return true

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    // Ruta del propio sitio («/images/…» o «product-images/…» ya resuelta aparte).
    return false
  }
}

export const resolveProductImageUrl = (url?: string | null): string => {
  // Si no hay URL o está vacía, retornar placeholder
  if (!url || typeof url !== 'string' || !url.trim()) return '/placeholder-product.svg'
  
  const cleanUrl = url.trim()

  // Si es data URI o blob URL, retornar tal cual
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) return cleanUrl
  
  // Una URL externa que Next/Image no puede renderizar nunca debe llegar al
  // componente: los registros antiguos o importados usan un fallback seguro.
  if (/^https?:\/\//.test(cleanUrl)) {
    return isSupportedImageSource(cleanUrl) ? cleanUrl : '/placeholder-product.svg'
  }
  
  // Archivo de /public. Sin query ni hash: Next rechaza (y rompe el build al
  // prerenderizar) una imagen local con query string que no esté declarada en
  // images.localPatterns, y en un archivo estático el ?v= no aporta nada.
  if (cleanUrl.startsWith('/')) return cleanUrl.split(/[?#]/)[0] || '/placeholder-product.svg'
  
  // Si empieza con 'product-images/', limpiarlo para evitar duplicar el bucket en getPublicUrl
  const normalizedPath = cleanUrl.replace(/^product-images\//, '')

  // Intentar obtener URL pública de Supabase Storage
  try {
    const publicUrl = getPublicUrl('product-images', normalizedPath)
    if (publicUrl) {
      return publicUrl
    }
  } catch (error) {
    console.error('Error resolving product image URL:', error, 'for path:', cleanUrl)
  }

  // Si Supabase no está configurado o falla, usar ruta relativa como último recurso
  return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`
}
