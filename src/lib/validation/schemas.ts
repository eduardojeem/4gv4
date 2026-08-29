import { z } from 'zod'
import { SALE_STATUS, normalizeSaleStatus } from '@/lib/sales-status'
import {
  ProductAttributeDefinitionSchema,
  ProductVariantInputSchema,
} from '@/lib/products/variant-contract'

/**
 * Esquemas de validación de los endpoints.
 *
 * Los mensajes van en español porque las rutas los devuelven tal cual en
 * `details` de la respuesta 400 y la UI los muestra al usuario.
 */

// ============================================================================
// Product Schemas
// ============================================================================

const productVariantsFields = {
  has_variants: z.boolean().default(false),
  variant_attribute_config: z.array(ProductAttributeDefinitionSchema).default([]),
  variants: z.array(ProductVariantInputSchema).default([]),
}

const productBaseSchema = z.object({
  name: z.string()
    .min(1, 'El nombre del producto es obligatorio')
    .max(200, 'El nombre no puede superar los 200 caracteres'),
  
  sku: z.string()
    .min(1, 'El SKU es obligatorio')
    .max(50, 'El SKU no puede superar los 50 caracteres')
    .regex(/^[A-Z0-9-_]+$/i, 'El SKU solo admite letras, números, guiones y guiones bajos'),
  
  description: z.string()
    .max(2000, 'La descripción no puede superar los 2000 caracteres')
    .optional()
    .nullable(),
  
  category_id: z.string()
    .uuid('La categoría seleccionada no es válida')
    .optional()
    .nullable(),
  
  supplier_id: z.string()
    .uuid('El proveedor seleccionado no es válido')
    .optional()
    .nullable(),
  
  brand: z.string()
    .max(100, 'La marca no puede superar los 100 caracteres')
    .transform(v => v.trim().replace(/\b\w/g, c => c.toUpperCase()))
    .optional()
    .nullable(),

  brand_id: z.string()
    .uuid('La marca seleccionada no es válida')
    .optional()
    .nullable(),

  tags: z.array(z.string())
    .optional()
    .nullable(),
  
  stock_quantity: z.number()
    .int('El stock debe ser un número entero')
    .nonnegative('El stock no puede ser negativo')
    .default(0),
  
  min_stock: z.number()
    .int('El stock mínimo debe ser un número entero')
    .nonnegative('El stock mínimo no puede ser negativo')
    .default(0),

  max_stock: z.number()
    .int('El stock máximo debe ser un número entero')
    .nonnegative('El stock máximo no puede ser negativo')
    .optional()
    .nullable(),
  
  purchase_price: z.number()
    .nonnegative('El precio de compra no puede ser negativo'),
  
  sale_price: z.number()
    .positive('El precio de venta debe ser mayor a 0'),

  wholesale_price: z.number()
    .nonnegative('El precio mayorista no puede ser negativo')
    .optional()
    .nullable(),

  offer_price: z.number()
    .nonnegative('El precio de oferta no puede ser negativo')
    .optional()
    .nullable(),

  has_offer: z.boolean()
    .optional(),

  installments_enabled: z.boolean()
    .optional(),

  installments_public: z.boolean()
    .optional(),

  installments_plans: z.array(
    z.object({
      count: z.number().int().min(1).max(60),
      rate: z.number().min(0).max(1000),
    })
  ).optional(),

  is_active: z.boolean()
    .default(true),

  visibility: z.enum(['public', 'wholesale', 'hidden']).optional(),

  warranty_months: z.number()
    .int('Los meses de garantía deben ser un número entero')
    .nonnegative('Los meses de garantía no pueden ser negativos')
    .optional()
    .nullable(),

  warranty_info: z.string()
    .max(1000, 'La información de garantía no puede superar los 1000 caracteres')
    .optional()
    .nullable(),

  return_window_days: z.number()
    .int('Los días para devolución deben ser un número entero')
    .nonnegative('Los días para devolución no pueden ser negativos')
    .optional()
    .nullable(),

  exchange_window_days: z.number()
    .int('Los días para cambio deben ser un número entero')
    .nonnegative('Los días para cambio no pueden ser negativos')
    .optional()
    .nullable(),

  return_policy: z.string()
    .max(1000, 'La política de devolución no puede superar los 1000 caracteres')
    .optional()
    .nullable(),

  exchange_policy: z.string()
    .max(1000, 'La política de cambio no puede superar los 1000 caracteres')
    .optional()
    .nullable(),
  
  barcode: z.string()
    .max(50, 'El código de barras no puede superar los 50 caracteres')
    .optional()
    .nullable(),
  
  unit_measure: z.string()
    .max(20, 'La unidad de medida no puede superar los 20 caracteres')
    .default('unidad'),

  images: z.array(z.string())
    .optional()
    .nullable(),

  image_url: z.string()
    .max(2048, 'La URL de la imagen no puede superar los 2048 caracteres')
    .optional()
    .nullable(),

  ...productVariantsFields,
})

const validateProductVariants = (
  product: {
    has_variants?: boolean
    variant_attribute_config?: unknown[]
    variants?: unknown[]
  },
  context: z.RefinementCtx,
) => {
  if (!product.has_variants) return

  if (!product.variant_attribute_config?.length) {
    context.addIssue({
      code: 'custom',
      path: ['variant_attribute_config'],
      message: 'Agregá al menos un atributo para el producto con variantes',
    })
  }

  if (!product.variants?.length) {
    context.addIssue({
      code: 'custom',
      path: ['variants'],
      message: 'Agregá al menos una variante',
    })
  }
}

export const productSchema = productBaseSchema.superRefine(validateProductVariants)

export const productUpdateSchema = productBaseSchema.partial().extend({
  id: z.string().uuid('El producto seleccionado no es válido')
}).superRefine(validateProductVariants)

// ============================================================================
// Sale Item Schema
// ============================================================================

export const saleItemSchema = z.object({
  product_id: z.string()
    .uuid('El producto seleccionado no es válido'),
  
  quantity: z.number()
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser al menos 1'),
  
  unit_price: z.number()
    .nonnegative('El precio unitario no puede ser negativo'),
  
  total: z.number()
    .nonnegative('El total no puede ser negativo')
    .optional() // Can be calculated from quantity * unit_price
})

// ============================================================================
// Sale Schema
// ============================================================================

export const saleSchema = z.object({
  customer_id: z.string()
    .uuid('El cliente seleccionado no es válido')
    .optional()
    .nullable(),
  
  items: z.array(saleItemSchema)
    .min(1, 'La venta debe tener al menos un ítem')
    .max(100, 'Una venta no puede tener más de 100 ítems'),
  
  total_amount: z.number()
    .positive('El total debe ser mayor a 0'),
  
  tax_amount: z.number()
    .nonnegative('El IVA no puede ser negativo')
    .default(0),
  
  discount_amount: z.number()
    .nonnegative('El descuento no puede ser negativo')
    .default(0),
  
  payment_method: z.enum(['efectivo', 'tarjeta', 'transferencia']),
  
  status: z.enum(['pendiente', 'completada', 'cancelada', 'pending', 'completed', 'cancelled'])
    .optional()
    .transform((status) => normalizeSaleStatus(status) ?? SALE_STATUS.COMPLETED),
  
  notes: z.string()
    .max(500, 'Las notas no pueden superar los 500 caracteres')
    .optional()
}).refine(
  (data) => {
    // Validate that total_amount matches sum of items
    const itemsTotal = data.items.reduce((sum, item) => {
      const itemTotal = item.total ?? (item.quantity * item.unit_price)
      return sum + itemTotal
    }, 0)
    
    const expectedTotal = itemsTotal - data.discount_amount + (data.tax_amount || 0)
    const tolerance = 0.01 // Allow 1 cent difference for rounding
    
    return Math.abs(expectedTotal - data.total_amount) <= tolerance
  },
  {
    message: 'El total no coincide con la suma de los ítems menos el descuento más el IVA'
  }
)

export const saleUpdateSchema = z.object({
  id: z.string().uuid('La venta indicada no es válida'),
  status: z.enum(['pendiente', 'completada', 'cancelada', 'pending', 'completed', 'cancelled'])
    .optional()
    .transform((status) => (status ? normalizeSaleStatus(status) : undefined))
})

// ============================================================================
// Helper Types (exported for use in API routes)
// ============================================================================

export type ProductInput = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type SaleItemInput = z.infer<typeof saleItemSchema>
export type SaleInput = z.infer<typeof saleSchema>
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>
