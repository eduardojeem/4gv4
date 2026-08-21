export type RepairFormSectionId =
  | 'customer'
  | 'device'
  | 'diagnosis'
  | 'catalog'
  | 'estimate'
  | 'review'

export interface RepairFormSectionDefinition {
  id: RepairFormSectionId
  label: string
  description: string
}

export interface RepairFormSectionStatus {
  errorCount: number
}

export type RepairFormSectionState = Record<RepairFormSectionId, RepairFormSectionStatus>
