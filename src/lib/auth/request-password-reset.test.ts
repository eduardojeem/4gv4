import { beforeEach, describe, expect, it, vi } from 'vitest'

const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null })
const createClient = vi.fn(() => ({ auth: { resetPasswordForEmail } }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

/**
 * El enlace PKCE (`?code=`) dependía de un `code_verifier` en una cookie que
 * auth-js borra al cerrar cualquier sesión: el enlace fallaba incluso en el
 * mismo navegador. El pedido sale ahora por el flujo implícito.
 */
describe('requestPasswordResetEmail', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  })

  it('usa un cliente implícito que no guarda sesión ni toca la del usuario', async () => {
    const { requestPasswordResetEmail } = await import('@/lib/auth/request-password-reset')
    await requestPasswordResetEmail('ana@tienda.com', { redirectTo: 'https://www.mitiendapy.com/auth/reset-password?next=%2Fdashboard', captchaToken: 'tok' })

    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon', {
      auth: expect.objectContaining({
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }),
    })
    const options = (createClient.mock.calls[0] as unknown[])[2] as { auth: { storageKey: string } }
    expect(options.auth.storageKey).not.toMatch(/^sb-[a-z0-9]+-auth-token$/)
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@tienda.com', {
      redirectTo: 'https://www.mitiendapy.com/auth/reset-password?next=%2Fdashboard',
      captchaToken: 'tok',
    })
  })

  it('sin captcha no manda el campo', async () => {
    const { requestPasswordResetEmail } = await import('@/lib/auth/request-password-reset')
    await requestPasswordResetEmail('ana@tienda.com', { redirectTo: 'https://x/auth/reset-password' })
    expect(resetPasswordForEmail).toHaveBeenLastCalledWith('ana@tienda.com', { redirectTo: 'https://x/auth/reset-password' })
  })

  it('ningún formulario web pide el correo con el cliente PKCE de la sesión', async () => {
    const { readFileSync } = await import('node:fs')
    for (const ruta of [
      'src/app/login/page.tsx',
      'src/app/[organizationSlug]/cliente/login/login-client.tsx',
      'src/components/public/AuthModal.tsx',
    ]) {
      const fuente = readFileSync(ruta, 'utf8')
      expect(fuente).not.toContain('supabase.auth.resetPasswordForEmail(')
      expect(fuente).toContain('requestPasswordResetEmail(')
    }
  })
})
