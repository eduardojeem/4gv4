import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  superAdmin: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: mocks.superAdmin }))
vi.mock('@/lib/superadmin/audit', () => ({ logSuperAdminAction: mocks.audit }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { features: { otro: true } }, error: null }) }) }),
      update: (values: { features: unknown }) => {
        mocks.update(values)
        return { eq: () => ({ select: () => ({ single: async () => ({ data: { features: values.features, updated_at: 'ahora', updated_by: 'sa' }, error: null }) }) }) }
      },
    }),
  }),
}))

import { PUT } from './route'
import { DEFAULT_PLATFORM_BRANDING } from '@/lib/platform/branding'

function put(branding: Record<string, unknown>) {
  return PUT(new Request('http://localhost/api/superadmin/platform-branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branding: { ...DEFAULT_PLATFORM_BRANDING, ...branding } }),
  }) as never)
}

afterEach(() => vi.clearAllMocks())

describe('PUT /api/superadmin/platform-branding', () => {
  it('guarda el alto exacto del logo y el contacto de soporte', async () => {
    mocks.superAdmin.mockResolvedValue({ id: 'sa', email: 'sa@test', role: 'super_admin' })
    const response = await put({
      logoHeightPx: 72,
      supportEmail: 'Ayuda@MiTiendaPy.com',
      supportWhatsapp: '+595 981 123-456',
      supportHours: 'Lunes a viernes, 8 a 18 h',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.branding).toMatchObject({
      logoHeightPx: 72,
      supportEmail: 'ayuda@mitiendapy.com',
      supportWhatsapp: '+595981123456',
      supportHours: 'Lunes a viernes, 8 a 18 h',
    })
    const saved = mocks.update.mock.calls[0][0].features as Record<string, unknown>
    expect(saved.otro).toBe(true)
    expect(saved.saas_branding).toMatchObject({ logoHeightPx: 72, supportWhatsapp: '+595981123456' })
  })

  it('rechaza un WhatsApp sin código de país o un correo inválido', async () => {
    mocks.superAdmin.mockResolvedValue({ id: 'sa', email: 'sa@test', role: 'super_admin' })

    const whatsapp = await put({ supportWhatsapp: '0981123456' })
    expect(whatsapp.status).toBe(400)
    expect((await whatsapp.json()).error).toContain('código de país')

    const email = await put({ supportEmail: 'soporte' })
    expect(email.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('solo el superadmin puede cambiarlo', async () => {
    mocks.superAdmin.mockResolvedValue(null)
    expect((await put({ supportEmail: 'a@b.com' })).status).toBe(403)
  })
})
