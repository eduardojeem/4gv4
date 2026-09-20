import { z } from 'zod'

const idempotencyKeySchema = z.string().trim().min(8).max(120)
const optionalReferenceSchema = z.string().trim().max(120).optional()
const optionalNoteSchema = z.string().trim().max(2_000).optional()

const repairPaymentBaseSchema = z.object({
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

function requireAuditablePaymentReference(
  payment: Pick<z.infer<typeof repairPaymentBaseSchema>, 'method' | 'reference'>,
  ctx: z.RefinementCtx,
) {
  if ((payment.method === 'card' || payment.method === 'transfer') && !payment.reference) {
    ctx.addIssue({
      code: 'custom',
      path: ['reference'],
      message: 'La referencia del comprobante es obligatoria para este método.',
    })
  }
}

export const repairPaymentRequestSchema = repairPaymentBaseSchema
  .extend({ purpose: z.enum(['payment', 'deposit']).default('payment') })
  .superRefine(requireAuditablePaymentReference)
  .superRefine((payment, ctx) => {
    if (payment.purpose === 'deposit' && payment.method === 'credit') {
      ctx.addIssue({
        code: 'custom',
        path: ['method'],
        message: 'Un anticipo debe representar dinero recibido, no crédito.',
      })
    }
  })

export const repairDeliveryRequestSchema = z.object({
  outcome: z.enum(['repaired', 'withdrawn', 'unrepairable']),
  note: optionalNoteSchema,
  allowOutstandingBalance: z.boolean(),
  idempotencyKey: idempotencyKeySchema,
  payment: repairPaymentBaseSchema
    .omit({ note: true })
    .superRefine(requireAuditablePaymentReference)
    .optional(),
}).strict()

export type RepairPaymentRequest = z.infer<typeof repairPaymentRequestSchema>
export type RepairDeliveryRequest = z.infer<typeof repairDeliveryRequestSchema>
export type RepairPaymentStatus = 'pendiente' | 'parcial' | 'pagado'

export type RepairPaymentSummaryInput = {
  finalCost?: number | null
  estimatedCost?: number | null
  paidAmount?: number | null
  status?: string
  deliveryOutcome?: string | null
  qualityCheck?: { result?: string | null } | null
  closeout?: { outcome?: string | null; finalCharge?: number | null } | null
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
  const isUnrepaired =
    input.status === 'cancelado' ||
    input.deliveryOutcome === 'withdrawn' ||
    input.deliveryOutcome === 'unrepairable' ||
    input.qualityCheck?.result === 'unrepairable' ||
    input.qualityCheck?.result === 'withdrawn' ||
    input.closeout?.outcome === 'withdrawn' ||
    input.closeout?.outcome === 'unrepairable'

  const paid = Math.max(0, Number(input.paidAmount) || 0)

  if (isUnrepaired) {
    // Si la reparación fue retirada o cancelada sin solucionar el problema,
    // el presupuesto estimado original NO constituye una deuda pendiente.
    // Solo se cobra si hubo un cargo explícito de revisión/cierre (closeout.finalCharge).
    const explicitCharge = input.closeout
      ? Math.max(0, Number(input.closeout.finalCharge) || 0)
      : (input.deliveryOutcome && input.finalCost !== null && input.finalCost !== undefined && input.finalCost !== input.estimatedCost)
        ? Math.max(0, Number(input.finalCost) || 0)
        : 0

    const total = explicitCharge
    const balance = Math.max(0, total - paid)
    const status: RepairPaymentStatus = paid <= 0
      ? (total > 0 ? 'pendiente' : 'pagado')
      : balance <= 0
        ? 'pagado'
        : 'parcial'

    return {
      total,
      paid,
      balance,
      status,
      priceDefined: true as const,
      isUnrepaired: true as const,
    }
  }

  const priceDefined = (input.finalCost !== null && input.finalCost !== undefined)
    || Number(input.estimatedCost) > 0
  if (!priceDefined) {
    return {
      total: null,
      paid,
      balance: null,
      status: paid > 0 ? 'parcial' as const : 'pendiente' as const,
      priceDefined: false as const,
      }
  }

  const total = Math.max(0, Number(input.finalCost ?? input.estimatedCost) || 0)
  const balance = Math.max(0, total - paid)
  const status: RepairPaymentStatus = balance <= 0
    ? 'pagado'
    : paid > 0
      ? 'parcial'
      : 'pendiente'

  return { total, paid, balance, status, priceDefined: true as const }
}

export function getRepairFinancialPresentation(input: RepairFinancialPresentationInput) {
  const summary = getRepairPaymentSummary(input)
  const delivered = input.status === 'entregado'
  const isUnrepaired = 'isUnrepaired' in summary && Boolean(summary.isUnrepaired)

  if (isUnrepaired) {
    if (summary.total === 0) {
      if (summary.paid > 0) {
        return {
          ...summary,
          delivered,
          isUnrepaired: true as const,
          label: delivered ? 'Retirado · anticipo a favor' : 'Anticipo registrado',
          canCollect: false,
        }
      }
      return {
        ...summary,
        delivered,
        isUnrepaired: true as const,
        label: input.status === 'cancelado'
          ? 'Cancelado · sin costo'
          : (input.deliveryOutcome === 'unrepairable' || input.qualityCheck?.result === 'unrepairable')
            ? 'Sin reparar · sin costo'
            : 'Retirado sin reparar',
        canCollect: false,
      }
    }
  }

  if (summary.priceDefined && summary.total === 0 && summary.paid === 0) {
    return {
      ...summary,
      delivered,
      isUnrepaired: false as const,
      label: delivered ? 'Entregado · sin costo' : 'Sin costo',
      canCollect: false,
    }
  }

  const financialLabel = summary.status === 'pagado'
    ? 'pagado'
    : summary.status === 'parcial'
      ? 'pago parcial'
      : 'pago pendiente'

  return {
    ...summary,
    delivered,
    isUnrepaired: false as const,
    label: summary.priceDefined
      ? (delivered ? `Entregado · ${financialLabel}` : financialLabel)
      : (summary.paid > 0 ? 'Anticipo recibido · precio pendiente' : 'Precio pendiente'),
    canCollect: input.status !== 'cancelado' && (!summary.priceDefined || summary.balance > 0),
  }
}
