import { z } from 'zod'

export const CalendarDateSchema = z.string().date('Ingresá una fecha de calendario válida')
export const OptionalCalendarDateSchema = z.union([CalendarDateSchema, z.literal('')]).nullish()
const short = z.string().trim().max(120, 'Usá hasta 120 caracteres.').optional()
const text = z.string().trim().max(1000, 'Usá hasta 1000 caracteres.').optional()
export const ProductDetailsSchema = z.object({
  line: short, tone: short, volume: short, skin_type: short, presentation: short,
  net_content: short, ingredients: text, usage: text, storage: text,
  pao_months: z.number().int('Ingresá meses enteros.').min(1, 'El PAO debe ser de al menos 1 mes.').max(120, 'El PAO no puede superar 120 meses.').optional(),
  expiry_policy: z.enum(['unspecified', 'not_applicable', 'tracked']).optional(),
  material: short, measure: short, model: short, compatibility: short, hair_type: short, hold: short,
})
export type ProductDetails = z.infer<typeof ProductDetailsSchema>
export function cleanProductDetails(value: ProductDetails | undefined, variantKeys: string[] = []): ProductDetails {
  return ProductDetailsSchema.parse(Object.fromEntries(Object.entries(value ?? {}).filter(([key, val]) => !variantKeys.includes(key) && val !== '' && val !== undefined && val !== null)))
}
export const InitialVariantBatchSchema = z.object({
  variant_key: z.string().min(1), lot_code: z.string().trim().max(60).optional().nullable(), expires_on: OptionalCalendarDateSchema,
})
export const ApiVariantBatchSchema = z.object({ sku: z.string().trim().min(1).max(50).transform(value => value.toUpperCase()), lot_code: z.string().trim().max(60).optional().nullable(), expires_on: CalendarDateSchema })

/** Se usa antes de validar: un campo oculto de inventario no bloquea ni contamina un servicio. */
export function normalizeServiceProduct(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const data = value as Record<string, unknown>
  if (data.unit_measure !== 'servicio') return value
  return { ...data, stock_quantity: 0, min_stock: 0, max_stock: 0, has_variants: false, variants: [], variant_attribute_config: [], initial_lot_code: '', initial_expires_on: '', initial_batch: null, initial_variant_batches: [], initial_batches: [], product_details: undefined }
}
