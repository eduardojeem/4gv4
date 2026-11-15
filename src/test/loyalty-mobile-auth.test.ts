// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), bearer: vi.fn(), cookies: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.client }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/supabase/server', () => ({ getRequestBearerToken: mocks.bearer }))
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture-key')
  vi.clearAllMocks()
  mocks.cookies.mockResolvedValue({ getAll: () => [] })
  mocks.client.mockReturnValue({})
})
it('conserva el token móvil y usa exclusivamente la organización validada', async () => {
  mocks.bearer.mockResolvedValue('fixture-token')
  await createOrgScopedClient('validated-org')
  expect(mocks.client).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      global: {
        headers: { Authorization: 'Bearer fixture-token', 'x-organization-id': 'validated-org' },
      },
    }),
  )
})
it('mantiene el flujo web por cookies sin inventar un token', async () => {
  mocks.bearer.mockResolvedValue(null)
  await createOrgScopedClient('validated-org')
  expect(mocks.client.mock.calls[0][2].global.headers).toEqual({
    'x-organization-id': 'validated-org',
  })
})
