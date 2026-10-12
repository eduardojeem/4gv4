import { z } from 'zod'
import { collectPaymentRequestSchema } from '@/lib/customers/collect-payment'

export const collectionRequestSchema = collectPaymentRequestSchema.safeExtend({
  amount: z.number().finite().positive().max(1_000_000_000).multipleOf(0.01),
  allocations: z.array(z.object({ id: z.string().uuid(), type: z.enum(['repair', 'installment']),
    amount: z.number().finite().nonnegative().multipleOf(0.01) })).max(200).optional(),
  scope: z.object({
    creditId: z.string().uuid().optional(),
    installmentId: z.string().uuid().optional(),
  }).strict().optional(),
}).strict()
export type CollectionRequest = z.infer<typeof collectionRequestSchema>

const money = z.number().finite().nonnegative()
export const collectionResultSchema = z.object({
  receiptId: z.string().uuid(),
  receiptNumber: z.string().min(1),
  appliedAmount: money,
  excessToStoreCredit: money,
  recordedAt: z.string().datetime({ offset: true }),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  creditBalances: z.record(z.string(), z.object({
    remainingBalance: money, paidInstallments: z.number().int().nonnegative(),
    pendingInstallments: z.number().int().nonnegative(),
    nextDueDate: z.string().nullable(), nextDueAmount: money.nullable(),
  })).optional(),
  allocations: z.array(z.object({
    debtId: z.string().uuid(), type: z.enum(['repair', 'installment']),
    paymentId: z.string().uuid(), appliedAmount: money.positive(), remainingBalance: money,
    totalAmount: money.optional(),
  })),
}).refine(value => Math.abs(value.appliedAmount - value.allocations.reduce((sum, row) => sum + row.appliedAmount, 0)) < 0.01,
  'El total aplicado no coincide con el reparto.')
export type CollectionResult = z.infer<typeof collectionResultSchema>
