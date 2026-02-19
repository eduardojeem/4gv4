import { config } from './config'
import { getPublicUrl } from './supabase-storage'

export const resolveProductImageUrl = (url?: string | null): string => {
  // Si no hay URL, retornar placeholder
  if (!url) return '/placeholder-product.svg'
  
  // Si es data URI, retornar tal cual
  if (url.startsWith('data:image')) return url
  
  // Si ya es una URL completa (http/https), retornar tal cual
  if (/^https?:\/\//.test(url)) return url
  
  // Si es una ruta relativa que empieza con /, retornar tal cual (archivo público)
  if (url.startsWith('/')) return url
  
  // Si Supabase no está configurado, intentar como ruta relativa
  if (!config.supabase.isConfigured) {
    console.warn('Supabase not configured, using relative path:', url)
    return url.startsWith('/') ? url : `/${url}`
  }
  
  // Intentar obtener URL pública de Supabase Storage
  try {
    const publicUrl = getPublicUrl('product-images', url)
    if (publicUrl) {
      return publicUrl
    }
    console.warn('No public URL returned for:', url)
    return '/placeholder-product.svg'
  } catch (error) {
    console.error('Error resolving product image URL:', error, 'for path:', url)
    return '/placeholder-product.svg'
  }
}
