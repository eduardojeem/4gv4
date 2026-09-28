import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  getOrganization: vi.fn(),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ authenticated: true, user: { id: 'user-1' } })),
  getAuthResponse: vi.fn(() => null),
}))

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: mocks.getOrganization,
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
    mocks.getOrganization.mockResolvedValue({ id: 'org-1' })
    mocks.upload.mockImplementation(async (path: string) => ({ data: { path }, error: null }))
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
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      url: 'https://example.supabase.co/storage/v1/object/sign/repair-images/preview',
    })
    expect(body.path).toMatch(/^organizations\/org-1\/repair-images\/user-1\/[0-9a-f-]+-photo[.]jpg$/)
    expect(mocks.upload).toHaveBeenCalledWith(
      body.path,
      expect.any(Buffer),
      expect.objectContaining({ upsert: false }),
    )
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(body.path, 300)
    expect(mocks.getPublicUrl).not.toHaveBeenCalled()
  })

  it('fails closed and removes the uploaded object when preview signing fails', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('signing failed') })

    const response = await POST(uploadRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'No se pudo proteger la imagen subida.' })
    expect(mocks.getPublicUrl).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^organizations\/org-1\/repair-images\/user-1\//),
    ])
  })

  it('rejects public buckets before invoking the service-role storage client', async () => {
    const response = await POST(uploadRequest('product-images'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid bucket' })
    expect(mocks.getOrganization).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('rejects repair uploads when no active organization can be resolved', async () => {
    mocks.getOrganization.mockResolvedValue(null)

    const response = await POST(uploadRequest())

    expect(response.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
