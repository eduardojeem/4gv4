import { describe, expect, it } from 'vitest'
import { canTransitionPaymentStatus, isPaymentConfirmable, normalizePaymentStatus } from './payment-flow'

describe('canTransitionPaymentStatus', () => {
  it('allows confirming unpaid orders as paid', () => {
    expect(canTransitionPaymentStatus('PENDING', 'PENDING', 'PAID')).toBe(true)
    expect(canTransitionPaymentStatus('CONFIRMED', 'PARTIAL', 'PAID')).toBe(true)
    expect(canTransitionPaymentStatus('CONFIRMED', 'FAILED', 'PAID')).toBe(true)
  })

  it('blocks reverting payments to pending', () => {
    expect(canTransitionPaymentStatus('CONFIRMED', 'PAID', 'PENDING')).toBe(false)
    expect(canTransitionPaymentStatus('CONFIRMED', 'FAILED', 'PENDING')).toBe(false)
  })

  it('only refunds paid or partially paid orders', () => {
    expect(canTransitionPaymentStatus('DELIVERED', 'PAID', 'REFUNDED')).toBe(true)
    expect(canTransitionPaymentStatus('DELIVERED', 'PARTIAL', 'REFUNDED')).toBe(true)
    expect(canTransitionPaymentStatus('DELIVERED', 'PENDING', 'REFUNDED')).toBe(false)
  })

  it('blocks confirming payment on cancelled orders', () => {
    expect(canTransitionPaymentStatus('CANCELLED', 'PENDING', 'PAID')).toBe(false)
    expect(canTransitionPaymentStatus('CANCELLED', 'PAID', 'REFUNDED')).toBe(true)
  })

  it('normalizes legacy spanish payment statuses', () => {
    expect(normalizePaymentStatus('pagado')).toBe('PAID')
    expect(normalizePaymentStatus('pendiente')).toBe('PENDING')
    expect(normalizePaymentStatus('parcial')).toBe('PARTIAL')
    expect(normalizePaymentStatus('reembolsado')).toBe('REFUNDED')
    expect(normalizePaymentStatus('fallido')).toBe('FAILED')
  })

  it('only exposes active debt states as confirmable', () => {
    expect(isPaymentConfirmable('PENDING')).toBe(true)
    expect(isPaymentConfirmable('PARTIAL')).toBe(true)
    expect(isPaymentConfirmable('FAILED')).toBe(true)
    expect(isPaymentConfirmable('PAID')).toBe(false)
    expect(isPaymentConfirmable('REFUNDED')).toBe(false)
  })
})
