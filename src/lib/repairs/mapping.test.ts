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
    expect(statusToStage('pending')).toBe('received')
    expect(statusToStage('in_progress')).toBe('in_repair')
    expect(statusToStage('waiting_parts')).toBe('awaiting_parts')
    expect(statusToStage('on_hold')).toBe('quality_check')
    expect(statusToStage('completed')).toBe('ready')
    expect(statusToStage('cancelled')).toBe('delivered')
  })
})