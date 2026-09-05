
/**
 * Unified Product Types
 * Consolidates Supabase schema with local extensions
 */

import type { Database } from '@/lib/supabase/types'
import type { ProductAttributeDefinition, ProductVariantInput } from '@/lib/products/variant-contract'

// Base types from Supabase
export type DbProduct = Database['public']['Tables']['products']['Row']
export type DbCategory = Database['public']['Tables']['categories']['Row']
export type DbSupplier = Database['public']['Tables']['suppliers']['Row']
export type DbBrand = Database['public']['Tables']['brands']['Row']

// Json type compatibility
type Json = Database['public']['Tables']['products']['Row']['dimensions']

export interface InstallmentPlanOption {
  count: number
  rate: number
}

export type ProductVariantRecord = ProductVariantInput | {
  id: string
  variant_name?: string | null
  name?: string | null
  attributes: Record<string, string>
  sku: string
  barcode?: string | null
  purchase_price?: number | null
  sale_price?: number | null
  wholesale_price?: number | null
  stock_quantity?: number | null
  min_stock?: number | null
  is_active?: boolean | null
}

// Unified Product type - extends Supabase with computed fields and compatibility
export type Product = Omit<DbProduct, 'dimensions'> & {
  // Fix dimensions type compatibility
  dimensions?: Record<string, unknown> | null | string
  
  // Relations (populated via joins)
  category?: DbCategory
  supplier?: DbSupplier
  
  // Computed fields
  margin_amount?: number
  margin_percentage?: number
  stock_value?: number
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
  
  // New field
  visibility?: 'public' | 'wholesale' | 'hidden'

  // Financing configuration (columns may be newer than generated DB types)
  installments_enabled?: boolean | null
  installments_public?: boolean | null
  installments_plans?: InstallmentPlanOption[] | null

  // Configuración completa usada por el editor y por las vistas de inventario.
  // La API puede devolver filas DB (snake_case) o el contrato del formulario.
  has_variants?: boolean | null
  variant_attribute_config?: ProductAttributeDefinition[] | null
  variants?: ProductVariantRecord[]

  // Legacy compatibility - ensure these exist
  stock_quantity: number
  sale_price: number
  purchase_price: number
  
  // Optional fields for compatibility
  description?: string | null
  max_stock?: number
  featured?: boolean
  image?: string
  
  // Offer fields
  offer_price?: number
  has_offer?: boolean

  // Additional legacy fields
  recent_movements?: ProductMovement[]
  alerts?: ProductAlert[]
  margin?: number
  total_value?: number
}

// Re-export for compatibility
export type Category = DbCategory
export type Supplier = DbSupplier
export type Brand = DbBrand

// Product Alert type (moved from products.ts)
export interface ProductAlert {
  id: string
  product_id: string
  type: 'low_stock' | 'out_of_stock' | 'expiring' | 'price_change' | 'no_supplier' | 'no_category' | 'no_image' | 'inactive_with_sales' | 'new_product' | 'missing_supplier' | 'missing_category' | 'missing_image'
  message: string
  severity?: 'low' | 'medium' | 'high'
  is_read?: boolean
  read: boolean
  is_resolved: boolean
  created_at: string
  updated_at?: string
  product_name?: string
  details?: {
    current_stock?: number
    min_stock?: number
    last_sale?: string
    old_price?: number
    new_price?: number
    [key: string]: any
  }
  // DB compatibility
  alert_type?: string
  resolved_at?: string | null
}

// Product Movement type for compatibility
export interface ProductMovement {
  id: string
  product_id: string
  // La BD puede contener valores en español (legacy) o inglés (nuevo RPC)
  movement_type: 'in' | 'out' | 'adjustment' | 'transfer' | 'entrada' | 'salida' | 'ajuste' | 'venta' | 'reparacion'
  quantity: number
  previous_stock: number
  new_stock: number
  unit_cost?: number
  total_cost?: number
  reference_id?: string
  reference_type?: string
  notes?: string
  user_id?: string
  branch_id?: string
  created_at: string
  // El join solo trae name y sku, no el tipo Product completo
  product?: { name: string; sku: string }
}

// Product with all relations populated
export type ProductWithRelations = Product & {
  category: DbCategory
  supplier: DbSupplier
  brand_data: DbBrand
}

// For forms and creation
export type ProductInput = Omit<DbProduct, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
  visibility?: 'public' | 'wholesale' | 'hidden'
}

// For display/UI components
export type ProductDisplay = Product & {
  // Additional display fields
  categoryName?: string
  supplierName?: string
  formattedPrice?: string
  stockStatusLabel?: string
}

// Legacy compatibility exports - gradually migrate away from these
export type LegacyProduct = Product
export type LegacyCategory = Category
export type LegacySupplier = Supplier
export type LegacyBrand = Brand
export type LegacyProductAlert = ProductAlert
