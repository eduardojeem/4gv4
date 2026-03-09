import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({
  requireStaff: vi.fn(async () => ({
    authenticated: true,
    user: { id: 'test-user' },
    role: 'admin',
  })),
  getAuthResponse: vi.fn(() => null),
}))

describe('PATCH /api/repairs/:id/status', () => {
  it('returns ok and normalizes stage in demo mode', async () => {
    const { PATCH } = await import('./route')
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const req = { json: async () => ({ stage: 'ready' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'K-001' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.id).toBe('K-001')
    expect(data.stage).toBe('listo')
  })
})
