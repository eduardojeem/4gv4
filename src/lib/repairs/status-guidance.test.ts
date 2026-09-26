import { describe, expect, it } from 'vitest'
import { getRepairStatusGuidance } from './status-guidance'

describe('getRepairStatusGuidance', () => {
  it('recomienda el siguiente paso normal y explica su efecto', () => {
    const guidance = getRepairStatusGuidance('diagnostico')

    expect(guidance.recommended).toBe('reparacion')
    expect(guidance.actionLabel).toBe('Iniciar reparación')
    expect(guidance.currentDescription).toMatch(/diagnóstico/i)
    expect(guidance.actionDescription).toMatch(/técnico/i)
  })

  it('identifica retrocesos y cancelación como acciones que requieren confirmación', () => {
    expect(getRepairStatusGuidance('listo').requiresConfirmation('reparacion')).toBe(true)
    expect(getRepairStatusGuidance('recibido').requiresConfirmation('cancelado')).toBe(true)
    expect(getRepairStatusGuidance('reparacion').requiresConfirmation('listo')).toBe(false)
  })

  it('explica el flujo especial de entrega', () => {
    const guidance = getRepairStatusGuidance('listo')

    expect(guidance.recommended).toBe('entregado')
    expect(guidance.actionLabel).toBe('Cobrar y entregar')
    expect(guidance.actionDescription).toMatch(/cobro|entrega/i)
  })
})
