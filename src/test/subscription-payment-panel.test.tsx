import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionPaymentPanel } from '@/components/admin/subscriptions/SubscriptionPaymentPanel'

// La transferencia tiene sus propios tests y necesita la sesión del AuthProvider.
vi.mock('@/components/admin/subscriptions/BankTransferPayment', () => ({
  BankTransferPayment: () => <div>Formulario de transferencia</div>,
}))

const baseProps = {
  isPaidPlan: true,
  planName: 'Pro Max',
  planAmount: 'Gs. 200.000',
  canPayByTransfer: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SubscriptionPaymentPanel', () => {
  it('ofrece tarjeta, QR y transferencia, sin Stripe por defecto', () => {
    render(<SubscriptionPaymentPanel {...baseProps} />)

    expect(screen.getByRole('button', { name: /^tarjeta/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^pago qr/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^transferencia/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /stripe/i })).not.toBeInTheDocument()
  })

  it('muestra Stripe solo cuando está habilitado', () => {
    render(<SubscriptionPaymentPanel {...baseProps} stripeEnabled />)
    expect(screen.getByRole('button', { name: /stripe/i })).toBeInTheDocument()
  })

  it('con datos de facturación incompletos bloquea tarjeta y QR pero deja la transferencia', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<SubscriptionPaymentPanel {...baseProps} missingFields={['RUC o CI', 'Teléfono']} />)

    expect(screen.getByText(/Falta: RUC o CI, Teléfono/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^tarjeta/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^pago qr/i })).toBeDisabled()
    // Arranca en transferencia, que no depende de esos datos.
    expect(screen.getByRole('button', { name: /^transferencia/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Formulario de transferencia')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('muestra el motivo que devuelve el servidor cuando Pagopar rechaza el pago', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Comercio de desarrollo no habilitado o con acceso vencido.' }),
      { status: 424, headers: { 'Content-Type': 'application/json' } },
    )))

    render(<SubscriptionPaymentPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Comercio de desarrollo no habilitado o con acceso vencido.')
    })
  })

  it('en el plan gratuito solo ofrece la transferencia', () => {
    render(<SubscriptionPaymentPanel {...baseProps} isPaidPlan={false} />)

    expect(screen.getByText('Formulario de transferencia')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^tarjeta/i })).not.toBeInTheDocument()
  })
})
