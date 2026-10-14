/**
 * «No lo tengo, lo compro»: el taller compra un repuesto para una reparación.
 *
 * Antes había que crearlo en el catálogo (con stock inicial 0 el sistema no lo
 * dejaba usar) y la compra no quedaba en ningún lado: ni a qué proveedor ni si
 * salió de la caja. Ahora, en un paso: el repuesto entra a la reparación con su
 * costo, la compra queda como gasto en Finanzas (pagado o a pagar) y, si
 * todavía no llegó, la reparación queda «esperando repuesto».
 */
import { z } from 'zod'
import type { RepairCostPartIntent, RepairCostSaveIntent } from './save-cost-revision'
import type { RepairLineType } from './line-types'
import type { RepairTaxRate } from './cost-breakdown'

export const PART_PURCHASE_PAYMENTS = ['cash', 'bank_transfer', 'owed'] as const
export type PartPurchasePayment = (typeof PART_PURCHASE_PAYMENTS)[number]

export const partPurchaseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  name: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(1000),
  /** Lo que le costó al taller, por unidad. */
  unitCost: z.coerce.number().finite().min(0).max(1_000_000_000),
  /** Lo que se le cobra al cliente, por unidad. */
  unitPrice: z.coerce.number().finite().min(0).max(1_000_000_000),
  supplier: z.string().trim().max(200).optional().nullable().transform((value) => value || null),
  /** Si se guardó en el catálogo antes (con stock = cantidad comprada). */
  productId: z.string().uuid().optional().nullable(),
  payment: z.enum(PART_PURCHASE_PAYMENTS),
  arrived: z.boolean(),
  expectedOn: z.iso.date().optional().nullable(),
}).strict().superRefine((input, ctx) => {
  if (input.unitPrice < input.unitCost) {
    ctx.addIssue({ code: 'custom', path: ['unitPrice'], message: 'Lo que cobrás no cubre lo que te costó el repuesto.' })
  }
})

export type PartPurchaseInput = z.infer<typeof partPurchaseSchema>

/** Lo que guarda la reparación mientras espera el repuesto (en `repairs.metadata`). */
export type WaitingPart = {
  name: string
  supplier: string | null
  expected_on: string | null
  ordered_at: string
}

export function readWaitingPart(metadata: unknown): WaitingPart | null {
  const value = metadata && typeof metadata === 'object' ? (metadata as { waiting_part?: unknown }).waiting_part : null
  if (!value || typeof value !== 'object') return null
  const part = value as Partial<WaitingPart>
  if (typeof part.name !== 'string' || !part.name) return null
  return {
    name: part.name,
    supplier: typeof part.supplier === 'string' ? part.supplier : null,
    expected_on: typeof part.expected_on === 'string' ? part.expected_on : null,
    ordered_at: typeof part.ordered_at === 'string' ? part.ordered_at : new Date(0).toISOString(),
  }
}

type RepairPartRow = {
  product_id?: string | null
  part_name?: string | null
  part_number?: string | null
  supplier?: string | null
  quantity?: number | string | null
  unit_price?: number | string | null
  unit_cost?: number | string | null
  discount_amount?: number | string | null
  tax_rate?: number | string | null
  line_type?: string | null
}

type RepairCostRow = {
  labor_cost?: number | string | null
  additional_charges?: number | string | null
  deductions?: number | string | null
  discount_amount?: number | string | null
  price_override_reason?: string | null
  parts?: RepairPartRow[] | null
}

const amount = (value: unknown) => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const taxRate = (value: unknown): RepairTaxRate | undefined => {
  const number = Number(value)
  return number === 0 || number === 5 || number === 10 ? number : undefined
}

/**
 * La revisión de costos completa: lo que la reparación ya tenía, sin tocar, más
 * el repuesto comprado. Es la misma operación que hace el editor de costos.
 */
export function costIntentWithPurchase(repair: RepairCostRow, input: PartPurchaseInput): RepairCostSaveIntent {
  const existing: RepairCostPartIntent[] = (repair.parts ?? [])
    .filter((part) => (part.part_name ?? '').trim())
    .map((part) => ({
      productId: part.product_id ?? null,
      name: String(part.part_name).trim(),
      partNumber: part.part_number ?? null,
      supplier: part.supplier ?? null,
      quantity: Math.max(1, Math.trunc(Number(part.quantity) || 1)),
      unitPrice: amount(part.unit_price ?? part.unit_cost),
      unitCost: amount(part.unit_cost),
      discountAmount: amount(part.discount_amount),
      taxRate: taxRate(part.tax_rate),
      lineType: (part.line_type as RepairLineType | null) ?? 'charged_part',
    }))
  return {
    laborAmount: amount(repair.labor_cost),
    additionalCharges: amount(repair.additional_charges),
    deductions: amount(repair.deductions),
    discountAmount: amount(repair.discount_amount),
    overrideReason: repair.price_override_reason ?? null,
    idempotencyKey: `${input.idempotencyKey}:costs`,
    parts: [
      ...existing,
      {
        productId: input.productId ?? null,
        name: input.name,
        partNumber: null,
        supplier: input.supplier,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        unitCost: input.unitCost,
        discountAmount: 0,
        lineType: 'charged_part',
      },
    ],
  }
}

/** Concepto del gasto: se lee en la lista de Finanzas sin abrir la reparación. */
export function purchaseConcept(input: Pick<PartPurchaseInput, 'name' | 'quantity'>, ticket: string | null) {
  const qty = input.quantity > 1 ? `${input.quantity} × ` : ''
  return `Repuesto: ${qty}${input.name}${ticket ? ` · Reparación ${ticket}` : ''}`.slice(0, 200)
}

/** Marca del gasto en sus notas: con ella un reintento encuentra el gasto ya creado. */
export const purchaseExpenseMarker = (idempotencyKey: string) => `repair-part-purchase:${idempotencyKey}`

/** Margen sugerido para el precio al cliente cuando todavía no se escribió. */
export function suggestedPartPrice(unitCost: number, marginPercent = 40) {
  if (!(unitCost > 0)) return 0
  return Math.ceil((unitCost * (1 + marginPercent / 100)) / 1000) * 1000
}

/** Mensaje de WhatsApp para avisar que llegó el repuesto. */
export function partArrivedMessage(customerName: string | null | undefined, partName: string, device: string) {
  const greeting = customerName ? `Hola ${customerName.split(' ')[0]}` : 'Hola'
  return `${greeting}, te avisamos que ya llegó el repuesto (${partName}) para tu ${device}. Seguimos con la reparación y te avisamos cuando esté listo.`
}
