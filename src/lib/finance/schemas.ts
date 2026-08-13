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

const nonNegativeAmountSchema = z
  .number()
  .finite()
  .min(0)
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

const paymentDetailsSchema = z.object({
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

function validatePaymentDetails(
  payment: z.infer<typeof paymentDetailsSchema>,
  context: z.RefinementCtx,
) {
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
}

export const paymentInputSchema = paymentDetailsSchema
  .extend({ branchId: uuidSchema })
  .superRefine(validatePaymentDetails)

export const payrollRunIdSchema = uuidSchema

export const payrollPreviewQuerySchema = z
  .object({
    periodFrom: accountingDateSchema,
    periodTo: accountingDateSchema,
    branchId: uuidSchema.optional(),
  })
  .refine((input) => input.periodTo >= input.periodFrom, {
    message: 'El periodo de nómina es inválido.',
    path: ['periodTo'],
  })

export const payrollGenerationInputSchema = payrollPreviewQuerySchema

export const compensationInputSchema = z
  .object({
    employeeId: uuidSchema,
    baseSalary: nonNegativeAmountSchema,
    effectiveFrom: accountingDateSchema,
    effectiveTo: accountingDateSchema.optional(),
  })
  .refine(
    (input) => !input.effectiveTo || input.effectiveTo >= input.effectiveFrom,
    {
      message: 'La fecha de fin no puede ser anterior al inicio.',
      path: ['effectiveTo'],
    },
  )

export const compensationUpdateSchema = compensationInputSchema.extend({
  id: uuidSchema,
})

const organizationRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'cashier',
  'technician',
  'seller',
  'customer',
])

export const commissionRuleInputSchema = z
  .object({
    branchId: uuidSchema.optional(),
    scopeType: z.enum(['role', 'employee']),
    role: organizationRoleSchema.optional(),
    employeeId: uuidSchema.optional(),
    sourceType: z.enum(['sale', 'product', 'category', 'repair', 'repair_labor']),
    sourceReferenceId: uuidSchema.optional(),
    accrualStatus: z.enum(['listo', 'entregado']).optional(),
    calculationType: z.enum(['percentage', 'fixed']),
    value: nonNegativeAmountSchema,
    status: z.enum(['draft', 'approved', 'retired']).default('draft'),
    effectiveFrom: accountingDateSchema,
    effectiveTo: accountingDateSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.scopeType === 'employee' && !input.employeeId) {
      context.addIssue({ code: 'custom', path: ['employeeId'], message: 'Selecciona un empleado.' })
    }
    if (input.scopeType === 'role' && !input.role) {
      context.addIssue({ code: 'custom', path: ['role'], message: 'Selecciona un rol.' })
    }
    if (
      (input.sourceType === 'product' || input.sourceType === 'category') &&
      !input.sourceReferenceId
    ) {
      context.addIssue({ code: 'custom', path: ['sourceReferenceId'], message: 'Selecciona la fuente de la comisión.' })
    }
    if (
      (input.sourceType === 'repair' || input.sourceType === 'repair_labor') &&
      !input.accrualStatus
    ) {
      context.addIssue({ code: 'custom', path: ['accrualStatus'], message: 'Selecciona el estado de devengo.' })
    }
    if (input.calculationType === 'percentage' && input.value > 100) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'El porcentaje no puede superar 100.' })
    }
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'La fecha de fin no puede ser anterior al inicio.' })
    }
  })

export const commissionRuleUpdateSchema = commissionRuleInputSchema.extend({
  id: uuidSchema,
})

export const payrollAdjustmentInputSchema = z
  .object({
    payrollEntryId: uuidSchema,
    adjustmentType: z.enum(['bonus', 'discount', 'advance', 'correction', 'reversal']),
    amount: z
      .number()
      .finite()
      .refine((value) => value !== 0 && Math.abs(value) <= MAX_FINANCE_AMOUNT && isFinanceAmount(Math.abs(value)), {
        message: 'El ajuste debe tener hasta dos decimales y ser distinto de cero.',
      }),
    reason: z.string().trim().min(1).max(1_000),
    reversesAdjustmentId: uuidSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.adjustmentType === 'bonus' && input.amount <= 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'El bono debe ser positivo.' })
    }
    if ((input.adjustmentType === 'discount' || input.adjustmentType === 'advance') && input.amount >= 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'El descuento o anticipo debe ser negativo.' })
    }
    if (input.adjustmentType === 'reversal' && !input.reversesAdjustmentId) {
      context.addIssue({ code: 'custom', path: ['reversesAdjustmentId'], message: 'Selecciona el ajuste a revertir.' })
    }
    if (input.adjustmentType !== 'reversal' && input.reversesAdjustmentId) {
      context.addIssue({ code: 'custom', path: ['reversesAdjustmentId'], message: 'Solo una reversión puede referenciar otro ajuste.' })
    }
  })

export const payrollPaymentInputSchema = paymentDetailsSchema
  .extend({ branchId: z.null().optional() })
  .superRefine(validatePaymentDetails)

export type ExpenseInput = z.infer<typeof expenseInputSchema>
export type PaymentInput = z.infer<typeof paymentInputSchema>
export type CompensationInput = z.infer<typeof compensationInputSchema>
export type CommissionRuleInput = z.infer<typeof commissionRuleInputSchema>
export type PayrollGenerationInput = z.infer<typeof payrollGenerationInputSchema>
export type PayrollAdjustmentInput = z.infer<typeof payrollAdjustmentInputSchema>
export type PayrollPaymentInput = z.infer<typeof payrollPaymentInputSchema>
