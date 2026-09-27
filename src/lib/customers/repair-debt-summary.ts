import { resolveRepairCollectionPricing } from '@/lib/repairs/collection-pricing'
import type { RepairPricingMode } from '@/lib/repairs/pricing'

type RepairDebtRow = {
  customer_id?: unknown
  status?: unknown
  delivered_at?: unknown
  pricing_mode?: unknown
  labor_cost?: unknown
  final_cost?: unknown
  estimated_cost?: unknown
  discount_amount?: unknown
  paid_amount?: unknown
  parts?: Array<Record<string, unknown>> | null
}

export type RepairDebtSummary = Record<string, { totalPending: number; overdue: number }>

const CANCELLED_STATUSES = new Set(['cancelado', 'cancelled'])
const DELIVERED_STATUSES = new Set(['entregado', 'delivered'])

function pricingMode(value: unknown): RepairPricingMode | undefined {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'total') return 'budget'
  if (normalized === 'automatic' || normalized === 'budget' || normalized === 'manual') return normalized
  return undefined
}

export function summarizeRepairDebts(rows: RepairDebtRow[]): RepairDebtSummary {
  const summaries: RepairDebtSummary = {}

  for (const row of rows) {
    const customerId = String(row.customer_id ?? '').trim()
    const status = String(row.status ?? '').trim().toLowerCase()
    if (!customerId || CANCELLED_STATUSES.has(status)) continue

    const mode = pricingMode(row.pricing_mode)
    const finalCost = row.final_cost == null && String(row.pricing_mode).toLowerCase() === 'total'
      ? row.estimated_cost
      : row.final_cost
    const { pricing } = resolveRepairCollectionPricing({
      mode,
      laborCost: Number(row.labor_cost) || 0,
      finalCost: finalCost == null ? null : Number(finalCost),
      estimatedCost: row.estimated_cost == null ? null : Number(row.estimated_cost),
      discountAmount: Number(row.discount_amount) || 0,
      paidAmount: Number(row.paid_amount) || 0,
      parts: (row.parts ?? []).map((part) => ({
        cost: Number(part.unit_price ?? part.unit_cost) || 0,
        internalCost: Number(part.unit_cost) || 0,
        quantity: Number(part.quantity) || 0,
        lineType: part.line_type as never,
      })),
    })

    if (pricing.balance <= 0) continue
    const current = summaries[customerId] ?? { totalPending: 0, overdue: 0 }
    current.totalPending += pricing.balance
    if (DELIVERED_STATUSES.has(status) || Boolean(row.delivered_at)) current.overdue += pricing.balance
    summaries[customerId] = current
  }

  return summaries
}
