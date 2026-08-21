export const REPAIR_LINE_TYPES = [
  'service',
  'included_material',
  'charged_part',
] as const

export type RepairLineType = (typeof REPAIR_LINE_TYPES)[number]

export function normalizeRepairLineType(value: unknown): RepairLineType {
  return REPAIR_LINE_TYPES.includes(value as RepairLineType)
    ? (value as RepairLineType)
    : 'charged_part'
}

export function isInventoryLine(lineType: RepairLineType): boolean {
  return lineType !== 'service'
}
