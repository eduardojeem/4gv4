import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionPaymentMethodSelector } from '@/components/admin/subscriptions/SubscriptionPaymentMethodSelector'

describe('SubscriptionPaymentMethodSelector', () => {
  it('muestra la tarjeta por Bancard y deja elegir la transferencia', () => {
    const onChange = vi.fn()

    render(<SubscriptionPaymentMethodSelector value="card" onChange={onChange} includeTransfer />)

    expect(screen.getByRole('button', { name: /tarjeta/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /tarjeta/i })).toHaveTextContent(/bancard/i)
    expect(screen.queryByRole('button', { name: /qr/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /transferencia/i }))

    expect(onChange).toHaveBeenCalledWith('transfer')
  })
})
