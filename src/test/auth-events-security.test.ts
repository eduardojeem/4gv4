import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateCheck: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/rate-limiter', () => ({
  getClientIp: () => '203.0.113.10',
  rateLimiter: { check: mocks.rateCheck },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ rpc: mocks.rpc }),
}))

import { POST } from '@/app/api/security/auth-events/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('https://example.com/api/security/auth-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('seguridad de auth-events', () => {
  beforeEach(() => {
    mocks.rateCheck.mockReset().mockResolvedValue(true)
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null })
    mocks.rpc.mockReset().mockResolvedValue({ data: 'event-id', error: null })
  })

  it('rechaza con 429 cuando el limite distribuido se agota', async () => {
    mocks.rateCheck.mockResolvedValue(false)

    const response = await POST(request({ action: 'login_failed', success: false }))

    expect(response.status).toBe(429)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('solo permite login_failed sin sesion', async () => {
    const response = await POST(request({ action: 'role_change', userId: 'spoofed' }))

    expect(response.status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('registra fallos de login anonimos sin aceptar un userId del cliente', async () => {
    const response = await POST(request({ action: 'login_failed', userId: 'spoofed', success: false }))

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('log_auth_event', expect.objectContaining({ p_user_id: null }))
  })

  it('atribuye eventos autenticados a la sesion real', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'real-user' } }, error: null })

    const response = await POST(request({ action: 'role_change', userId: 'spoofed' }))

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('log_auth_event', expect.objectContaining({ p_user_id: 'real-user' }))
  })
})
