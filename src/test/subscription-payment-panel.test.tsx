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
  it('ofrece tarjeta (Bancard) y transferencia, sin QR ni Stripe por defecto', () => {
    render(<SubscriptionPaymentPanel {...baseProps} />)

    expect(screen.getByRole('button', { name: /^tarjeta/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /qr/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^transferencia/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /stripe/i })).not.toBeInTheDocument()
  })

  it('muestra Stripe solo cuando está habilitado', () => {
    render(<SubscriptionPaymentPanel {...baseProps} stripeEnabled />)
    expect(screen.getByRole('button', { name: /stripe/i })).toBeInTheDocument()
  })

  it('con datos de facturación incompletos bloquea la tarjeta pero deja la transferencia', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<SubscriptionPaymentPanel {...baseProps} missingFields={['RUC o CI', 'Teléfono']} />)

    expect(screen.getByText(/Falta: RUC o CI, Teléfono/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^tarjeta/i })).toBeDisabled()
    // Arranca en transferencia, que no depende de esos datos.
    expect(screen.getByRole('button', { name: /^transferencia/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Formulario de transferencia')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('inicia el pago con Bancard y muestra el motivo cuando el servidor lo rechaza', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Comercio de desarrollo no habilitado o con acceso vencido.' }),
      { status: 424, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    render(<SubscriptionPaymentPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Comercio de desarrollo no habilitado o con acceso vencido.')
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/subscriptions/payments/bancard')
  })

  it('en el plan gratuito solo ofrece la transferencia', () => {
    render(<SubscriptionPaymentPanel {...baseProps} isPaidPlan={false} />)

    expect(screen.getByText('Formulario de transferencia')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^tarjeta/i })).not.toBeInTheDocument()
  })
})

const disabledAvailability = { bancard_card: false, stripe: false, transfer: false }

describe('subscription payment availability', () => {
  it('shows no checkout action or billing prompt when every method is disabled', () => {
    render(<SubscriptionPaymentPanel {...baseProps} paymentAvailability={disabledAvailability} missingFields={['RUC o CI']} />)
    expect(screen.getByRole('status')).toHaveTextContent('No hay medios de pago disponibles')
    expect(screen.queryByRole('button', { name: /Pagar con/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/completá tus datos/i)).not.toBeInTheDocument()
  })

  it('selects Stripe when card is disabled and clears it when availability changes', () => {
    const { rerender } = render(<SubscriptionPaymentPanel {...baseProps} paymentAvailability={{ ...disabledAvailability, stripe: true }} />)
    expect(screen.queryByRole('button', { name: /^Tarjeta/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar con Stripe' })).toBeEnabled()
    rerender(<SubscriptionPaymentPanel {...baseProps} paymentAvailability={disabledAvailability} />)
    expect(screen.queryByRole('button', { name: /Pagar con/i })).not.toBeInTheDocument()
  })
})
