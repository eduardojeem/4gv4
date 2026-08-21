import { z } from 'zod'

const sharedFields = {
  name: z.string().trim().min(2, 'Ingresa un nombre de al menos 2 caracteres.').max(200),
  sku: z.string().trim().max(50),
  salePrice: z.number().finite().positive('El precio de venta debe ser mayor que cero.'),
  wholesalePrice: z.number().finite().nonnegative().nullable(),
  purchasePrice: z.number().finite().nonnegative('El costo no puede ser negativo.'),
  categoryId: z.string().uuid().nullable(),
}

const catalogQuickCreateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('service'), ...sharedFields }),
  z.object({
    kind: z.literal('part'),
    ...sharedFields,
    initialStock: z.number().int().nonnegative('El stock no puede ser negativo.'),
  }),
])

export type CatalogQuickCreateInput = z.infer<typeof catalogQuickCreateSchema>

export function parseCatalogQuickCreateInput(input: unknown) {
  return catalogQuickCreateSchema.safeParse(input)
}

export function createCatalogSku(kind: CatalogQuickCreateInput['kind']) {
  const prefix = kind === 'service' ? 'SRV' : 'REP'
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export function toProductCreatePayload(
  input: CatalogQuickCreateInput,
  branchId: string,
  generatedSku = createCatalogSku(input.kind)
) {
  return {
    name: input.name.trim(),
    sku: input.sku.trim() || generatedSku,
    description: null,
    category_id: input.categoryId,
    supplier_id: null,
    brand: null,
    brand_id: null,
    stock_quantity: input.kind === 'part' ? input.initialStock : 0,
    min_stock: 0,
    max_stock: null,
    purchase_price: input.purchasePrice,
    sale_price: input.salePrice,
    wholesale_price: input.wholesalePrice,
    offer_price: null,
    has_offer: false,
    installments_enabled: false,
    installments_public: false,
    installments_plans: [],
    is_active: true,
    visibility: 'hidden' as const,
    warranty_months: 0,
    warranty_info: null,
    return_window_days: 0,
    exchange_window_days: 0,
    return_policy: null,
    exchange_policy: null,
    barcode: null,
    unit_measure: input.kind === 'service' ? 'servicio' : 'unidad',
    images: [],
    image_url: null,
    branch_id: branchId,
  }
}
