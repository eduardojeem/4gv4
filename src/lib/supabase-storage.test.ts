import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage/image.webp' } })),
  from: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: mocks.from },
  }),
}))

import { uploadFile } from './supabase-storage'

describe('uploadFile metadata', () => {
  beforeEach(() => {
    mocks.upload.mockReset().mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockClear()
    mocks.from.mockReset().mockReturnValue({
      upload: mocks.upload,
      getPublicUrl: mocks.getPublicUrl,
    })
  })

  it('forwards immutable WebP metadata for a normalized product', async () => {
    const file = new File(['webp'], 'product.webp', { type: 'image/webp' })

    await uploadFile('product-images', 'products/id.webp', file, {
      upsert: false,
      cacheControl: '31536000',
      contentType: 'image/webp',
    })

    expect(mocks.upload).toHaveBeenCalledWith('products/id.webp', file, {
      upsert: false,
      cacheControl: '31536000',
      contentType: 'image/webp',
    })
  })

  it('preserves caller-provided upload values', async () => {
    const file = new File(['svg'], 'logo.svg', { type: 'image/svg+xml' })

    await uploadFile('product-images', 'logos/id.svg', file, {
      upsert: true,
      cacheControl: '60',
      contentType: 'image/svg+xml',
    })

    expect(mocks.upload).toHaveBeenCalledWith('logos/id.svg', file, {
      upsert: true,
      cacheControl: '60',
      contentType: 'image/svg+xml',
    })
  })

  it('forwards metadata fields to the existing server fallback request', async () => {
    const file = new File(['webp'], 'product.webp', { type: 'image/webp' })
    mocks.upload.mockResolvedValue({ error: { message: 'RLS rejected upload' } })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Bucket no permitido.' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    ))

    await uploadFile('product-images', 'products/id.webp', file, {
      upsert: false,
      cacheControl: '31536000',
      contentType: 'image/webp',
    })

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(body.get('cacheControl')).toBe('31536000')
    expect(body.get('contentType')).toBe('image/webp')
    expect(body.get('upsert')).toBe('false')
    fetchMock.mockRestore()
  })
})
