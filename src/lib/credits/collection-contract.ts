import { z } from 'zod'
import { collectPaymentRequestSchema } from '@/lib/customers/collect-payment'

export const collectionRequestSchema = collectPaymentRequestSchema.safeExtend({
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
  allocations: z.array(z.object({
    debtId: z.string().uuid(), type: z.enum(['repair', 'installment']),
    paymentId: z.string().uuid(), appliedAmount: money.positive(), remainingBalance: money,
  })),
}).refine(value => Math.abs(value.appliedAmount - value.allocations.reduce((sum, row) => sum + row.appliedAmount, 0)) < 0.01,
  'El total aplicado no coincide con el reparto.')
export type CollectionResult = z.infer<typeof collectionResultSchema>
