/**
 * Unified Product Types
 * Consolidates Supabase schema with local extensions
 */

import type { Database } from '@/lib/supabase/types'

// Base types from Supabase
export type DbProduct = Database['public']['Tables']['products']['Row']
export type DbCategory = Database['public']['Tables']['categories']['Row']
export type DbSupplier = Database['public']['Tables']['suppliers']['Row']

// Json type compatibility
type Json = Database['public']['Tables']['products']['Row']['dimensions']

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
  
  // Legacy compatibility - ensure these exist
  stock_quantity: number
  sale_price: number
  purchase_price: number
  
  // Optional fields for compatibility
  description?: string | null
  max_stock?: number
  featured?: boolean
  
  // Additional legacy fields
  recent_movements?: ProductMovement[]
  alerts?: ProductAlert[]
  margin?: number
  total_value?: number
}

// Re-export for compatibility
export type Category = DbCategory
export type Supplier = DbSupplier

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
  movement_type: 'entrada' | 'salida' | 'ajuste' | 'venta' | 'reparacion'
  quantity: number
  previous_stock: number
  new_stock: number
  unit_cost?: number
  total_cost?: number
  reference_id?: string
  reference_type?: 'sale' | 'purchase' | 'repair' | 'adjustment'
  notes?: string
  user_id?: string
  created_at: string
  product?: Product
}

// Product with all relations populated
export type ProductWithRelations = Product & {
  category: DbCategory
  supplier: DbSupplier
}

// For forms and creation
export type ProductInput = Omit<DbProduct, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
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
export type LegacyProductAlert = ProductAlert