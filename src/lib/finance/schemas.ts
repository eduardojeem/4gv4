import { z } from 'zod'

import {
  isFinanceAmount,
  MAX_FINANCE_AMOUNT,
  type FinancePaymentMethod,
} from './types'

const uuidSchema = z.uuid()
const accountingDateSchema = z.iso.date()
const positiveAmountSchema = z
  .number()
  .finite()
  .positive()
  .max(MAX_FINANCE_AMOUNT)
  .refine(isFinanceAmount, {
    message: 'El importe no puede tener más de dos decimales.',
  })

const recurrenceSchema = z
  .object({
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    startsOn: accountingDateSchema,
    endsOn: accountingDateSchema.optional(),
  })
  .refine(
    (recurrence) =>
      !recurrence.endsOn || recurrence.endsOn >= recurrence.startsOn,
    { message: 'La fecha de fin no puede ser anterior al inicio.' },
  )

export const expenseInputSchema = z.object({
  branchId: uuidSchema,
  categoryId: uuidSchema,
  amount: positiveAmountSchema,
  concept: z.string().trim().min(1).max(200).optional(),
  accountingDate: accountingDateSchema,
  dueDate: accountingDateSchema.optional(),
  vendor: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2_000).optional(),
  recurrence: recurrenceSchema.optional(),
})

export const paymentInputSchema = z
  .object({
    branchId: uuidSchema,
    amount: positiveAmountSchema,
    paymentMethod: z.enum(['cash', 'bank_transfer', 'other'] satisfies [
      FinancePaymentMethod,
      ...FinancePaymentMethod[],
    ]),
    paymentDate: accountingDateSchema,
    cashSessionId: uuidSchema.optional(),
    reference: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .superRefine((payment, context) => {
    if (payment.paymentMethod === 'cash' && !payment.cashSessionId) {
      context.addIssue({
        code: 'custom',
        message: 'Los pagos en efectivo requieren una sesión de caja.',
        path: ['cashSessionId'],
      })
    }

    if (payment.paymentMethod !== 'cash' && payment.cashSessionId) {
      context.addIssue({
        code: 'custom',
        message: 'Cash sessions only apply to cash payments.',
        path: ['cashSessionId'],
      })
    }
  })

export type ExpenseInput = z.infer<typeof expenseInputSchema>
export type PaymentInput = z.infer<typeof paymentInputSchema>
