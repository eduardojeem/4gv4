import { z } from 'zod'
import { computeTotals } from '@/lib/quotes/quote-math'

/** Lo que manda el editor al crear o guardar un presupuesto. */
export const quoteInputSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().trim().min(1, 'Poné el nombre del cliente').max(160),
  customer_phone: z.string().trim().max(40).nullable().optional(),
  customer_email: z.string().trim().max(160).nullable().optional(),
  customer_ruc: z.string().trim().max(30).nullable().optional(),
  price_mode: z.enum(['retail', 'wholesale']).default('retail'),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid().nullable().optional(),
    variant_id: z.string().uuid().nullable().optional(),
    description: z.string().trim().min(1, 'Cada línea necesita una descripción').max(300),
    sku: z.string().trim().max(100).nullable().optional(),
    quantity: z.number().int('La cantidad es un número entero').min(1).max(100000),
    unit_price: z.number().min(0).max(10_000_000_000),
    discount_rate: z.number().min(0).max(100).default(0),
  })).min(1, 'Agregá al menos un producto o servicio').max(100, 'Máximo 100 líneas por presupuesto'),
})

export type QuoteInput = z.infer<typeof quoteInputSchema>

export const QUOTE_COLUMNS = 'id, number, customer_id, customer_name, customer_phone, customer_email, customer_ruc, status, price_mode, valid_until, notes, currency, subtotal, discount_total, total, share_token, sale_id, sent_at, converted_at, created_at, updated_at'
export const QUOTE_ITEM_COLUMNS = 'id, position, product_id, variant_id, description, sku, quantity, unit_price, discount_rate, line_total'

/** Encabezado y líneas listos para la base, con los totales recalculados en el servidor. */
export function quoteRows(input: QuoteInput, organizationId: string, currency: string) {
  const totals = computeTotals(input.items, currency)
  const header = {
    customer_id: input.customer_id ?? null,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone || null,
    customer_email: input.customer_email || null,
    customer_ruc: input.customer_ruc || null,
    price_mode: input.price_mode,
    valid_until: input.valid_until || null,
    notes: input.notes || null,
    currency,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    total: totals.total,
  }
  const items = totals.lines.map((line, position) => ({
    organization_id: organizationId,
    position,
    product_id: line.product_id ?? null,
    variant_id: line.product_id ? line.variant_id ?? null : null,
    description: line.description,
    sku: line.sku || null,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_rate: line.discount_rate,
    line_total: line.line_total,
  }))
  return { header, items }
}

export function validationError(error: z.ZodError) {
  const first = error.issues[0]
  return first?.message && !first.message.startsWith('Invalid') ? first.message : 'Revisá los datos del presupuesto'
}
