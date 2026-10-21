/** Customer-facing repair prices stay visible; internal acquisition costs never become fake zero. */
const INTERNAL_FIELDS = new Set(['internalCost', 'internal_cost', 'parts_internal_cost', 'partsInternalCost', 'includedMaterialsInternalCost', 'unit_cost_snapshot', 'parts_cost', 'partsCost', 'unit_cost', 'unitCost', 'purchase_price', 'foreign_purchase_price', 'included_material_cost', 'includedMaterialCost', 'cost_price', 'total_cost', 'totalCost', 'profit', 'margin', 'currentCostRevision', 'cost_revisions', 'repair_cost_revisions'])
export function redactRepairInternalCosts<T>(value: T, canReadCost: boolean): T {
 if (canReadCost || value === null || typeof value !== 'object') return value
 if (Array.isArray(value)) return value.map(item=>redactRepairInternalCosts(item,false)) as T
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key, INTERNAL_FIELDS.has(key) ? null : redactRepairInternalCosts(item,false)])) as T
}
