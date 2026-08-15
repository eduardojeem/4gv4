import { z } from 'zod'

const idempotencyKeySchema = z.string().trim().min(8).max(120)
const optionalReferenceSchema = z.string().trim().max(120).optional()
const optionalNoteSchema = z.string().trim().max(2_000).optional()

export const repairPaymentRequestSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'credit']),
  amount: z.number().finite().positive(),
  reference: optionalReferenceSchema,
  note: optionalNoteSchema,
  interestRate: z.number().finite().min(0).max(1_000).optional(),
  installments: z.object({
    count: z.number().int().min(1).max(60),
    frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  }).strict().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict()

export const repairDeliveryRequestSchema = z.object({
  outcome: z.enum(['repaired', 'withdrawn', 'unrepairable']),
  note: optionalNoteSchema,
  allowOutstandingBalance: z.boolean(),
  idempotencyKey: idempotencyKeySchema,
  payment: repairPaymentRequestSchema.omit({ note: true }).optional(),
}).strict()

export type RepairPaymentRequest = z.infer<typeof repairPaymentRequestSchema>
export type RepairDeliveryRequest = z.infer<typeof repairDeliveryRequestSchema>
export type RepairPaymentStatus = 'pendiente' | 'parcial' | 'pagado'

export type RepairPaymentSummaryInput = {
  finalCost?: number | null
  estimatedCost?: number | null
  paidAmount?: number | null
}

export type RepairFinancialPresentationInput = RepairPaymentSummaryInput & {
  status: string
}

export function parseRepairPaymentRequest(input: unknown) {
  return repairPaymentRequestSchema.safeParse(input)
}

export function parseRepairDeliveryRequest(input: unknown) {
  return repairDeliveryRequestSchema.safeParse(input)
}

export function getRepairPaymentSummary(input: RepairPaymentSummaryInput) {
  const total = Math.max(0, Number(input.finalCost ?? input.estimatedCost) || 0)
  const paid = Math.max(0, Number(input.paidAmount) || 0)
  const balance = Math.max(0, total - paid)
  const status: RepairPaymentStatus = paid <= 0
    ? 'pendiente'
    : balance <= 0
      ? 'pagado'
      : 'parcial'

  return { total, paid, balance, status }
}

export function getRepairFinancialPresentation(input: RepairFinancialPresentationInput) {
  const summary = getRepairPaymentSummary(input)
  const delivered = input.status === 'entregado'
  const financialLabel = summary.status === 'pagado'
    ? 'pagado'
    : summary.status === 'parcial'
      ? 'pago parcial'
      : 'pago pendiente'

  return {
    ...summary,
    delivered,
    label: delivered ? `Entregado · ${financialLabel}` : financialLabel,
    canCollect: input.status !== 'cancelado' && summary.balance > 0,
  }
}
