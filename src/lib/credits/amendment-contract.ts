import { z } from 'zod'
import { creditCalendarDate } from './calendar'

export const canAmendCredit = (role?: string) => role === 'owner' || role === 'admin'
const date = z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && creditCalendarDate(value) === value, 'Fecha inválida.')
const money = z.number().finite().positive().max(1_000_000_000).multipleOf(0.01)
const common = {
  creditId: z.string().uuid(),
  expectedVersion: z.string().regex(/^[a-f0-9]{32}$/),
  reason: z.string().trim().min(5, 'Escribí el motivo de la corrección (mínimo 5 caracteres).').max(500),
}
export const creditAmendmentSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('edit_terms'), principalAmount: money,
    interestRate: z.number().finite().min(0).max(100), installmentCount: z.number().int().min(1).max(60),
    frequency: z.enum(['weekly','biweekly','monthly']), firstDueDate: date }).strict(),
  z.object({ ...common, action: z.literal('reschedule'), installments: z.array(z.object({ id: z.string().uuid(), dueDate: date }).strict()).min(1).max(200)
    .refine(rows => new Set(rows.map(row => row.id)).size === rows.length, 'No repitas cuotas.') }).strict(),
  z.object({ ...common, action: z.literal('adjust_balance'), installmentId: z.string().uuid(), amount: money }).strict(),
  z.object({ ...common, action: z.literal('correct_payment_date'), paymentId: z.string().uuid(), paidAt: z.string().datetime({ offset: true }) }).strict(),
])
export type CreditAmendment = z.infer<typeof creditAmendmentSchema>

export type CreditAmendmentState = {
  version: string
  timeZone: string
  fractionDigits: number
  credit: { id: string; principal: number; interest_rate: number; term_months: number; status: string; metadata?: { frequency?: string } }
  installments: Array<{id:string; installment_number:number; due_date:string; amount:number; amount_paid:number|null; principal_component:number; interest_component:number; status:string}>
  payments: Array<{id:string; amount:number; created_at:string; payment_method:string}>
  history: Array<{id:string; action:string; reason:string; actor_id:string; created_at:string; debt_delta:number; before_state:unknown; after_state:unknown}>
}

export const amendmentActionLabels: Record<string, string> = {
  edit_terms: 'Condiciones corregidas', reschedule: 'Vencimientos reprogramados',
  adjust_balance: 'Ajuste de deuda', correct_payment_date: 'Fecha de cobro corregida',
}
