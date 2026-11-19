import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyRecoveryError,
  describePasswordUpdateError,
  establishRecoverySession,
  readRecoveryParams,
  stripRecoveryParams,
} from '@/lib/auth/recovery-link'
import { validatePassword } from '@/lib/auth/password-validation'

/**
 * El enlace de recuperación llegaba como `?code=<uuid>&next=/dashboard`. Ese
 * código PKCE sólo se canjea con el `code_verifier` que guardó el navegador que
 * pidió el correo: abierto en el celular, en otro navegador o dentro de Gmail,
 * la página veía «sin sesión», mostraba «inválido o expirado» y a los dos
 * segundos mandaba al login. La persona nunca podía cambiar la contraseña.
 */

const BASE = 'https://www.mitiendapy.com/auth/reset-password'

type AuthMock = {
  initialize: ReturnType<typeof vi.fn>
  getSession: ReturnType<typeof vi.fn>
  verifyOtp: ReturnType<typeof vi.fn>
  setSession: ReturnType<typeof vi.fn>
}

const session = { access_token: 'a', refresh_token: 'r', user: { email: 'ana@tienda.com' } }

function authMock(overrides: Partial<Record<keyof AuthMock, unknown>> = {}): AuthMock {
  return {
    initialize: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session, user: session.user }, error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    ...overrides,
  } as AuthMock
}

const establish = (auth: AuthMock, href: string, hrefAfterInit?: string) =>
  establishRecoverySession(
    auth as unknown as Parameters<typeof establishRecoverySession>[0],
    href,
    () => hrefAfterInit ?? href
  )

describe('readRecoveryParams', () => {
  it('lee query y hash', () => {
    const p = readRecoveryParams(`${BASE}?code=abc&next=%2Fdashboard#access_token=t&refresh_token=r`)
    expect(p.code).toBe('abc')
    expect(p.accessToken).toBe('t')
    expect(p.refreshToken).toBe('r')
  })

  it('lee el error que Supabase pone en el hash', () => {
    const p = readRecoveryParams(`${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)
    expect(p.errorCode).toBe('otp_expired')
    expect(p.errorDescription).toMatch(/expired/)
  })
})

describe('establishRecoverySession', () => {
  it('PKCE en el mismo navegador: usa la sesión que ya canjeó el SDK', async () => {
    // El SDK canjeó el código y lo sacó de la URL.
    const auth = authMock({ getSession: vi.fn().mockResolvedValue({ data: { session } }) })
    await expect(establish(auth, `${BASE}?code=abc&next=%2Fdashboard`, `${BASE}?next=%2Fdashboard`)).resolves.toEqual({ ok: true, email: 'ana@tienda.com' })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('no acepta una sesión vieja del navegador cuando el código no se canjeó', async () => {
    // Era el error de producción: la página usaba la sesión de antes y
    // Supabase rechazaba el cambio con `reauthentication_needed`.
    const auth = authMock({ getSession: vi.fn().mockResolvedValue({ data: { session } }) })
    await expect(establish(auth, `${BASE}?code=abc&next=%2Fdashboard`)).resolves.toEqual({ ok: false, reason: 'other-browser' })
  })

  it('con sesión vieja y token_hash, verifica el enlace en vez de usar la sesión', async () => {
    const auth = authMock({ getSession: vi.fn().mockResolvedValue({ data: { session: { ...session, user: { email: 'otra@tienda.com' } } } }) })
    await expect(establish(auth, `${BASE}?token_hash=th123&type=recovery`)).resolves.toEqual({ ok: true, email: 'ana@tienda.com' })
    expect(auth.verifyOtp).toHaveBeenCalled()
  })

  it('PKCE abierto en otro navegador: lo dice en vez de «expirado»', async () => {
    // Sin verificador el SDK no intenta el canje: no hay error ni sesión.
    const auth = authMock()
    await expect(establish(auth, `${BASE}?code=abc&next=%2Fdashboard`)).resolves.toEqual({ ok: false, reason: 'other-browser' })
  })

  it('PKCE con código ya usado o vencido: usa el error real del canje', async () => {
    const auth = authMock({
      initialize: vi.fn().mockResolvedValue({ error: { code: 'flow_state_not_found', message: 'invalid flow state, no valid flow state found' } }),
    })
    await expect(establish(auth, `${BASE}?code=abc`)).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('token_hash: verifica con verifyOtp y funciona en cualquier navegador', async () => {
    const auth = authMock()
    await expect(establish(auth, `${BASE}?token_hash=th123&type=recovery&next=%2Fdashboard`)).resolves.toEqual({ ok: true, email: 'ana@tienda.com' })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'th123', type: 'recovery' })
  })

  it('token_hash vencido', async () => {
    const auth = authMock({
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } }),
    })
    await expect(establish(auth, `${BASE}?token_hash=th123&type=recovery`)).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('no acepta un token_hash de otro tipo', async () => {
    const auth = authMock()
    await expect(establish(auth, `${BASE}?token_hash=th123&type=signup`)).resolves.toEqual({ ok: false, reason: 'expired' })
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('implícito (pedido desde el servidor o la app): tokens en el hash', async () => {
    const auth = authMock({ initialize: vi.fn().mockResolvedValue({ error: { message: 'Not a valid PKCE flow url.' } }) })
    await expect(establish(auth, `${BASE}#access_token=t&refresh_token=r&type=recovery`)).resolves.toEqual({ ok: true, email: 'ana@tienda.com' })
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 't', refresh_token: 'r' })
  })

  it('Supabase ya rechazó el enlace', async () => {
    const auth = authMock()
    await expect(establish(auth, `${BASE}?error=access_denied&error_code=otp_expired`)).resolves.toEqual({ ok: false, reason: 'expired' })
    expect(auth.initialize).not.toHaveBeenCalled()
  })

  it('sin datos de recuperación', async () => {
    await expect(establish(authMock(), BASE)).resolves.toEqual({ ok: false, reason: 'missing' })
  })
})

describe('classifyRecoveryError', () => {
  it('distingue verificador faltante de enlace vencido', () => {
    expect(classifyRecoveryError({ name: 'AuthPKCECodeVerifierMissingError', message: 'PKCE code verifier not found in storage.' })).toBe('other-browser')
    expect(classifyRecoveryError({ code: 'bad_code_verifier' })).toBe('other-browser')
    expect(classifyRecoveryError({ code: 'otp_expired' })).toBe('expired')
    expect(classifyRecoveryError({ message: 'Failed to fetch' })).toBe('unknown')
  })
})

describe('stripRecoveryParams', () => {
  it('saca el código de un solo uso y conserva next', () => {
    expect(stripRecoveryParams(`${BASE}?code=abc&sb_flow_id=x&next=%2Fdashboard#access_token=t`)).toBe('/auth/reset-password?next=%2Fdashboard')
  })
})

describe('describePasswordUpdateError', () => {
  it('cada error de updateUser dice qué hacer', () => {
    expect(describePasswordUpdateError({ name: 'AuthSessionMissingError', message: 'Auth session missing!' }).kind).toBe('session')
    expect(describePasswordUpdateError({ code: 'reauthentication_needed', message: 'Password update requires reauthentication' }).kind).toBe('reauth')
    expect(describePasswordUpdateError({ code: 'reauthentication_not_valid', message: 'Invalid nonce' }).kind).toBe('bad-nonce')
    expect(describePasswordUpdateError({ code: 'same_password', message: 'New password should be different from the old password.' }).kind).toBe('same-password')
    expect(describePasswordUpdateError({ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }).kind).toBe('weak')
    expect(describePasswordUpdateError({ code: 'insufficient_aal', message: 'AAL2 session is required' }).kind).toBe('mfa')
    expect(describePasswordUpdateError({ message: 'For security purposes, you can only request this after 30 seconds' }).kind).toBe('rate-limit')
    expect(describePasswordUpdateError({ message: 'Failed to fetch' }).kind).toBe('network')
  })

  it('weak_password usa sus reasons', () => {
    const pwned = describePasswordUpdateError({ code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.', reasons: ['pwned'] } as never)
    expect(pwned.kind).toBe('weak')
    expect(pwned.message).toMatch(/filtraciones/)
    const length = describePasswordUpdateError({ code: 'weak_password', message: 'Password should be at least 8 characters.', reasons: ['length'] } as never)
    expect(length.message).toMatch(/requisitos/)
  })

  it('un error desconocido muestra su código para soporte', () => {
    expect(describePasswordUpdateError({ code: 'unexpected_failure', message: 'boom' }).message).toContain('unexpected_failure')
  })

  it('nunca muestra el texto original en inglés', () => {
    for (const message of ['Auth session missing!', 'New password should be different from the old password.', 'boom']) {
      expect(describePasswordUpdateError({ message }).message).not.toContain(message)
    }
  })
})

describe('validatePassword', () => {
  it('rechaza contraseñas de más de 72 bytes (límite de Supabase)', () => {
    expect(validatePassword('Aa1' + 'x'.repeat(69))).toBeNull()
    expect(validatePassword('Aa1' + 'x'.repeat(70))).toMatch(/72/)
    expect(validatePassword('Aa1' + 'ñ'.repeat(35))).toMatch(/72/)
  })
})

// ---------------------------------------------------------------------------
// La página
// ---------------------------------------------------------------------------

const routerMock = { push: vi.fn(), replace: vi.fn() }
let searchParams = new URLSearchParams('next=%2Fdashboard')
const auth = {
  ...authMock(),
  updateUser: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParams,
}))
// Cliente nuevo en cada llamada a propósito: la página no debe depender de que sea singleton.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }))
vi.mock('@/hooks/use-platform-branding', () => ({
  usePlatformBranding: () => ({ branding: { platformName: 'MiTiendaPy', logoUrl: null } }),
}))
vi.mock('@/lib/auth/mfa-client', () => ({ loadMfaState: vi.fn().mockResolvedValue({ pending: false }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => true,
}))

const { default: ResetPasswordContent } = await import('@/app/auth/reset-password/ResetPasswordContent')

function visit(path: string) {
  window.history.replaceState(null, '', path)
  searchParams = new URLSearchParams(window.location.search)
}

describe('ResetPasswordContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(auth, authMock())
    auth.updateUser = vi.fn().mockResolvedValue({ data: {}, error: null })
    auth.signOut = vi.fn().mockResolvedValue({ error: null })
  })

  it('enlace abierto en otro navegador: explica y ofrece pedir uno nuevo, sin redirigir solo', async () => {
    visit('/auth/reset-password?code=11111111-1111-1111-1111-111111111111&next=%2Fdashboard')
    render(<ResetPasswordContent />)

    expect(await screen.findByText('Abrí el enlace en el mismo navegador')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /pedir un enlace nuevo/i })).toHaveAttribute('href', '/login?recuperar=1&redirect=%2Fdashboard')
    expect(screen.getByRole('button', { name: /copiar este enlace/i })).toBeInTheDocument()
    expect(routerMock.push).not.toHaveBeenCalled()
  })

  it('con sesión válida: valida en vivo, guarda y cierra las otras sesiones', async () => {
    auth.getSession = vi.fn().mockResolvedValue({ data: { session } })
    visit('/auth/reset-password?token_hash=th123&type=recovery&next=%2Fdashboard')
    const user = userEvent.setup()
    render(<ResetPasswordContent />)

    const nueva = await screen.findByLabelText('Nueva contraseña')
    expect(screen.getByText('ana@tienda.com')).toBeInTheDocument()
    // El token de un solo uso sale de la barra de direcciones.
    expect(window.location.search).toBe('?next=%2Fdashboard')

    const guardar = screen.getByRole('button', { name: /guardar contraseña/i })
    await user.type(nueva, 'corta')
    expect(guardar).toBeDisabled()

    await user.clear(nueva)
    // Pegar funciona igual que escribir.
    await user.click(nueva)
    await user.paste('Segura123')
    expect(nueva).toHaveValue('Segura123')
    const repetir = screen.getByLabelText('Repetí la contraseña')
    await user.type(repetir, 'Segura12')
    await user.tab()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    await user.type(repetir, '3')
    expect(screen.getByText('Las contraseñas coinciden.')).toBeInTheDocument()
    await user.click(guardar)

    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Segura123' }))
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' })
    expect(await screen.findByText('¡Listo, contraseña cambiada!')).toBeInTheDocument()
  })

  it('misma contraseña que antes: lo dice en castellano', async () => {
    auth.getSession = vi.fn().mockResolvedValue({ data: { session } })
    auth.updateUser = vi.fn().mockResolvedValue({
      data: {},
      error: { code: 'same_password', message: 'New password should be different from the old password.' },
    })
    visit('/auth/reset-password?next=%2Fdashboard')
    const user = userEvent.setup()
    render(<ResetPasswordContent />)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Segura123')
    await user.type(screen.getByLabelText('Repetí la contraseña'), 'Segura123')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    const alerta = await screen.findByText('La nueva contraseña tiene que ser distinta de la que tenías.')
    expect(alerta).toBeInTheDocument()
    // El error queda asociado a los campos para lectores de pantalla.
    const errorId = alerta.closest('[role="alert"]')?.id
    expect(errorId).toBeTruthy()
    expect(screen.getByLabelText('Nueva contraseña').getAttribute('aria-describedby')).toContain(errorId)
  })

  it('la sesión vence mientras completa el formulario: pasa a pedir enlace nuevo', async () => {
    auth.getSession = vi.fn().mockResolvedValue({ data: { session } })
    auth.updateUser = vi.fn().mockResolvedValue({ data: {}, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } })
    visit('/auth/reset-password?next=%2Fdashboard')
    const user = userEvent.setup()
    render(<ResetPasswordContent />)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Segura123')
    await user.type(screen.getByLabelText('Repetí la contraseña'), 'Segura123')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText('El enlace venció o ya se usó')).toBeInTheDocument()
  })

  it('Supabase pide reautenticación: manda el código y cambia la contraseña con él', async () => {
    auth.getSession = vi.fn().mockResolvedValue({ data: { session } })
    auth.updateUser = vi.fn()
      .mockResolvedValueOnce({ data: {}, error: { code: 'reauthentication_needed', message: 'Password update requires reauthentication' } })
      .mockResolvedValueOnce({ data: {}, error: null })
    const reauthenticate = vi.fn().mockResolvedValue({ data: {}, error: null })
    Object.assign(auth, { reauthenticate })
    visit('/auth/reset-password?next=%2Fdashboard')
    const user = userEvent.setup()
    render(<ResetPasswordContent />)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Segura123')
    await user.type(screen.getByLabelText('Repetí la contraseña'), 'Segura123')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    const codigo = await screen.findByLabelText('Código de verificación')
    expect(reauthenticate).toHaveBeenCalledTimes(1)
    const guardar = screen.getByRole('button', { name: /guardar contraseña/i })
    expect(guardar).toBeDisabled()

    await user.type(codigo, '12a3456')
    expect(codigo).toHaveValue('123456')
    await user.click(guardar)

    await waitFor(() => expect(auth.updateUser).toHaveBeenLastCalledWith({ password: 'Segura123', nonce: '123456' }))
    expect(await screen.findByText('¡Listo, contraseña cambiada!')).toBeInTheDocument()
  })
})
