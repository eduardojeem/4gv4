import { describe, expect, it } from 'vitest'
import {
  getDeliveryOutcomeForQualityResult,
  parseRepairQualityCheckRequest,
  validateDeliveryQualityCheck,
} from './quality-check'

const passingChecklist = {
  powersOn: true,
  reportedIssueResolved: true,
  basicFunctions: true,
  physicalCondition: true,
  accessoriesVerified: true,
}

describe('repair quality check contract', () => {
  it('accepts a complete passing functional check', () => {
    const result = parseRepairQualityCheckRequest({
      result: 'passed',
      checklist: passingChecklist,
      note: 'Carga, audio y cámaras probados.',
    })

    expect(result.success).toBe(true)
  })

  it('requires a note when the final test fails or the device is not repairable', () => {
    expect(parseRepairQualityCheckRequest({ result: 'failed', checklist: passingChecklist }).success).toBe(false)
    expect(parseRepairQualityCheckRequest({ result: 'unrepairable', checklist: {} }).success).toBe(false)
  })

  it('does not approve an incomplete passing checklist', () => {
    const result = parseRepairQualityCheckRequest({
      result: 'passed',
      checklist: { ...passingChecklist, basicFunctions: false },
    })

    expect(result.success).toBe(false)
  })

  it('maps the technical result to the only allowed delivery outcome', () => {
    expect(getDeliveryOutcomeForQualityResult('passed')).toBe('repaired')
    expect(getDeliveryOutcomeForQualityResult('withdrawn')).toBe('withdrawn')
    expect(getDeliveryOutcomeForQualityResult('unrepairable')).toBe('unrepairable')
    expect(getDeliveryOutcomeForQualityResult('failed')).toBeNull()
  })

  it('blocks delivery when the device was not checked or failed its final test', () => {
    expect(validateDeliveryQualityCheck(null, 'repaired')).toMatchObject({ valid: false, code: 'REPAIR_QUALITY_CHECK_REQUIRED' })
    expect(validateDeliveryQualityCheck('failed', 'repaired')).toMatchObject({ valid: false, code: 'REPAIR_QUALITY_CHECK_FAILED' })
    expect(validateDeliveryQualityCheck('passed', 'unrepairable')).toMatchObject({ valid: false, code: 'REPAIR_QUALITY_OUTCOME_MISMATCH' })
    expect(validateDeliveryQualityCheck('passed', 'repaired')).toEqual({ valid: true })
  })
})
