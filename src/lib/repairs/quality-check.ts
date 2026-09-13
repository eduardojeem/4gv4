import type { RepairDeliveryOutcome } from '@/types/repairs'

export type RepairQualityCheckResult = 'passed' | 'failed' | 'unrepairable' | 'withdrawn'

export type RepairQualityChecklist = {
  powersOn: boolean
  reportedIssueResolved: boolean
  basicFunctions: boolean
  physicalCondition: boolean
  accessoriesVerified: boolean
}

export type RepairQualityCheckRequest = {
  result: RepairQualityCheckResult
  checklist: RepairQualityChecklist
  note?: string
}

type ParseResult =
  | { success: true; data: RepairQualityCheckRequest }
  | { success: false; error: string }

const RESULTS: RepairQualityCheckResult[] = ['passed', 'failed', 'unrepairable', 'withdrawn']
const CHECKLIST_KEYS: Array<keyof RepairQualityChecklist> = [
  'powersOn',
  'reportedIssueResolved',
  'basicFunctions',
  'physicalCondition',
  'accessoriesVerified',
]

export function parseRepairQualityCheckRequest(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return { success: false, error: 'invalid_request' }
  const body = input as Record<string, unknown>
  if (typeof body.result !== 'string' || !RESULTS.includes(body.result as RepairQualityCheckResult)) {
    return { success: false, error: 'invalid_result' }
  }

  const result = body.result as RepairQualityCheckResult
  const rawChecklist = body.checklist && typeof body.checklist === 'object'
    ? body.checklist as Record<string, unknown>
    : {}
  const checklist = Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, rawChecklist[key] === true])
  ) as RepairQualityChecklist
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''

  if (result === 'passed' && CHECKLIST_KEYS.some((key) => !checklist[key])) {
    return { success: false, error: 'checklist_incomplete' }
  }
  if (result !== 'passed' && note.length < 5) {
    return { success: false, error: 'note_required' }
  }

  return { success: true, data: { result, checklist, ...(note ? { note } : {}) } }
}

export function getDeliveryOutcomeForQualityResult(
  result: RepairQualityCheckResult
): RepairDeliveryOutcome | null {
  if (result === 'passed') return 'repaired'
  if (result === 'unrepairable' || result === 'withdrawn') return result
  return null
}

export function validateDeliveryQualityCheck(
  result: RepairQualityCheckResult | null | undefined,
  outcome: RepairDeliveryOutcome
): { valid: true } | { valid: false; code: string; message: string } {
  if (!result) {
    return { valid: false, code: 'REPAIR_QUALITY_CHECK_REQUIRED', message: 'El equipo necesita una verificación técnica antes de entregarse.' }
  }
  if (result === 'failed') {
    return { valid: false, code: 'REPAIR_QUALITY_CHECK_FAILED', message: 'El equipo falló la prueba final y no puede entregarse como listo.' }
  }
  if (getDeliveryOutcomeForQualityResult(result) !== outcome) {
    return { valid: false, code: 'REPAIR_QUALITY_OUTCOME_MISMATCH', message: 'El resultado de entrega no coincide con la verificación técnica.' }
  }
  return { valid: true }
}
