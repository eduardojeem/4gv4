// Tipos centralizados para el sistema de promociones

export type PromotionType = 'percentage' | 'fixed'

export interface Promotion {
  id: string
  name: string
  code: string
  description?: string
  type: PromotionType
  value: number
  min_purchase?: number
  max_discount?: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_count?: number
  usage_limit?: number | null
  applicable_products?: string[]
  applicable_categories?: string[]
  created_at?: string
  updated_at?: string
}

export interface CartItem {
  id: string
  product_id: string
  variant_id?: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  category_id?: string
  total_price: number
}

export interface PromotionResult {
  promotion_id: string
  code: string
  name: string
  type: PromotionType
  discount_amount: number
  applied: boolean
  reason?: string
}

export interface CartSummary {
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  applied_promotions: PromotionResult[]
}

export interface PromotionFilters {
  search: string
  status: 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'
  type: 'all' | 'percentage' | 'fixed'
}

export interface PromotionStats {
  total: number
  active: number
  scheduled: number
  expired: number
  inactive: number
  totalUsage: number
  expiringSoon: number
}

export interface PromotionEngineConfig {
  max_promotions_per_order: number
  allow_stacking: boolean
  auto_apply_best_promotion: boolean
  priority_based_application: boolean
  tax_rate: number
}