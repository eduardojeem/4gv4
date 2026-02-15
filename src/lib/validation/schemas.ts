import { z } from 'zod'

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
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  
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
  
  purchase_price: z.number()
    .nonnegative('Purchase price cannot be negative'),
  
  sale_price: z.number()
    .positive('Sale price must be greater than 0'),
  
  is_active: z.boolean()
    .default(true),
  
  barcode: z.string()
    .max(50, 'Barcode must be less than 50 characters')
    .optional()
    .nullable(),
  
  unit_measure: z.string()
    .max(20, 'Unit measure must be less than 20 characters')
    .default('unidad')
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
  
  status: z.enum(['pendiente', 'completada', 'cancelada'])
    .default('completada')
    .optional(),
  
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
  status: z.enum(['pendiente', 'completada', 'cancelada']).optional()
})

// ============================================================================
// Helper Types (exported for use in API routes)
// ============================================================================

export type ProductInput = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type SaleItemInput = z.infer<typeof saleItemSchema>
export type SaleInput = z.infer<typeof saleSchema>
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>
