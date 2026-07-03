import { z } from 'zod'
import { SALE_STATUS, normalizeSaleStatus } from '@/lib/sales-status'

/**
 * Validation schemas for API endpoints
 * Using Zod for runtime type checking and validation
 */

// ============================================================================
// Product Schemas
// ============================================================================

export const productSchema = z.object({
  name: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Product name must be less than 200 characters'),
  
  sku: z.string()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be less than 50 characters')
    .regex(/^[A-Z0-9-_]+$/i, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .nullable(),
  
  category_id: z.string()
    .uuid('Invalid category ID')
    .optional()
    .nullable(),
  
  supplier_id: z.string()
    .uuid('Invalid supplier ID')
    .optional()
    .nullable(),
  
  brand: z.string()
    .max(100, 'Brand name must be less than 100 characters')
    .transform(v => v.trim().replace(/\b\w/g, c => c.toUpperCase()))
    .optional()
    .nullable(),

  brand_id: z.string()
    .uuid('Invalid brand ID')
    .optional()
    .nullable(),
  
  stock_quantity: z.number()
    .int('Stock quantity must be a whole number')
    .nonnegative('Stock quantity cannot be negative')
    .default(0),
  
  min_stock: z.number()
    .int('Minimum stock must be a whole number')
    .nonnegative('Minimum stock cannot be negative')
    .default(0),

  max_stock: z.number()
    .int('Maximum stock must be a whole number')
    .nonnegative('Maximum stock cannot be negative')
    .optional()
    .nullable(),
  
  purchase_price: z.number()
    .nonnegative('Purchase price cannot be negative'),
  
  sale_price: z.number()
    .positive('Sale price must be greater than 0'),

  wholesale_price: z.number()
    .nonnegative('Wholesale price cannot be negative')
    .optional()
    .nullable(),

  offer_price: z.number()
    .nonnegative('Offer price cannot be negative')
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
    .int('Warranty months must be a whole number')
    .nonnegative('Warranty months cannot be negative')
    .optional()
    .nullable(),

  warranty_info: z.string()
    .max(1000, 'Warranty info must be less than 1000 characters')
    .optional()
    .nullable(),

  return_window_days: z.number()
    .int('Return window days must be a whole number')
    .nonnegative('Return window days cannot be negative')
    .optional()
    .nullable(),

  exchange_window_days: z.number()
    .int('Exchange window days must be a whole number')
    .nonnegative('Exchange window days cannot be negative')
    .optional()
    .nullable(),

  return_policy: z.string()
    .max(1000, 'Return policy must be less than 1000 characters')
    .optional()
    .nullable(),

  exchange_policy: z.string()
    .max(1000, 'Exchange policy must be less than 1000 characters')
    .optional()
    .nullable(),
  
  barcode: z.string()
    .max(50, 'Barcode must be less than 50 characters')
    .optional()
    .nullable(),
  
  unit_measure: z.string()
    .max(20, 'Unit measure must be less than 20 characters')
    .default('unidad'),

  images: z.array(z.string())
    .optional()
    .nullable(),

  image_url: z.string()
    .max(2048, 'Image URL must be less than 2048 characters')
    .optional()
    .nullable(),
})

export const productUpdateSchema = productSchema.partial().extend({
  id: z.string().uuid('Invalid product ID')
})

// ============================================================================
// Sale Item Schema
// ============================================================================

export const saleItemSchema = z.object({
  product_id: z.string()
    .uuid('Invalid product ID'),
  
  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1'),
  
  unit_price: z.number()
    .nonnegative('Unit price cannot be negative'),
  
  total: z.number()
    .nonnegative('Total cannot be negative')
    .optional() // Can be calculated from quantity * unit_price
})

// ============================================================================
// Sale Schema
// ============================================================================

export const saleSchema = z.object({
  customer_id: z.string()
    .uuid('Invalid customer ID')
    .optional()
    .nullable(),
  
  items: z.array(saleItemSchema)
    .min(1, 'Sale must have at least one item')
    .max(100, 'Cannot have more than 100 items in a single sale'),
  
  total_amount: z.number()
    .positive('Total amount must be greater than 0'),
  
  tax_amount: z.number()
    .nonnegative('Tax amount cannot be negative')
    .default(0),
  
  discount_amount: z.number()
    .nonnegative('Discount amount cannot be negative')
    .default(0),
  
  payment_method: z.enum(['efectivo', 'tarjeta', 'transferencia']),
  
  status: z.enum(['pendiente', 'completada', 'cancelada', 'pending', 'completed', 'cancelled'])
    .optional()
    .transform((status) => normalizeSaleStatus(status) ?? SALE_STATUS.COMPLETED),
  
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
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
    message: 'Total amount does not match items total minus discount plus tax'
  }
)

export const saleUpdateSchema = z.object({
  id: z.string().uuid('Invalid sale ID'),
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
