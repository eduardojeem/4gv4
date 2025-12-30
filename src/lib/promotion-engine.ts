import { 
  Promotion, 
  PromotionContext, 
  PromotionResult, 
  PromotionEngineConfig 
} from '@/types/promotions'

export class PromotionEngine {
  private config: PromotionEngineConfig

  constructor(config: PromotionEngineConfig = {
    max_promotions_per_order: 1,
    allow_stacking: false,
    auto_apply_best_promotion: true,
    priority_based_application: false
  }) {
    this.config = config
  }

  /**
   * Evalúa todas las promociones aplicables y devuelve los resultados
   */
  async evaluatePromotions(
    promotions: Promotion[], 
    context: PromotionContext
  ): Promise<PromotionResult[]> {
    const applicablePromotions = promotions.filter(promotion => 
      this.isPromotionApplicable(promotion, context)
    )

    // Si no se permite apilar, o si queremos la mejor promoción, calculamos todas y decidimos
    const results: PromotionResult[] = []

    for (const promotion of applicablePromotions) {
      const result = this.applyPromotion(promotion, context)
      if (result && result.discount_amount > 0) {
        results.push(result)
      }
    }

    // Si está habilitado auto-aplicar mejor promoción, devolver solo la mejor
    if (this.config.auto_apply_best_promotion && results.length > 1) {
      const bestPromotion = results.reduce((best, current) => 
        current.discount_amount > best.discount_amount ? current : best
      )
      return [bestPromotion]
    }

    // Si no se permite apilar pero no estamos buscando la mejor (simplemente la primera válida)
    if (!this.config.allow_stacking && results.length > 0) {
      return [results[0]]
    }

    // Limitar número de promociones
    if (results.length > this.config.max_promotions_per_order) {
      return results.slice(0, this.config.max_promotions_per_order)
    }

    return results
  }

  /**
   * Verifica si una promoción es aplicable en el contexto actual
   */
  private isPromotionApplicable(promotion: Promotion, context: PromotionContext): boolean {
    // Verificar si está activa
    if (!promotion.is_active) return false

    // Verificar fechas de validez
    const now = new Date()
    if (promotion.start_date) {
      const startDate = new Date(promotion.start_date)
      if (now < startDate) return false
    }
    
    if (promotion.end_date) {
      const endDate = new Date(promotion.end_date)
      if (now > endDate) return false
    }

    // Verificar monto mínimo de compra
    if (promotion.min_purchase && context.order_total < promotion.min_purchase) {
      return false
    }

    // Verificar productos aplicables
    if (promotion.applicable_products && promotion.applicable_products.length > 0) {
      const hasApplicableProduct = context.cart_items.some(item => 
        promotion.applicable_products!.includes(item.product_id)
      )
      if (!hasApplicableProduct) return false
    }

    // Verificar categorías aplicables
    if (promotion.applicable_categories && promotion.applicable_categories.length > 0) {
      const hasApplicableCategory = context.cart_items.some(item => 
        item.category_id && promotion.applicable_categories!.includes(item.category_id)
      )
      if (!hasApplicableCategory) return false
    }

    return true
  }

  /**
   * Aplica una promoción y calcula el descuento
   */
  private applyPromotion(promotion: Promotion, context: PromotionContext): PromotionResult | null {
    let discountAmount = 0

    if (promotion.type === 'percentage') {
      discountAmount = this.calculatePercentageDiscount(promotion, context)
    } else if (promotion.type === 'fixed') {
      discountAmount = promotion.value
    }

    // Aplicar límite de descuento máximo si existe
    if (promotion.max_discount && discountAmount > promotion.max_discount) {
      discountAmount = promotion.max_discount
    }

    // Asegurarse de no descontar más del total
    if (discountAmount > context.order_total) {
      discountAmount = context.order_total
    }

    if (discountAmount <= 0) return null

    return {
      promotion_id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      discount_amount: discountAmount,
      applied: true
    }
  }

  /**
   * Calcula descuento porcentual
   */
  private calculatePercentageDiscount(
    promotion: Promotion, 
    context: PromotionContext
  ): number {
    let baseAmount = context.order_total

    // Si es específico para productos, calcular solo sobre esos productos
    if (promotion.applicable_products && promotion.applicable_products.length > 0) {
      baseAmount = context.cart_items
        .filter(item => promotion.applicable_products!.includes(item.product_id))
        .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    }
    // Si es específico para categorías
    else if (promotion.applicable_categories && promotion.applicable_categories.length > 0) {
      baseAmount = context.cart_items
        .filter(item => item.category_id && promotion.applicable_categories!.includes(item.category_id))
        .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    }

    return baseAmount * (promotion.value / 100)
  }
}