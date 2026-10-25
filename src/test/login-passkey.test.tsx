import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

const push = vi.fn()
const signInWithPasskey = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPasskey, signInWithPassword, resend: vi.fn(), resetPasswordForEmail: vi.fn() },
  }),
}))

vi.mock('@/lib/auth-event-client', () => ({ logAuthEventClient: vi.fn() }))

vi.mock('@/hooks/use-platform-branding', () => ({
  usePlatformBranding: () => ({
    branding: { platformName: 'Plataforma', marketplaceName: 'Marketplace', marketplaceTagline: '' },
  }),
}))

vi.mock('@/components/security/TurnstileChallenge', () => ({
  TurnstileChallenge: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange('captcha-ok')}>
      Verificar captcha
    </button>
  ),
}))

vi.mock('@/components/public/saas-public-nav', () => ({ SaaSPublicNav: () => <nav /> }))

const PASSKEY_BUTTON = /Ingresar con huella o Face ID/i

function enableWebAuthn() {
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {})
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: vi.fn(), get: vi.fn() },
  })
}

function apiError(code: string) {
  return Object.assign(new Error(code), { code, name: 'AuthApiError' })
}

async function clickPasskey() {
  fireEvent.click(screen.getByRole('button', { name: /Verificar captcha/i }))
  fireEvent.click(await screen.findByRole('button', { name: PASSKEY_BUTTON }))
}

describe('login del panel con passkey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // jsdom no trae `navigator.credentials`; se saca lo que agregó el test.
    delete (navigator as unknown as Record<string, unknown>).credentials
  })

  it('no muestra el botón si el navegador no soporta WebAuthn', () => {
    render(<LoginPage />)
    expect(screen.queryByRole('button', { name: PASSKEY_BUTTON })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Iniciar sesión/i })).toBeInTheDocument()
  })

  it('espera el captcha antes de habilitar el botón', async () => {
    enableWebAuthn()
    render(<LoginPage />)
    expect(await screen.findByRole('button', { name: PASSKEY_BUTTON })).toBeDisabled()
  })

  it('ingresa con la passkey, manda el captcha y redirige al panel', async () => {
    enableWebAuthn()
    signInWithPasskey.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null })
    render(<LoginPage />)

    await clickPasskey()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
    expect(signInWithPasskey).toHaveBeenCalledWith({ options: { captchaToken: 'captcha-ok' } })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('challenge vencido: pide reintentar y no entra', async () => {
    enableWebAuthn()
    signInWithPasskey.mockResolvedValue({ data: { user: null, session: null }, error: apiError('webauthn_challenge_expired') })
    render(<LoginPage />)

    await clickPasskey()

    expect(await screen.findByRole('alert')).toHaveTextContent('La solicitud venció. Intentá de nuevo.')
    expect(push).not.toHaveBeenCalled()
  })

  it('credencial desconocida: sugiere ingresar con contraseña', async () => {
    enableWebAuthn()
    signInWithPasskey.mockResolvedValue({ data: { user: null, session: null }, error: apiError('webauthn_credential_not_found') })
    render(<LoginPage />)

    await clickPasskey()

    expect(await screen.findByRole('alert')).toHaveTextContent(/no está registrada en ninguna cuenta/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('verificación fallida (firma o contador inválido): no entra', async () => {
    enableWebAuthn()
    signInWithPasskey.mockResolvedValue({ data: { user: null, session: null }, error: apiError('webauthn_verification_failed') })
    render(<LoginPage />)

    await clickPasskey()

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos verificar la passkey/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('si la persona cancela el diálogo del sistema no muestra error', async () => {
    enableWebAuthn()
    const cancelled = Object.assign(new Error('cancelado'), {
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      cause: Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    })
    signInWithPasskey.mockResolvedValue({ data: { user: null, session: null }, error: cancelled })
    render(<LoginPage />)

    await clickPasskey()

    await waitFor(() => expect(signInWithPasskey).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
