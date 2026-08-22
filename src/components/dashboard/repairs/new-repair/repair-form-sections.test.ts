import { describe, expect, it } from 'vitest'
import { buildSectionState, sectionForField } from './repair-form-sections'

describe('repair form section contracts', () => {
  it.each([
    ['existingCustomerId', 'customer'],
    ['customerPhone', 'customer'],
    ['devices.0.brand', 'device'],
    ['devices.0.accessPassword', 'device'],
    ['devices.0.issue', 'diagnosis'],
    ['devices.0.description', 'diagnosis'],
    ['notes.0.text', 'diagnosis'],
    ['parts.0.name', 'catalog'],
    ['laborCost', 'estimate'],
    ['depositMethod', 'estimate'],
  ] as const)('maps %s to %s', (path, section) => {
    expect(sectionForField(path)).toBe(section)
  })

  it('counts nested field errors in their owning sections', () => {
    const state = buildSectionState({
      existingCustomerId: { message: 'Selecciona un cliente' },
      devices: [{
        brand: { message: 'Ingresa una marca' },
        issue: { message: 'Describe el problema' },
      }],
      parts: [{ name: { message: 'Ingresa el repuesto' } }],
      laborCost: { message: 'Monto inválido' },
    })

    expect(state.customer.errorCount).toBe(1)
    expect(state.device.errorCount).toBe(1)
    expect(state.diagnosis.errorCount).toBe(1)
    expect(state.catalog.errorCount).toBe(1)
    expect(state.estimate.errorCount).toBe(1)
    expect(state.review.errorCount).toBe(0)
  })

  it('ignores React Hook Form metadata instead of counting it as a field', () => {
    const state = buildSectionState({
      devices: {
        root: { message: 'Agrega al menos un equipo', type: 'too_small' },
        message: 'Agrega al menos un equipo',
        type: 'too_small',
      },
    })

    expect(state.device.errorCount).toBe(1)
  })
})
