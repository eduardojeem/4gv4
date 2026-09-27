import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PaymentDialog } from './PaymentDialog'

const uuid = '11111111-1111-4111-8111-111111111111'

afterEach(() => vi.unstubAllGlobals())

describe('finance payment recovery', () => {
  it('recovers from a rejected fetch and retries the same payment identity', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payment: { id: uuid } })))
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(<PaymentDialog open onOpenChange={onOpenChange} organizationId={uuid} obligationId={uuid} branchId={uuid} onSaved={onSaved} />)

    await user.type(screen.getByLabelText('Monto'), '100')
    await user.type(screen.getByLabelText('Referencia (opcional)'), 'REC-123')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificá.*estado/i)
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]).toEqual(fetchMock.mock.calls[0][1])
    expect(fetchMock.mock.calls[0][1].headers['x-idempotency-key']).toMatch(/^payment-/)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reference).toBe('REC-123')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not post another payment when refreshing after confirmed success fails', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ payment: { id: uuid } })))
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn().mockRejectedValueOnce(new Error('refresh failed')).mockResolvedValueOnce(undefined)
    render(<PaymentDialog open onOpenChange={vi.fn()} organizationId={uuid} payrollEntryId={uuid} branchId={uuid} onSaved={onSaved} />)
    await user.type(screen.getByLabelText('Monto'), '100')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/pago.*registrado/i)
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
