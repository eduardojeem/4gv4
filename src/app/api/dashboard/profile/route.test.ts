import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  maybeSingle: vi.fn(),
  updatedSingle: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })) })),
      update: mocks.update,
    })),
  })),
}))

const user = { id: 'user-1', email: 'ana@example.com', email_confirmed_at: '2026-09-27T10:00:00Z' }
const row = { id: 'user-1', full_name: 'Ana', role: 'cliente', preferences: {}, social_links: {} }

describe('/api/dashboard/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user }, error: null })
    mocks.maybeSingle.mockResolvedValue({ data: row, error: null })
    mocks.updatedSingle.mockResolvedValue({ data: { ...row, full_name: 'Ana Pérez' }, error: null })
    mocks.updateUser.mockResolvedValue({ data: { user }, error: null })
    mocks.eq.mockReturnValue({ select: vi.fn(() => ({ maybeSingle: mocks.updatedSingle })) })
    mocks.update.mockImplementation(() => ({ eq: mocks.eq }))
  })

  it('rejects unauthenticated GET and PATCH requests', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET, PATCH } = await import('./route')
    expect((await GET()).status).toBe(401)
    expect((await PATCH(new Request('http://localhost/api/dashboard/profile', { method: 'PATCH', body: '{}' }))).status).toBe(401)
  })

  it('returns the authenticated user own profile', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(200)
    expect((await response.json()).profile).toEqual(expect.objectContaining({ id: 'user-1', email: 'ana@example.com' }))
  })

  it('rejects privileged, target-user, and mixed unknown fields', async () => {
    const { PATCH } = await import('./route')
    for (const body of [{ role: 'super_admin' }, { id: 'user-2', bio: 'Hola' }, { fullName: 'Ana', status: 'active' }]) {
      const response = await PATCH(new Request('http://localhost/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify(body) }))
      expect(response.status).toBe(400)
    }
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('updates only the authenticated row and returns authoritative data', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/dashboard/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: ' Ana Pérez ' }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Ana Pérez' }))
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ana Pérez' } })
    expect((await response.json()).profile.fullName).toBe('Ana Pérez')
  })

  it('does not update Auth after a database failure', async () => {
    mocks.updatedSingle.mockResolvedValue({ data: null, error: { message: 'db failed' } })
    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify({ bio: 'Hola' }) }))
    expect(response.status).toBe(500)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('reports partial synchronization when Auth metadata fails', async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { message: 'auth failed' } })
    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify({ fullName: 'Ana Pérez' }) }))
    expect(response.status).toBe(207)
    expect(await response.json()).toEqual(expect.objectContaining({ partial: true }))
  })
})
