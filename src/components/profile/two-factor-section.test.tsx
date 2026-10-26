import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TwoFactorSection } from './two-factor-section'

const mfa = {
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { mfa } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const factor = {
  id: 'f-1',
  friendly_name: 'App autenticadora',
  factor_type: 'totp',
  status: 'verified',
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
}

function factors(list: unknown[]) {
  return { data: { all: list, totp: list.filter((item) => (item as { factor_type: string }).factor_type === 'totp'), phone: [] }, error: null }
}

describe('TwoFactorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
  })

  it('muestra que está activada y la app cargada', async () => {
    mfa.listFactors.mockResolvedValue(factors([factor]))
    const onStatusChange = vi.fn()
    render(<TwoFactorSection onStatusChange={onStatusChange} />)
    expect(await screen.findByText('Activada')).toBeInTheDocument()
    expect(screen.getByText('App autenticadora')).toBeInTheDocument()
    expect(onStatusChange).toHaveBeenCalledWith(true)
  })

  it('activa con QR y secreto y verifica el primer código', async () => {
    mfa.listFactors.mockResolvedValueOnce(factors([])).mockResolvedValueOnce(factors([])).mockResolvedValue(factors([factor]))
    mfa.enroll.mockResolvedValue({
      data: { id: 'f-1', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://' } },
      error: null,
    })
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    render(<TwoFactorSection />)

    fireEvent.click(await screen.findByRole('button', { name: /Activar con app autenticadora/i }))
    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Código QR/i })).toHaveAttribute('src', 'data:image/svg+xml;utf-8,<svg/>')
    expect(mfa.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: 'totp', issuer: 'MiTiendaPY' }))

    fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123 456' } })
    fireEvent.click(screen.getByRole('button', { name: /Verificar y activar/i }))

    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f-1', code: '123456' }))
    expect(await screen.findByText('Activada')).toBeInTheDocument()
  })

  it('borra una activación que quedó a medias antes de empezar otra', async () => {
    const stale = { ...factor, id: 'f-viejo', status: 'unverified' }
    mfa.listFactors.mockResolvedValue(factors([stale]))
    mfa.unenroll.mockResolvedValue({ data: {}, error: null })
    mfa.enroll.mockResolvedValue({ data: { id: 'f-2', type: 'totp', totp: { qr_code: 'qr', secret: 'S', uri: 'u' } }, error: null })
    render(<TwoFactorSection />)

    fireEvent.click(await screen.findByRole('button', { name: /Activar con app autenticadora/i }))
    await screen.findByText('S')
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-viejo' })
  })

  it('desactiva tras confirmar', async () => {
    mfa.listFactors.mockResolvedValueOnce(factors([factor])).mockResolvedValue(factors([]))
    mfa.unenroll.mockResolvedValue({ data: {}, error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TwoFactorSection />)

    fireEvent.click(await screen.findByRole('button', { name: /Quitar App autenticadora/i }))
    await waitFor(() => expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-1' }))
    expect(await screen.findByText('Desactivada')).toBeInTheDocument()
  })

  it('un código equivocado se explica en castellano', async () => {
    mfa.listFactors.mockResolvedValue(factors([]))
    mfa.enroll.mockResolvedValue({ data: { id: 'f-1', type: 'totp', totp: { qr_code: 'qr', secret: 'S', uri: 'u' } }, error: null })
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } })
    render(<TwoFactorSection />)

    fireEvent.click(await screen.findByRole('button', { name: /Activar con app autenticadora/i }))
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /Verificar y activar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no es correcto/)
  })
})
