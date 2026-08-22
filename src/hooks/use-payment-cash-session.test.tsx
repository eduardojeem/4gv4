import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePaymentCashSession } from './use-payment-cash-session'

const cashRegister = vi.hoisted(() => ({
  checkOpenSession: vi.fn(),
}))

vi.mock('@/hooks/useCashRegister', () => ({
  useCashRegister: () => cashRegister,
}))

describe('usePaymentCashSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('moves from checking to closed when there is no open session', async () => {
    cashRegister.checkOpenSession.mockResolvedValue(null)

    const { result } = renderHook(() => usePaymentCashSession({ active: true }))

    expect(result.current.state).toBe('checking')
    await waitFor(() => expect(result.current.state).toBe('closed'))
    expect(result.current.sessionId).toBeNull()
  })

  it('refreshes a closed state after the register is opened', async () => {
    cashRegister.checkOpenSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'session-1' })

    const { result } = renderHook(() => usePaymentCashSession({ active: true, registerId: 'principal' }))
    await waitFor(() => expect(result.current.state).toBe('closed'))

    await act(async () => result.current.refresh())

    expect(result.current.state).toBe('open')
    expect(result.current.sessionId).toBe('session-1')
  })

  it('stays idle and does not query caja for a non-payment operation', () => {
    const { result } = renderHook(() => usePaymentCashSession({ active: false }))

    expect(result.current.state).toBe('idle')
    expect(cashRegister.checkOpenSession).not.toHaveBeenCalled()
  })

  it('returns an open payment flow to the closed prerequisite without touching consumer data', async () => {
    cashRegister.checkOpenSession.mockResolvedValue({ id: 'session-1' })
    const draft = { amount: 150000, notes: 'Entrega' }
    const { result } = renderHook(() => usePaymentCashSession({ active: true }))
    await waitFor(() => expect(result.current.state).toBe('open'))

    act(() => result.current.markClosed())

    expect(result.current.state).toBe('closed')
    expect(draft).toEqual({ amount: 150000, notes: 'Entrega' })
  })
})
