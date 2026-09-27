import { describe, expect, it } from 'vitest'
import { canTransitionRaffleStatus, raffleTransitionMessage } from './lifecycle'

describe('raffle lifecycle', () => {
  it('permite el flujo operativo y evita reactivar sorteos terminales', () => {
    expect(canTransitionRaffleStatus('draft', 'published')).toBe(true)
    expect(canTransitionRaffleStatus('published', 'closed')).toBe(true)
    expect(canTransitionRaffleStatus('closed', 'published')).toBe(false)
    expect(canTransitionRaffleStatus('completed', 'published')).toBe(false)
    expect(raffleTransitionMessage('completed', 'published')).toContain('no se puede reactivar')
  })
})
