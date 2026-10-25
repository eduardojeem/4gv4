import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PasskeysSection } from './passkeys-section'

const list = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const registerPasskey = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { registerPasskey, passkey: { list, update, delete: remove } } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const existing = {
  id: 'pk-1',
  friendly_name: 'Windows · Chrome',
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  last_used_at: new Date().toISOString(),
}

describe('PasskeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {})
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create: vi.fn(), get: vi.fn() },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (navigator as unknown as Record<string, unknown>).credentials
  })

  it('lista las passkeys del usuario', async () => {
    list.mockResolvedValue({ data: [existing], error: null })
    render(<PasskeysSection />)
    expect(await screen.findByText('Windows · Chrome')).toBeInTheDocument()
    expect(screen.getByText(/Último uso/)).toBeInTheDocument()
  })

  it('registra el dispositivo actual y le pone un nombre', async () => {
    list.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [existing], error: null })
    registerPasskey.mockResolvedValue({ data: { id: 'pk-1', created_at: existing.created_at }, error: null })
    update.mockResolvedValue({ data: existing, error: null })
    render(<PasskeysSection />)

    const button = await screen.findByRole('button', { name: /Registrar este dispositivo/i })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    expect(await screen.findByText('Windows · Chrome')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ passkeyId: 'pk-1', friendlyName: expect.any(String) })
  })

  it('borra una passkey tras confirmar', async () => {
    list.mockResolvedValue({ data: [existing], error: null })
    remove.mockResolvedValue({ data: null, error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PasskeysSection />)

    fireEvent.click(await screen.findByRole('button', { name: /Borrar Windows · Chrome/i }))

    await waitFor(() => expect(screen.queryByText('Windows · Chrome')).not.toBeInTheDocument())
    expect(remove).toHaveBeenCalledWith({ passkeyId: 'pk-1' })
  })

  it('si el proyecto no tiene passkeys habilitadas lo dice y no deja registrar', async () => {
    list.mockResolvedValue({ data: null, error: { code: 'passkey_disabled', message: 'Passkeys are disabled' } })
    render(<PasskeysSection />)

    expect(await screen.findByText(/no está habilitado todavía/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar este dispositivo/i })).toBeDisabled()
  })
})
