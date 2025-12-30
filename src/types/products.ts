// Legacy product types - DEPRECATED
// Use @/types/product-unified instead
// This file provides compatibility exports

export {
  Product,
  Category,
  Supplier,
  ProductAlert,
  ProductWithRelations,
  ProductInput,
  ProductDisplay
} from '@/types/product-unified'

// Legacy form data type - kept for compatibility
export interface ProductFormData {
  sku: string
  name: string
  description?: string | null
  category_id?: string | null
  brand?: string | null
  supplier_id?: string | null
  purchase_price: number
  sale_price: number
  wholesale_price?: number | null
  stock_quantity: number
  min_stock: number
  max_stock?: number
  unit_measure: string
  barcode?: string | null
  images?: string[] | null
  is_active: boolean
  featured?: boolean
  weight?: number | null
  dimensions?: Record<string, unknown> | null
  location?: string | null
  tags?: string[] | null
  // Additional fields for compatibility
  offer_price?: number
  has_offer?: boolean
}

// Additional legacy types that some components might need
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

export interface CategoryFormData {
  name: string
  description?: string
  parent_id?: string
  is_active: boolean
}

export interface SupplierFormData {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  is_active: boolean
}

export interface ProductFilters {
  search?: string
  category_id?: string
  supplier_id?: string
  brand?: string
  is_active?: boolean
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
  price_min?: number
  price_max?: number
}

export interface ProductSortOptions {
  field: 'name' | 'sku' | 'sale_price' | 'stock_quantity' | 'created_at' | 'updated_at'
  direction: 'asc' | 'desc'
}