import { describe, expect, it } from 'vitest'
import { resolveRepairHelpAction } from './repair-help-action-resolver'

const baseContext = {
  hasSelectedRepair: true,
  balance: 100,
  hasPrice: true,
  canDeliver: true,
}

describe('resolveRepairHelpAction', () => {
  it('opens a new repair without requiring a selected order', () => {
    expect(resolveRepairHelpAction('open-new-repair', {
      ...baseContext,
      hasSelectedRepair: false,
    })).toEqual({ command: 'new' })
  })

  it('explains when payment needs a selected repair', () => {
    expect(resolveRepairHelpAction('open-repair-payment', {
      ...baseContext,
      hasSelectedRepair: false,
    })).toEqual({ message: 'Elegí una reparación primero.' })
  })

  it('does not open payment for a settled or unpriced repair', () => {
    expect(resolveRepairHelpAction('open-repair-payment', {
      ...baseContext,
      balance: 0,
    })).toEqual({ message: 'Esta reparación ya está pagada.' })
    expect(resolveRepairHelpAction('open-repair-payment', {
      ...baseContext,
      hasPrice: false,
    })).toEqual({ message: 'Definí el precio antes de cobrar.' })
  })

  it('opens valid payment and delivery flows', () => {
    expect(resolveRepairHelpAction('open-repair-payment', baseContext)).toEqual({ command: 'payment' })
    expect(resolveRepairHelpAction('open-repair-delivery', baseContext)).toEqual({ command: 'delivery' })
  })

  it('explains why a repair cannot be delivered', () => {
    expect(resolveRepairHelpAction('open-repair-delivery', {
      ...baseContext,
      canDeliver: false,
    })).toEqual({ message: 'Esta reparación todavía no está lista para entregar.' })
  })
})
