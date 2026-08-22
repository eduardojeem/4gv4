import { describe, expect, it } from 'vitest'
import { getPromotionStoragePathFromUrl, isOrganizationPromotionPath } from '@/lib/website/promotional-carousel-storage'

describe('promotional carousel storage paths', () => {
  it('extracts a promotional image path from a public storage URL', () => {
    expect(getPromotionStoragePathFromUrl(
      'https://project.supabase.co/storage/v1/object/public/product-images/website/promotions/org-1/slide-1-file.webp?v=1'
    )).toBe('website/promotions/org-1/slide-1-file.webp')
  })

  it('does not interpret regular external images as managed storage files', () => {
    expect(getPromotionStoragePathFromUrl('https://example.com/banner.webp')).toBeNull()
    expect(getPromotionStoragePathFromUrl('/images/promotional-carousel/accesorios.webp')).toBeNull()
  })

  it('restricts deletion to the active organization folder', () => {
    expect(isOrganizationPromotionPath('website/promotions/org-1/slide-1-file.webp', 'org-1')).toBe(true)
    expect(isOrganizationPromotionPath('website/promotions/org-2/slide-1-file.webp', 'org-1')).toBe(false)
    expect(isOrganizationPromotionPath('website/promotions/org-1/../org-2/file.webp', 'org-1')).toBe(false)
  })
})
