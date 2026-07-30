import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PagoparPaymentMethodSelector } from '@/components/admin/subscriptions/PagoparPaymentMethodSelector'

describe('PagoparPaymentMethodSelector', () => {
  it('lets the user choose QR and exposes the current selection', () => {
    const onChange = vi.fn()

    render(<PagoparPaymentMethodSelector value="card" onChange={onChange} />)

    expect(screen.getByRole('button', { name: /tarjeta/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /qr/i }))

    expect(onChange).toHaveBeenCalledWith('qr')
  })
})
