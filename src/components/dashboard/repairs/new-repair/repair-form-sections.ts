import type {
  RepairFormSectionDefinition,
  RepairFormSectionId,
  RepairFormSectionState,
} from './types'

export const REPAIR_FORM_SECTIONS: readonly RepairFormSectionDefinition[] = [
  { id: 'customer', label: 'Cliente', description: 'Identificación y contacto' },
  { id: 'device', label: 'Equipo', description: 'Datos y estado de recepción' },
  { id: 'diagnosis', label: 'Diagnóstico inicial', description: 'Problema, observaciones y evidencia' },
  { id: 'catalog', label: 'Servicios y repuestos', description: 'Trabajo e insumos necesarios' },
  { id: 'estimate', label: 'Costos y plazo', description: 'Precio, adelanto y garantía' },
  { id: 'review', label: 'Revisión final', description: 'Confirmación antes de guardar' },
] as const

const CUSTOMER_FIELDS = new Set([
  'customerName', 'customerPhone', 'customerEmail', 'customerAddress',
  'customerDocument', 'customerCity', 'customerCountry', 'existingCustomerId',
  'isNewCustomer',
])

const DIAGNOSIS_DEVICE_FIELDS = new Set(['issue', 'description', 'images'])
const ESTIMATE_FIELDS = new Set([
  'laborCost', 'finalCost', 'pricingMode', 'discountAmount', 'priceOverrideReason',
  'warrantyMonths', 'warrantyType', 'warrantyNotes', 'depositAmount',
  'depositMethod', 'depositReference', 'priority', 'urgency',
])

export function sectionForField(path: string): RepairFormSectionId {
  const [root, , deviceField] = path.split('.')
  if (CUSTOMER_FIELDS.has(root)) return 'customer'
  if (root === 'parts') return 'catalog'
  if (root === 'notes') return 'diagnosis'
  if (root === 'devices') {
    return deviceField && DIAGNOSIS_DEVICE_FIELDS.has(deviceField) ? 'diagnosis' : 'device'
  }
  if (ESTIMATE_FIELDS.has(root)) return 'estimate'
  return 'review'
}

function collectErrorPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  const nestedKeys = Object.keys(record).filter((key) =>
    !['message', 'type', 'types', 'ref'].includes(key)
  )

  if (typeof record.message === 'string' && nestedKeys.length === 0) {
    return prefix ? [prefix] : []
  }

  return nestedKeys.flatMap((key) => {
    const nextPrefix = key === 'root' ? prefix : (prefix ? `${prefix}.${key}` : key)
    return collectErrorPaths(record[key], nextPrefix)
  })
}

export function buildSectionState(errors: unknown): RepairFormSectionState {
  const state: RepairFormSectionState = {
    customer: { errorCount: 0 },
    device: { errorCount: 0 },
    diagnosis: { errorCount: 0 },
    catalog: { errorCount: 0 },
    estimate: { errorCount: 0 },
    review: { errorCount: 0 },
  }

  for (const path of collectErrorPaths(errors)) {
    state[sectionForField(path)].errorCount += 1
  }

  return state
}
