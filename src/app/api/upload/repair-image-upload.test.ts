import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ authenticated: true, user: { id: 'user-1' } })),
  getAuthResponse: vi.fn(() => null),
}))

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: vi.fn(async () => ({ id: 'org-1' })),
}))

vi.mock('@/lib/saas/subscription-service', () => ({
  getOrganizationPlanInfo: vi.fn(async () => ({ code: 'enterprise', name: 'Enterprise' })),
}))

vi.mock('@/lib/saas/plan-features', () => ({ repairPhotoLimit: vi.fn(() => 20) }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: vi.fn(() => ({ storage: { from: mocks.from } })),
}))

import { POST } from './route'

function uploadRequest(bucket = 'repair-images') {
  const file = {
    type: 'image/jpeg',
    size: 5,
    arrayBuffer: vi.fn(async () => new TextEncoder().encode('image').buffer),
  } as unknown as File
  const values = new Map<string, FormDataEntryValue>([
    ['file', file],
    ['bucket', bucket],
    ['path', 'repairs/repair-1/photo.jpg'],
  ])

  return {
    formData: vi.fn(async () => ({ get: (key: string) => values.get(key) ?? null })),
  } as unknown as Request
}

describe('POST /api/upload for repair images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upload.mockResolvedValue({ data: { path: 'repairs/repair-1/photo.jpg' }, error: null })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/repair-images/preview' },
      error: null,
    })
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://public.example/photo.jpg' } })
    mocks.remove.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue({
      upload: mocks.upload,
      createSignedUrl: mocks.createSignedUrl,
      getPublicUrl: mocks.getPublicUrl,
      remove: mocks.remove,
    })
  })

  it('returns an authoritative path and a temporary signed preview', async () => {
    const response = await POST(uploadRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      path: 'repairs/repair-1/photo.jpg',
      url: 'https://example.supabase.co/storage/v1/object/sign/repair-images/preview',
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('repairs/repair-1/photo.jpg', 300)
    expect(mocks.getPublicUrl).not.toHaveBeenCalled()
  })

  it('fails closed and removes the uploaded object when preview signing fails', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('signing failed') })

    const response = await POST(uploadRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'No se pudo proteger la imagen subida.' })
    expect(mocks.getPublicUrl).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith(['repairs/repair-1/photo.jpg'])
  })

  it('keeps public buckets on permanent public URLs', async () => {
    const response = await POST(uploadRequest('product-images'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      path: 'repairs/repair-1/photo.jpg',
      url: 'https://public.example/photo.jpg',
    })
    expect(mocks.getPublicUrl).toHaveBeenCalledWith('repairs/repair-1/photo.jpg')
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })
})
