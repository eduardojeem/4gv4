import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualPaymentForm } from '@/components/superadmin/subscriptions/manual-payment-form'

afterEach(() => vi.unstubAllGlobals())
describe('Confirmación de cobros manuales', () => {
  it('revisa primero y conserva el borrador cuando el servidor rechaza el cobro', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Cobro rechazado' }) })
    vi.stubGlobal('fetch', request)
    render(<ManualPaymentForm subscriptionId="demo" currentPlan="PRO" suggestedAmount={150000} onRecorded={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pago' }))
    expect(request).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmá el cobro recibido')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago y activar plan' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cobro rechazado'))
    expect(request).toHaveBeenCalledTimes(1)
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ amount: 150000, plan: 'PRO' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver a editar' }))
    expect(screen.getByLabelText('Monto cobrado (₲)')).toHaveValue('150000')
  })
  it('rechaza importes negativos antes de enviar', () => {
    const request = vi.fn(); vi.stubGlobal('fetch', request)
    render(<ManualPaymentForm subscriptionId="demo" currentPlan="PRO" suggestedAmount={null} onRecorded={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Monto cobrado (₲)'), { target: { value: '-100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pago' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(request).not.toHaveBeenCalled()
  })
})
