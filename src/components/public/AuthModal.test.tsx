import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthModal } from './AuthModal'

const resetPasswordForEmail = vi.fn()
const signInWithPassword = vi.fn()
const routerPush = vi.fn()
const routerRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/marketplace',
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      resetPasswordForEmail,
    },
  }),
}))

vi.mock('@/components/security/TurnstileChallenge', () => ({
  TurnstileChallenge: ({
    action,
    onTokenChange,
  }: {
    action: string
    onTokenChange: (token: string) => void
  }) => (
    <button type="button" onClick={() => onTokenChange(`${action}-token`)}>
      Verificar {action}
    </button>
  ),
}))

describe('AuthModal password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPasswordForEmail.mockResolvedValue({ error: null })
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('redirects organization members to the dashboard after login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      organizations: [{ id: 'org-1', role: 'owner' }],
      activeOrganization: { id: 'org-1', role: 'owner' },
    }), { status: 200 }))
    render(<AuthModal open onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'owner@ejemplo.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar marketplace_login' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/dashboard'))
    expect(fetch).toHaveBeenCalledWith('/api/organizations', { cache: 'no-store' })
  })

  it('keeps customer-only accounts on the public page after login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      organizations: [],
      activeOrganization: null,
    }), { status: 200 }))
    const onClose = vi.fn()
    render(<AuthModal open onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'cliente@ejemplo.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar marketplace_login' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(routerPush).not.toHaveBeenCalledWith('/dashboard')
    expect(routerRefresh).toHaveBeenCalled()
  })

  it('does not block login when organization resolution fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    const onClose = vi.fn()
    render(<AuthModal open onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: 'usuario@ejemplo.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar marketplace_login' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(routerPush).not.toHaveBeenCalledWith('/dashboard')
    expect(routerRefresh).toHaveBeenCalled()
  })

  it('offers password recovery from the shared public login modal', () => {
    render(<AuthModal open onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument()
  })

  it('sends a normalized recovery request with a dedicated captcha', async () => {
    render(<AuthModal open onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Correo electrónico' }), {
      target: { value: '  CLIENTE@EJEMPLO.COM  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar marketplace_password_recovery' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith('cliente@ejemplo.com', {
        redirectTo: expect.stringMatching(/\/auth\/reset-password$/),
        captchaToken: 'marketplace_password_recovery-token',
      })
    })

    expect(screen.getByText(/Si existe una cuenta con ese correo/i)).toBeInTheDocument()
  })
})
