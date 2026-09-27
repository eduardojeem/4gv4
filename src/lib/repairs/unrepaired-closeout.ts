import { z } from 'zod'

const moneySchema = z.number().finite().min(0).max(999_999_999_999)
const referenceSchema = z.string().trim().min(1).max(120)

const chargeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z.object({ mode: z.literal('labor'), laborAmount: moneySchema }).strict(),
  z.object({ mode: z.literal('labor_and_consumed_parts'), laborAmount: moneySchema }).strict(),
  z.object({ mode: z.literal('exceptional'), amount: moneySchema }).strict(),
])

const settlementSchema = z.union([
  z.object({ kind: z.literal('none') }).strict(),
  z.object({
    kind: z.literal('payment'),
    method: z.enum(['cash', 'card']),
    amount: moneySchema.positive(),
    reference: z.string().trim().max(120).optional(),
  }).strict(),
  z.object({
    kind: z.literal('payment'),
    method: z.literal('transfer'),
    amount: moneySchema.positive(),
    reference: referenceSchema,
  }).strict(),
  z.object({ kind: z.literal('outstanding') }).strict(),
  z.object({ kind: z.literal('refund'), method: z.literal('cash') }).strict(),
  z.object({
    kind: z.literal('refund'),
    method: z.literal('transfer'),
    reference: referenceSchema,
  }).strict(),
  z.object({ kind: z.literal('store_credit') }).strict(),
])

export const unrepairedCloseoutRequestSchema = z.object({
  outcome: z.enum(['withdrawn', 'unrepairable']),
  charge: chargeSchema,
  parts: z.array(z.object({
    repairPartId: z.string().uuid(),
    disposition: z.enum(['consumed', 'restocked']),
  }).strict()).max(100),
  settlement: settlementSchema,
  reason: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().max(2_000).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).strict().superRefine((value, ctx) => {
  if (value.charge.mode === 'exceptional' && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'El importe excepcional requiere un motivo.' })
  }

  const ids = new Set<string>()
  value.parts.forEach((part, index) => {
    if (ids.has(part.repairPartId)) {
      ctx.addIssue({ code: 'custom', path: ['parts', index, 'repairPartId'], message: 'Cada repuesto debe resolverse una sola vez.' })
    }
    ids.add(part.repairPartId)
  })
})

export type UnrepairedCloseoutRequest = z.infer<typeof unrepairedCloseoutRequestSchema>
export type UnrepairedChargeMode = UnrepairedCloseoutRequest['charge']['mode']
export type UnrepairedPartDisposition = UnrepairedCloseoutRequest['parts'][number]['disposition']
export type UnrepairedSettlement = UnrepairedCloseoutRequest['settlement']

export function parseUnrepairedCloseoutRequest(input: unknown) {
  return unrepairedCloseoutRequestSchema.safeParse(input)
}

export type UnrepairedCloseoutPreviewInput = {
  chargeMode: UnrepairedChargeMode
  laborAmount: number
  exceptionalAmount: number
  paidAmount: number
  parts: Array<{ disposition: UnrepairedPartDisposition; quantity: number; unitPrice: number }>
}

export function getUnrepairedCloseoutPreview(input: UnrepairedCloseoutPreviewInput) {
  const laborCharge = input.chargeMode === 'labor' || input.chargeMode === 'labor_and_consumed_parts'
    ? Math.max(0, Number(input.laborAmount) || 0)
    : 0
  const consumedPartsCharge = input.chargeMode === 'labor_and_consumed_parts'
    ? input.parts.reduce((total, part) => part.disposition === 'consumed'
      ? total + Math.max(0, Number(part.quantity) || 0) * Math.max(0, Number(part.unitPrice) || 0)
      : total, 0)
    : 0
  const finalCharge = input.chargeMode === 'exceptional'
    ? Math.max(0, Number(input.exceptionalAmount) || 0)
    : laborCharge + consumedPartsCharge
  const paidAmount = Math.max(0, Number(input.paidAmount) || 0)

  return { laborCharge, consumedPartsCharge, finalCharge, paidAmount, difference: finalCharge - paidAmount }
}
