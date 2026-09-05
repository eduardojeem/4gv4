import { config } from './config'
import { getPublicUrl } from './supabase-storage'

export const resolveProductImageUrl = (url?: string | null): string => {
  // Si no hay URL o está vacía, retornar placeholder
  if (!url || typeof url !== 'string' || !url.trim()) return '/placeholder-product.svg'
  
  const cleanUrl = url.trim()

  // Si es data URI o blob URL, retornar tal cual
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) return cleanUrl
  
  // Si ya es una URL completa (http/https), retornar tal cual
  if (/^https?:\/\//.test(cleanUrl)) return cleanUrl
  
  // Si es una ruta relativa que empieza con /, retornar tal cual (archivo público en /public)
  if (cleanUrl.startsWith('/')) return cleanUrl
  
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
