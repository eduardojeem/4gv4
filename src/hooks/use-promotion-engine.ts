'use client'

import { useState, useCallback, useMemo } from 'react'
import { parseISO, isAfter, isBefore } from 'date-fns'
import { toast } from 'sonner'
import type { 
  CartItem, 
  Promotion, 
  PromotionResult, 
  CartSummary, 
  PromotionEngineConfig 
} from '@/types/promotion'

const DEFAULT_CONFIG: PromotionEngineConfig = {
  max_promotions_per_order: 1,
  allow_stacking: false,
  auto_apply_best_promotion: true,
  priority_based_application: true,
  tax_rate: 0.10 // 10% IVA
}

export function usePromotionEngine(config: Partial<PromotionEngineConfig> = {}) {
  const [appliedPromotions, setAppliedPromotions] = useState<PromotionResult[]>([])
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([])
  
  const engineConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  // Validate if a promotion can be applied
  const validatePromotion = useCallback((promotion: Promotion, cart: CartItem[]): { valid: boolean; reason?: string } => {
    const now = new Date()
    
    // Check if promotion is active
    if (!promotion.is_active) {
      return { valid: false, reason: 'Promoción inactiva' }
    }
    
    // Check date validity
    if (promotion.start_date) {
      const startDate = parseISO(promotion.start_date)
      if (isAfter(startDate, now)) {
        return { valid: false, reason: 'Promoción aún no válida' }
      }
    }
    
    if (promotion.end_date) {
      const endDate = parseISO(promotion.end_date)
      if (isBefore(endDate, now)) {
        return { valid: false, reason: 'Promoción expirada' }
      }
    }
    
    // Check usage limit
    if (promotion.usage_limit && promotion.usage_count && promotion.usage_count >= promotion.usage_limit) {
      return { valid: false, reason: 'Límite de uso alcanzado' }
    }
    
    // Check minimum purchase
    const cartTotal = cart.reduce((sum, item) => sum + item.total_price, 0)
    if (promotion.min_purchase && cartTotal < promotion.min_purchase) {
      return { valid: false, reason: `Compra mínima requerida: ${promotion.min_purchase.toLocaleString()}` }
    }
    
    // Check applicable products
    if (promotion.applicable_products && promotion.applicable_products.length > 0) {
      const hasApplicableProduct = cart.some(item => 
        promotion.applicable_products!.includes(item.product_id)
      )
      if (!hasApplicableProduct) {
        return { valid: false, reason: 'No hay productos aplicables en el carrito' }
      }
    }
    
    // Check applicable categories
    if (promotion.applicable_categories && promotion.applicable_categories.length > 0) {
      const hasApplicableCategory = cart.some(item => 
        item.category_id && promotion.applicable_categories!.includes(item.category_id)
      )
      if (!hasApplicableCategory) {
        return { valid: false, reason: 'No hay categorías aplicables en el carrito' }
      }
    }
    
    return { valid: true }
  }, [])

  // Calculate discount for a specific promotion
  const calculateDiscount = useCallback((promotion: Promotion, cart: CartItem[]): number => {
    let applicableAmount = 0
    
    // If promotion applies to specific products or categories, calculate only for those
    if (promotion.applicable_products?.length || promotion.applicable_categories?.length) {
      applicableAmount = cart
        .filter(item => {
          const matchesProduct = !promotion.applicable_products?.length || 
            promotion.applicable_products.includes(item.product_id)
          const matchesCategory = !promotion.applicable_categories?.length || 
            (item.category_id && promotion.applicable_categories.includes(item.category_id))
          return matchesProduct && matchesCategory
        })
        .reduce((sum, item) => sum + item.total_price, 0)
    } else {
      // Apply to entire cart
      applicableAmount = cart.reduce((sum, item) => sum + item.total_price, 0)
    }
    
    let discount = 0
    
    if (promotion.type === 'percentage') {
      discount = applicableAmount * (promotion.value / 100)
    } else if (promotion.type === 'fixed') {
      discount = promotion.value
    }
    
    // Apply maximum discount limit if set
    if (promotion.max_discount && discount > promotion.max_discount) {
      discount = promotion.max_discount
    }
    
    // Ensure discount doesn't exceed applicable amount
    return Math.min(discount, applicableAmount)
  }, [])

  // Apply a specific promotion by code
  const applyPromotionByCode = useCallback((code: string, cart: CartItem[], promotions: Promotion[]): PromotionResult => {
    const promotion = promotions.find(p => p.code.toLowerCase() === code.toLowerCase())
    
    if (!promotion) {
      return {
        promotion_id: '',
        code,
        name: '',
        type: 'fixed',
        discount_amount: 0,
        applied: false,
        reason: 'Código de promoción no válido'
      }
    }
    
    const validation = validatePromotion(promotion, cart)
    
    if (!validation.valid) {
      return {
        promotion_id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        discount_amount: 0,
        applied: false,
        reason: validation.reason
      }
    }
    
    const discountAmount = calculateDiscount(promotion, cart)
    
    return {
      promotion_id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      discount_amount: discountAmount,
      applied: true
    }
  }, [validatePromotion, calculateDiscount])

  // Find best applicable promotion automatically
  const findBestPromotion = useCallback((cart: CartItem[], promotions: Promotion[]): PromotionResult | null => {
    const validPromotions = promotions
      .filter(promotion => validatePromotion(promotion, cart).valid)
      .map(promotion => ({
        promotion,
        discount: calculateDiscount(promotion, cart)
      }))
      .sort((a, b) => b.discount - a.discount) // Sort by highest discount first
    
    if (validPromotions.length === 0) {
      return null
    }
    
    const best = validPromotions[0]
    
    return {
      promotion_id: best.promotion.id,
      code: best.promotion.code,
      name: best.promotion.name,
      type: best.promotion.type,
      discount_amount: best.discount,
      applied: true
    }
  }, [validatePromotion, calculateDiscount])

  // Apply multiple promotions with stacking rules
  const applyPromotions = useCallback((
    cart: CartItem[], 
    promotions: Promotion[], 
    promotionCodes: string[] = []
  ): PromotionResult[] => {
    const results: PromotionResult[] = []
    
    // Apply specific promotion codes first
    for (const code of promotionCodes) {
      const result = applyPromotionByCode(code, cart, promotions)
      results.push(result)
      
      // If stacking is not allowed and we have a successful promotion, stop here
      if (!engineConfig.allow_stacking && result.applied) {
        break
      }
    }
    
    // If auto-apply is enabled and no promotions were applied, find the best one
    if (engineConfig.auto_apply_best_promotion && !results.some(r => r.applied)) {
      const bestPromotion = findBestPromotion(cart, promotions)
      if (bestPromotion) {
        results.push(bestPromotion)
      }
    }
    
    // Respect maximum promotions per order
    const appliedResults = results.filter(r => r.applied).slice(0, engineConfig.max_promotions_per_order)
    const notAppliedResults = results.filter(r => !r.applied)
    
    return [...appliedResults, ...notAppliedResults]
  }, [engineConfig, applyPromotionByCode, findBestPromotion])

  // Calculate complete cart summary with promotions
  const calculateCartSummary = useCallback((
    cart: CartItem[], 
    promotions: Promotion[], 
    promotionCodes: string[] = []
  ): CartSummary => {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0)
    
    const promotionResults = applyPromotions(cart, promotions, promotionCodes)
    const discount_amount = promotionResults
      .filter(r => r.applied)
      .reduce((sum, r) => sum + r.discount_amount, 0)
    
    const taxable_amount = subtotal - discount_amount
    const tax_amount = taxable_amount * engineConfig.tax_rate
    const total = taxable_amount + tax_amount
    
    return {
      subtotal,
      discount_amount,
      tax_amount,
      total: Math.max(0, total), // Ensure total is never negative
      applied_promotions: promotionResults
    }
  }, [applyPromotions, engineConfig.tax_rate])

  // Get available promotions for a cart
  const getAvailablePromotions = useCallback((cart: CartItem[], promotions: Promotion[]): Promotion[] => {
    return promotions.filter(promotion => validatePromotion(promotion, cart).valid)
  }, [validatePromotion])

  // Preview promotion effect without applying
  const previewPromotion = useCallback((
    code: string, 
    cart: CartItem[], 
    promotions: Promotion[]
  ): { valid: boolean; discount: number; reason?: string } => {
    const result = applyPromotionByCode(code, cart, promotions)
    
    return {
      valid: result.applied,
      discount: result.discount_amount,
      reason: result.reason
    }
  }, [applyPromotionByCode])

  // Manage applied promotions state
  const addAppliedPromotion = useCallback((promotion: PromotionResult) => {
    setAppliedPromotions(prev => {
      // Remove existing promotion with same code
      const filtered = prev.filter(p => p.code !== promotion.code)
      
      // Add new promotion
      const updated = [...filtered, promotion]
      
      // Respect max promotions limit
      return updated.slice(0, engineConfig.max_promotions_per_order)
    })
  }, [engineConfig.max_promotions_per_order])

  const removeAppliedPromotion = useCallback((code: string) => {
    setAppliedPromotions(prev => prev.filter(p => p.code !== code))
  }, [])

  const clearAppliedPromotions = useCallback(() => {
    setAppliedPromotions([])
  }, [])

  // Bulk operations
  const validateMultipleCodes = useCallback((
    codes: string[], 
    cart: CartItem[], 
    promotions: Promotion[]
  ): { valid: string[]; invalid: { code: string; reason: string }[] } => {
    const valid: string[] = []
    const invalid: { code: string; reason: string }[] = []
    
    for (const code of codes) {
      const preview = previewPromotion(code, cart, promotions)
      if (preview.valid) {
        valid.push(code)
      } else {
        invalid.push({ code, reason: preview.reason || 'Código inválido' })
      }
    }
    
    return { valid, invalid }
  }, [previewPromotion])

  // Analytics and insights
  const getPromotionInsights = useCallback((cart: CartItem[], promotions: Promotion[]) => {
    const available = getAvailablePromotions(cart, promotions)
    const bestPromotion = findBestPromotion(cart, promotions)
    const potentialSavings = available.reduce((sum, promo) => {
      return sum + calculateDiscount(promo, cart)
    }, 0)
    
    return {
      availableCount: available.length,
      bestPromotion,
      potentialSavings,
      recommendedCodes: available.slice(0, 3).map(p => p.code)
    }
  }, [getAvailablePromotions, findBestPromotion, calculateDiscount])

  // Utility functions
  const formatDiscount = useCallback((amount: number, type: 'percentage' | 'fixed', value: number) => {
    if (type === 'percentage') {
      return `${value}% (${amount.toLocaleString('es-PY', { style: 'currency', currency: 'PYG' })})`
    }
    return amount.toLocaleString('es-PY', { style: 'currency', currency: 'PYG' })
  }, [])

  const getPromotionDescription = useCallback((promotion: Promotion) => {
    let description = promotion.description || promotion.name
    
    if (promotion.min_purchase) {
      description += ` (Compra mínima: ${promotion.min_purchase.toLocaleString('es-PY', { style: 'currency', currency: 'PYG' })})`
    }
    
    if (promotion.max_discount) {
      description += ` (Descuento máximo: ${promotion.max_discount.toLocaleString('es-PY', { style: 'currency', currency: 'PYG' })})`
    }
    
    return description
  }, [])

  // Error handling and notifications
  const handlePromotionError = useCallback((error: string, code?: string) => {
    const message = code ? `Error con promoción ${code}: ${error}` : `Error de promoción: ${error}`
    toast.error(message)
  }, [])

  const handlePromotionSuccess = useCallback((promotion: PromotionResult) => {
    const savings = promotion.discount_amount.toLocaleString('es-PY', { style: 'currency', currency: 'PYG' })
    toast.success(`¡Promoción aplicada! Ahorras ${savings}`)
  }, [])

  return {
    // State
    appliedPromotions,
    availablePromotions,
    engineConfig,
    
    // Core functions
    validatePromotion,
    calculateDiscount,
    applyPromotionByCode,
    findBestPromotion,
    applyPromotions,
    calculateCartSummary,
    
    // Utility functions
    getAvailablePromotions,
    previewPromotion,
    validateMultipleCodes,
    getPromotionInsights,
    formatDiscount,
    getPromotionDescription,
    
    // State management
    addAppliedPromotion,
    removeAppliedPromotion,
    clearAppliedPromotions,
    setAvailablePromotions,
    
    // Error handling
    handlePromotionError,
    handlePromotionSuccess
  }
}