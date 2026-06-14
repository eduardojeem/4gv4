import { describe, expect, it } from 'vitest'
import { deriveTechnicalModules } from '@/lib/saas/plan-modules'

describe('deriveTechnicalModules', () => {
  it('enables promotions when configured in plan features', () => {
    const modules = deriveTechnicalModules('basic', [
      { label: 'Promociones y descuentos', value: true },
    ])

    expect(modules).toContain('promotions')
  })

  it('allows disabling a default module from plan features', () => {
    const modules = deriveTechnicalModules('pro', [
      { label: 'Promociones y descuentos', value: false },
    ])

    expect(modules).not.toContain('promotions')
  })

  it('preserves the current repairs and WhatsApp plan contract', () => {
    expect(deriveTechnicalModules('free', [])).toContain('repairs')
    expect(deriveTechnicalModules('pro', [])).not.toContain('whatsapp')
  })

  it('controls the security module from plan features', () => {
    expect(deriveTechnicalModules('pro', [])).toContain('security')
    expect(deriveTechnicalModules('pro', [{ label: 'Seguridad y auditoría', value: false }])).not.toContain('security')
    expect(deriveTechnicalModules('basic', [{ label: 'Seguridad y auditoría', value: true }])).toContain('security')
  })

  it('controls the credits module from plan features', () => {
    expect(deriveTechnicalModules('pro', [])).not.toContain('credits')
    expect(deriveTechnicalModules('basic', [{ label: 'Créditos y cuotas', value: true }])).toContain('credits')
    expect(deriveTechnicalModules('pro', [{ label: 'Creditos y cuotas', value: false }])).not.toContain('credits')
  })
})
