import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyPublicToken: vi.fn(),
  from: vi.fn(),
  repairEq: vi.fn(),
  imageEq: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/lib/public-session', () => ({ verifyPublicToken: mocks.verifyPublicToken }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: vi.fn(() => ({
    from: mocks.from,
    storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) },
  })),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { GET } from './images/route'

const repairBuilder = {
  select: vi.fn(),
  eq: mocks.repairEq,
  single: vi.fn(),
}
repairBuilder.select.mockReturnValue(repairBuilder)
mocks.repairEq.mockReturnValue(repairBuilder)

const imageResult = {
  data: [{ id: 'image-1', image_url: 'repairs/repair-1/photo.jpg', description: null, created_at: '2026-01-01' }],
  error: null,
}
const imageBuilder = {
  select: vi.fn(),
  eq: mocks.imageEq,
  order: vi.fn(async () => imageResult),
}
imageBuilder.select.mockReturnValue(imageBuilder)
mocks.imageEq.mockReturnValue(imageBuilder)

function requestWithToken() {
  return { cookies: { get: vi.fn(() => ({ value: 'public-token' })) } } as never
}

describe('public repair image authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repairBuilder.select.mockReturnValue(repairBuilder)
    mocks.repairEq.mockReturnValue(repairBuilder)
    repairBuilder.single.mockResolvedValue({
      data: { id: 'repair-1', organization_id: 'org-1' },
      error: null,
    })
    imageBuilder.select.mockReturnValue(imageBuilder)
    mocks.imageEq.mockReturnValue(imageBuilder)
    imageBuilder.order.mockResolvedValue(imageResult)
    mocks.from.mockImplementation((table: string) => (
      table === 'repairs' ? repairBuilder : imageBuilder
    ))
    mocks.verifyPublicToken.mockResolvedValue({
      repairId: 'repair-1',
      organizationId: 'org-1',
      ticketNumber: 'TICKET-1',
    })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo' },
      error: null,
    })
  })

  it('signs images only after matching repair, ticket and organization', async () => {
    const response = await GET(requestWithToken(), {
      params: Promise.resolve({ ticketId: 'TICKET-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [{
        id: 'image-1',
        image_url: 'https://signed.example/photo',
        description: null,
        created_at: '2026-01-01',
      }],
    })
    expect(mocks.repairEq).toHaveBeenCalledWith('id', 'repair-1')
    expect(mocks.repairEq).toHaveBeenCalledWith('ticket_number', 'TICKET-1')
    expect(mocks.repairEq).toHaveBeenCalledWith('organization_id', 'org-1')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('repairs/repair-1/photo.jpg', 300)
  })

  it('denies a valid token when it is used for another ticket', async () => {
    const response = await GET(requestWithToken(), {
      params: Promise.resolve({ ticketId: 'TICKET-OTHER' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })
})
