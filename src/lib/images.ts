import { config } from './config'
import { getPublicUrl } from './supabase-storage'

export const resolveProductImageUrl = (url?: string | null): string => {
  if (!url) return '/placeholder-product.svg'
  if (url.startsWith('data:image')) return url
  if (/^https?:\/\//.test(url)) return url
  if (!config.supabase.isConfigured) return url
  
  try {
    const publicUrl = getPublicUrl('product-images', url)
    return publicUrl || '/placeholder-product.svg'
  } catch (error) {
    console.warn('Error resolving product image URL:', error)
    return '/placeholder-product.svg'
  }
}
