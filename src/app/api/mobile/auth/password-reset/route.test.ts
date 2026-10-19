import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const check = vi.fn()
vi.mock('@/lib/rate-limiter', () => ({
  rateLimiter: { check: (...args: unknown[]) => check(...args) },
  getClientIp: () => '1.2.3.4',
}))

import { POST } from './route'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/mobile/auth/password-reset', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/mobile/auth/password-reset', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.mitiendapy.com')
    vi.stubGlobal('fetch', fetchMock)
    check.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    check.mockReset()
  })

  it('pide el correo con la clave de servicio y el enlace a la página web de restablecer', async () => {
    fetchMock.mockResolvedValue(new Response('{}'))
    const res = await POST(request({ email: ' Juan@Mail.com ' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proj.supabase.co/auth/v1/recover?redirect_to=' + encodeURIComponent('https://www.mitiendapy.com/auth/reset-password'))
    expect(init.headers.Authorization).toBe('Bearer service-key')
    expect(JSON.parse(init.body)).toEqual({ email: 'juan@mail.com' })
  })

  it('responde igual cuando el email no existe', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_code: 'user_not_found' }), { status: 404 }))
    const res = await POST(request({ email: 'nadie@b.com' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('avisa cuando Supabase limita el envío de correos', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_code: 'over_email_send_rate_limit' }), { status: 429 }))
    const res = await POST(request({ email: 'a@b.com' }))
    expect(res.status).toBe(429)
  })

  it('informa el fallo si Supabase rechaza el pedido por otro motivo', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_code: 'unexpected_failure' }), { status: 500 }))
    const res = await POST(request({ email: 'a@b.com' }))
    expect(res.status).toBe(502)
  })

  it('corta con 429 cuando se pasa el límite de pedidos', async () => {
    check.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const res = await POST(request({ email: 'a@b.com' }))
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no envía nada si el limitador compartido no responde', async () => {
    check.mockRejectedValueOnce(new Error('limiter unavailable'))
    const res = await POST(request({ email: 'a@b.com' }))
    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza un email inválido sin llamar a Supabase', async () => {
    const res = await POST(request({ email: 'no-es-email' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
