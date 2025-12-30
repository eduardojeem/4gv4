import { config } from './config'
import { getPublicUrl } from './supabase-storage'

export const resolveProductImageUrl = (url?: string | null): string => {
  if (!url) return '/placeholder-product.jpg'
  if (/^https?:\/\//.test(url)) return url
  if (!config.supabase.isConfigured) return url
  
  try {
    const publicUrl = getPublicUrl('product-images', url)
    return publicUrl || '/placeholder-product.jpg'
  } catch (error) {
    console.warn('Error resolving product image URL:', error)
    return '/placeholder-product.jpg'
  }
}
