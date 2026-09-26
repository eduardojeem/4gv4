import { describe, it, expect } from 'vitest'
import { stageToStatus, statusToStage } from './mapping'

describe('repairs mapping utilities', () => {
  it('maps stage to UI status', () => {
    expect(stageToStatus('received')).toBe('pending')
    expect(stageToStatus('diagnosis')).toBe('in_progress')
    expect(stageToStatus('awaiting_parts')).toBe('waiting_parts')
    expect(stageToStatus('in_repair')).toBe('in_progress')
    expect(stageToStatus('quality_check')).toBe('on_hold')
    expect(stageToStatus('ready')).toBe('completed')
    expect(stageToStatus('delivered')).toBe('completed')
  })

  it('maps UI status to stage', () => {
    expect(statusToStage('pending')).toBe('recibido')
    expect(statusToStage('in_progress')).toBe('diagnostico')
    expect(statusToStage('waiting_parts')).toBe('esperando_repuestos')
    expect(statusToStage('on_hold')).toBe('pausado')
    expect(statusToStage('completed')).toBe('listo')
    expect(statusToStage('cancelled')).toBe('cancelado')
  })
})
