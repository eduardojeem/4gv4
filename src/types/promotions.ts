// Tipos de promociones
export type PromotionType = 
  | 'percentage'    // Descuento porcentual
  | 'fixed'         // Descuento fijo

// Tipos de aplicación
export type PromotionTarget = 
  | 'order'                 // Aplicar a toda la orden
  | 'product'               // Aplicar a productos específicos
  | 'category'              // Aplicar a categorías

// Promoción principal
export interface Promotion {
  id: string
  code: string
  name: string
  description?: string
  type: PromotionType
  value: number
  min_purchase?: number
  max_discount?: number
  
  // Productos/categorías aplicables
  applicable_products?: string[]
  applicable_categories?: string[]
  
  // Fechas de validez
  start_date: string
  end_date: string
  
  // Configuración adicional
  is_active: boolean
  usage_count: number
  usage_limit?: number
  
  // Metadatos
  created_at?: string
  updated_at?: string
}

// Resultado de aplicación de promoción
export interface PromotionResult {
  promotion_id: string
  code: string
  name: string
  type: PromotionType
  discount_amount: number
  applied: boolean
}

// Contexto para evaluación de promociones
export interface PromotionContext {
  cart_items: Array<{
    id: string
    product_id: string
    variant_id?: string
    sku: string
    name: string
    quantity: number
    unit_price: number
    category_id?: string
  }>
  order_total: number
  customer_id?: string
}

// Configuración del motor de promociones
export interface PromotionEngineConfig {
  max_promotions_per_order: number
  allow_stacking: boolean
  auto_apply_best_promotion: boolean
  priority_based_application: boolean
}

// Estadísticas de promociones
export interface PromotionStats {
  promotion_id: string
  promotion_name: string
  total_usage: number
  total_discount_given: number
  total_revenue_impact: number
  conversion_rate: number
  average_order_value_with_promotion: number
  period_start: string
  period_end: string
}

// Cupón de descuento
export interface Coupon {
  id: string
  code: string
  promotion_id: string
  
  // Límites específicos del cupón
  usage_limit?: number
  usage_limit_per_customer?: number
  current_usage: number
  
  // Fechas de validez
  start_date: string
  end_date?: string
  
  // Estado
  active: boolean
  
  // Metadatos
  created_at: string
  updated_at: string
}

// Historial de uso de promociones
export interface PromotionUsage {
  id: string
  promotion_id: string
  coupon_id?: string
  customer_id?: string
  order_id: string
  discount_amount: number
  used_at: string
}

// Regla de promoción personalizada
export interface CustomPromotionRule {
  id: string
  name: string
  description: string
  javascript_code: string // Código JavaScript para evaluación personalizada
  active: boolean
  created_at: string
  updated_at: string
}

// Plantilla de promoción
/*
export interface PromotionTemplate {
  id: string
  name: string
  description: string
  type: PromotionType
  category: 'seasonal' | 'loyalty' | 'clearance' | 'new_customer' | 'bulk' | 'custom'
  active: boolean
  created_at: string
  updated_at: string
}
*/