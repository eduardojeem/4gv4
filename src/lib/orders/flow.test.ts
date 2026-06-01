import { describe, expect, it } from 'vitest'
import { canTransitionOrderStatus, getNextOrderStatus, normalizeOrderStatus } from './flow'

describe('order flow', () => {
  it('allows only the next forward status', () => {
    expect(getNextOrderStatus('PENDING')).toBe('CONFIRMED')
    expect(canTransitionOrderStatus('PENDING', 'CONFIRMED')).toBe(true)
    expect(canTransitionOrderStatus('PENDING', 'DELIVERED')).toBe(false)
    expect(canTransitionOrderStatus('READY', 'CONFIRMED')).toBe(false)
  })

  it('allows cancellation before terminal states only', () => {
    expect(canTransitionOrderStatus('PENDING', 'CANCELLED')).toBe(true)
    expect(canTransitionOrderStatus('SHIPPED', 'CANCELLED')).toBe(true)
    expect(canTransitionOrderStatus('DELIVERED', 'CANCELLED')).toBe(false)
    expect(canTransitionOrderStatus('CANCELLED', 'PENDING')).toBe(false)
  })

  it('normalizes legacy spanish statuses', () => {
    expect(normalizeOrderStatus('pendiente')).toBe('PENDING')
    expect(normalizeOrderStatus('confirmado')).toBe('CONFIRMED')
    expect(normalizeOrderStatus('listo')).toBe('READY')
    expect(normalizeOrderStatus('entregado')).toBe('DELIVERED')
    expect(normalizeOrderStatus('cancelado')).toBe('CANCELLED')
  })
})
