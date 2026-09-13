import { describe, expect, it } from 'vitest'
import { canTransition } from './state-machine'

describe('repair status quality precondition', () => {
  it('requires a deliverable technical result before marking a repair ready', () => {
    expect(canTransition('reparacion', 'listo', { technician_id: 'tech-1' })).toMatchObject({ allowed: false })
    expect(canTransition('reparacion', 'listo', { technician_id: 'tech-1', quality_check_result: 'failed' })).toMatchObject({ allowed: false })
    expect(canTransition('reparacion', 'listo', { technician_id: 'tech-1', quality_check_result: 'passed' })).toEqual({ allowed: true })
    expect(canTransition('reparacion', 'listo', { technician_id: 'tech-1', quality_check_result: 'unrepairable' })).toEqual({ allowed: true })
  })
})
