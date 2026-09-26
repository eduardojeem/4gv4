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

export type CatalogItemKind = 'service' | 'part'

export interface RepairCatalogItem {
  id: string
  name: string
  sku?: string | null
  sale_price?: number | null
  offer_price?: number | null
  wholesale_price?: number | null
  purchase_price?: number | null
  stock_quantity?: number | null
  unit_measure?: string | null
  category?: { name?: string | null } | null
}
