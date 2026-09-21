import { describe, expect, it, vi } from 'vitest'
import { validateSetting } from '@/lib/validation/website-settings'
import {
  MAX_WEBSITE_MEDIA_COUNT,
  getWebsiteStoragePathFromUrl,
  isOrganizationWebsitePath,
  inferMediaSection,
  addWebsiteMediaItem,
  deleteWebsiteMediaItem,
} from '@/lib/website/website-media'
import type { WebsiteMediaItem } from '@/types/website-settings'

describe('website media library validation', () => {
  it('has a maximum limit of 20 images', () => {
    expect(MAX_WEBSITE_MEDIA_COUNT).toBe(20)
  })

  it('validates a correct list of media items', () => {
    const items: WebsiteMediaItem[] = [
      {
        id: 'img-1',
        url: 'https://example.com/logo.png',
        path: 'website/logos/org-123/logo.png',
        name: 'Logo de la empresa',
        size: 150000,
        section: 'logo',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'img-2',
        url: 'https://example.com/banner.webp',
        path: 'website/promotions/org-123/banner.webp',
        name: 'Banner Promocional',
        size: 450000,
        section: 'promotions',
        createdAt: new Date().toISOString(),
      },
    ]

    const result = validateSetting('media_library', items)
    expect(result.success).toBe(true)
  })

  it('rejects media library with more than 20 items', () => {
    const items: WebsiteMediaItem[] = Array.from({ length: 21 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/img-${i}.png`,
      path: `website/media/org-123/img-${i}.png`,
      name: `Imagen ${i}`,
      size: 1000,
      section: 'general',
      createdAt: new Date().toISOString(),
    }))

    const result = validateSetting('media_library', items)
    expect(result.success).toBe(false)
  })

  it('rejects items with invalid or unsafe URLs', () => {
    const items = [
      {
        id: 'img-1',
        url: 'javascript:alert(1)',
        path: 'website/media/org-123/test.png',
        name: 'Test',
      },
    ]

    const result = validateSetting('media_library', items)
    expect(result.success).toBe(false)
  })
})

describe('website media helper functions', () => {
  it('extracts storage path from public supabase URL correctly', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/product-images/website/logos/org-1/file.png'
    expect(getWebsiteStoragePathFromUrl(url)).toBe('website/logos/org-1/file.png')

    const directPath = 'website/promotions/org-1/slide.webp'
    expect(getWebsiteStoragePathFromUrl(directPath)).toBe('website/promotions/org-1/slide.webp')

    expect(getWebsiteStoragePathFromUrl('https://example.com/outside.png')).toBeNull()
  })

  it('checks organization path ownership securely', () => {
    expect(isOrganizationWebsitePath('website/logos/org-1/file.png', 'org-1')).toBe(true)
    expect(isOrganizationWebsitePath('website/logos/org-2/file.png', 'org-1')).toBe(false)
    expect(isOrganizationWebsitePath('website/promotions/org-1/../org-2/file.png', 'org-1')).toBe(false)
    expect(isOrganizationWebsitePath('website/promotions/org-1\\org-2/file.png', 'org-1')).toBe(false)
  })

  it('infers media section correctly from path', () => {
    expect(inferMediaSection('website/logos/org-1/logo.png')).toBe('logo')
    expect(inferMediaSection('website/promotions/org-1/banner.webp')).toBe('promotions')
    expect(inferMediaSection('website/announcements/org-1/aviso.jpg')).toBe('announcements')
    expect(inferMediaSection('website/brands/org-1/brand.png')).toBe('brands')
    expect(inferMediaSection('website/other/org-1/doc.png')).toBe('general')
  })
})

describe('addWebsiteMediaItem quota enforcement', () => {
  it('enforces quota limit of 20 images', async () => {
    const mockExisting: WebsiteMediaItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `id-${i}`,
      url: `https://example.com/img-${i}.jpg`,
      path: `website/media/org-test/img-${i}.jpg`,
      name: `Img ${i}`,
      createdAt: new Date().toISOString(),
    }))

    const fakeSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { value: mockExisting },
              }),
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any

    const result = await addWebsiteMediaItem(
      'org-test',
      {
        url: 'https://example.com/img-new.jpg',
        path: 'website/media/org-test/img-new.jpg',
        name: 'New Image',
      },
      fakeSupabase
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Alcanzaste el límite de 20 imágenes')
  })

  it('re-uses existing item if path or url already exists', async () => {
    const mockExisting: WebsiteMediaItem[] = [
      {
        id: 'existing-1',
        url: 'https://example.com/logo.png',
        path: 'website/logos/org-test/logo.png',
        name: 'Logo',
        createdAt: new Date().toISOString(),
      },
    ]

    const fakeSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { value: mockExisting },
              }),
            }),
          }),
        }),
      }),
    } as any

    const result = await addWebsiteMediaItem(
      'org-test',
      {
        url: 'https://example.com/logo.png',
        path: 'website/logos/org-test/logo.png',
        name: 'Logo duplicate',
      },
      fakeSupabase
    )

    expect(result.success).toBe(true)
    expect(result.item?.id).toBe('existing-1')
  })
})

describe('deleteWebsiteMediaItem', () => {
  it('removes file from storage and decrements list count', async () => {
    const mockExisting: WebsiteMediaItem[] = [
      {
        id: 'img-to-delete',
        url: 'https://example.com/delete.png',
        path: 'website/logos/org-test/delete.png',
        name: 'Logo',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'img-to-keep',
        url: 'https://example.com/keep.png',
        path: 'website/logos/org-test/keep.png',
        name: 'Keep',
        createdAt: new Date().toISOString(),
      },
    ]

    const removeStorageMock = vi.fn().mockResolvedValue({ error: null })
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    const fakeSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { value: mockExisting },
              }),
            }),
          }),
        }),
        upsert: upsertMock,
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          remove: removeStorageMock,
        }),
      },
    } as any

    const result = await deleteWebsiteMediaItem(
      'org-test',
      { id: 'img-to-delete' },
      fakeSupabase
    )

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    expect(removeStorageMock).toHaveBeenCalledWith(['website/logos/org-test/delete.png'])
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'media_library',
        organization_id: 'org-test',
        value: [mockExisting[1]],
      }),
      expect.anything()
    )
  })
})
