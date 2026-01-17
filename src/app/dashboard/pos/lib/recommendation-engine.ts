/**
 * Recommendation Engine - Motor de recomendaciones inteligentes
 * 
 * Características:
 * - Productos frecuentemente comprados juntos
 * - Recomendaciones personalizadas
 * - Cross-selling automático
 * - Up-selling inteligente
 * - Aprendizaje continuo
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProductRecommendation {
  product_id: string
  product_name: string
  score: number
  reason: RecommendationReason
  confidence: number
}

export type RecommendationReason =
  | 'frequently_bought_together'
  | 'similar_category'
  | 'trending'
  | 'customer_history'
  | 'upsell'
  | 'cross_sell'

export interface PurchasePattern {
  product_ids: string[]
  frequency: number
  last_seen: Date
}

export interface CustomerPreference {
  customer_id: string
  favorite_categories: string[]
  favorite_products: string[]
  average_ticket: number
  purchase_frequency: number
}

export interface ProductAssociation {
  product_a: string
  product_b: string
  confidence: number
  support: number
  lift: number
}

// ============================================================================
// Recommendation Engine Class
// ============================================================================

class RecommendationEngine {
  // Purchase patterns (products bought together)
  private patterns: Map<string, PurchasePattern> = new Map()

  // Product associations (A -> B)
  private associations: Map<string, ProductAssociation[]> = new Map()

  // Customer preferences
  private customerPreferences: Map<string, CustomerPreference> = new Map()

  // Product metadata
  private productMetadata: Map<
    string,
    {
      name: string
      category: string
      price: number
      popularity: number
    }
  > = new Map()

  // Configuration
  private config = {
    minConfidence: 0.6,
    minSupport: 3,
    maxRecommendations: 5,
    decayFactor: 0.95, // Decay old patterns
  }

  /**
   * Record a purchase
   */
  recordPurchase(
    productIds: string[],
    customerId?: string,
    total?: number
  ): void {
    // Update patterns
    this.updatePatterns(productIds)

    // Update associations
    this.updateAssociations(productIds)

    // Update customer preferences
    if (customerId) {
      this.updateCustomerPreferences(customerId, productIds, total)
    }
  }

  /**
   * Update purchase patterns
   */
  private updatePatterns(productIds: string[]): void {
    // Sort to create consistent key
    const sortedIds = [...productIds].sort()
    const key = sortedIds.join(',')

    const existing = this.patterns.get(key)

    if (existing) {
      existing.frequency += 1
      existing.last_seen = new Date()
    } else {
      this.patterns.set(key, {
        product_ids: sortedIds,
        frequency: 1,
        last_seen: new Date(),
      })
    }
  }

  /**
   * Update product associations (A -> B)
   */
  private updateAssociations(productIds: string[]): void {
    // Create associations for each pair
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const productA = productIds[i]
        const productB = productIds[j]

        // A -> B
        this.addAssociation(productA, productB)

        // B -> A (bidirectional)
        this.addAssociation(productB, productA)
      }
    }
  }

  /**
   * Add single association
   */
  private addAssociation(productA: string, productB: string): void {
    const associations = this.associations.get(productA) || []

    const existing = associations.find((a) => a.product_b === productB)

    if (existing) {
      existing.support += 1
      // Recalculate confidence and lift
      existing.confidence = this.calculateConfidence(productA, productB)
      existing.lift = this.calculateLift(productA, productB)
    } else {
      associations.push({
        product_a: productA,
        product_b: productB,
        support: 1,
        confidence: this.calculateConfidence(productA, productB),
        lift: this.calculateLift(productA, productB),
      })
    }

    this.associations.set(productA, associations)
  }

  /**
   * Calculate confidence (P(B|A))
   */
  private calculateConfidence(productA: string, productB: string): number {
    const totalPurchases = this.getTotalPurchases()
    const purchasesWithA = this.getPurchasesWithProduct(productA)
    const purchasesWithBoth = this.getPurchasesWithBoth(productA, productB)

    if (purchasesWithA === 0) return 0

    return purchasesWithBoth / purchasesWithA
  }

  /**
   * Calculate lift
   */
  private calculateLift(productA: string, productB: string): number {
    const totalPurchases = this.getTotalPurchases()
    const purchasesWithB = this.getPurchasesWithProduct(productB)
    const confidence = this.calculateConfidence(productA, productB)

    if (purchasesWithB === 0 || totalPurchases === 0) return 0

    const expectedConfidence = purchasesWithB / totalPurchases

    return confidence / expectedConfidence
  }

  /**
   * Get total purchases
   */
  private getTotalPurchases(): number {
    return Array.from(this.patterns.values()).reduce(
      (sum, pattern) => sum + pattern.frequency,
      0
    )
  }

  /**
   * Get purchases with product
   */
  private getPurchasesWithProduct(productId: string): number {
    return Array.from(this.patterns.values())
      .filter((pattern) => pattern.product_ids.includes(productId))
      .reduce((sum, pattern) => sum + pattern.frequency, 0)
  }

  /**
   * Get purchases with both products
   */
  private getPurchasesWithBoth(productA: string, productB: string): number {
    return Array.from(this.patterns.values())
      .filter(
        (pattern) =>
          pattern.product_ids.includes(productA) &&
          pattern.product_ids.includes(productB)
      )
      .reduce((sum, pattern) => sum + pattern.frequency, 0)
  }

  /**
   * Update customer preferences
   */
  private updateCustomerPreferences(
    customerId: string,
    productIds: string[],
    total?: number
  ): void {
    const existing = this.customerPreferences.get(customerId)

    if (existing) {
      // Update favorite products
      productIds.forEach((id) => {
        if (!existing.favorite_products.includes(id)) {
          existing.favorite_products.push(id)
        }
      })

      // Update favorite categories
      productIds.forEach((id) => {
        const metadata = this.productMetadata.get(id)
        if (metadata && !existing.favorite_categories.includes(metadata.category)) {
          existing.favorite_categories.push(metadata.category)
        }
      })

      // Update average ticket
      if (total) {
        existing.average_ticket =
          (existing.average_ticket * existing.purchase_frequency + total) /
          (existing.purchase_frequency + 1)
      }

      existing.purchase_frequency += 1
    } else {
      const categories = productIds
        .map((id) => this.productMetadata.get(id)?.category)
        .filter((c): c is string => c !== undefined)

      this.customerPreferences.set(customerId, {
        customer_id: customerId,
        favorite_categories: [...new Set(categories)],
        favorite_products: productIds,
        average_ticket: total || 0,
        purchase_frequency: 1,
      })
    }
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  /**
   * Get recommendations based on cart
   */
  getRecommendations(
    cartProductIds: string[],
    customerId?: string
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = []

    // 1. Frequently bought together
    const frequentlyBought = this.getFrequentlyBoughtTogether(cartProductIds)
    recommendations.push(...frequentlyBought)

    // 2. Similar category
    const similarCategory = this.getSimilarCategoryProducts(cartProductIds)
    recommendations.push(...similarCategory)

    // 3. Customer history
    if (customerId) {
      const customerBased = this.getCustomerBasedRecommendations(
        customerId,
        cartProductIds
      )
      recommendations.push(...customerBased)
    }

    // 4. Upsell (higher price in same category)
    const upsell = this.getUpsellRecommendations(cartProductIds)
    recommendations.push(...upsell)

    // Remove duplicates and products already in cart
    const uniqueRecommendations = this.deduplicateRecommendations(
      recommendations,
      cartProductIds
    )

    // Sort by score and return top N
    return uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxRecommendations)
  }

  /**
   * Get frequently bought together
   */
  private getFrequentlyBoughtTogether(
    productIds: string[]
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = []

    for (const productId of productIds) {
      const associations = this.associations.get(productId) || []

      for (const assoc of associations) {
        if (
          assoc.confidence >= this.config.minConfidence &&
          assoc.support >= this.config.minSupport
        ) {
          const metadata = this.productMetadata.get(assoc.product_b)

          if (metadata) {
            recommendations.push({
              product_id: assoc.product_b,
              product_name: metadata.name,
              score: assoc.confidence * assoc.lift,
              reason: 'frequently_bought_together',
              confidence: assoc.confidence,
            })
          }
        }
      }
    }

    return recommendations
  }

  /**
   * Get similar category products
   */
  private getSimilarCategoryProducts(
    productIds: string[]
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = []

    // Get categories of cart products
    const categories = new Set(
      productIds
        .map((id) => this.productMetadata.get(id)?.category)
        .filter((c): c is string => c !== undefined)
    )

    // Find popular products in same categories
    for (const [productId, metadata] of this.productMetadata.entries()) {
      if (categories.has(metadata.category) && !productIds.includes(productId)) {
        recommendations.push({
          product_id: productId,
          product_name: metadata.name,
          score: metadata.popularity * 0.5, // Lower score than frequently bought
          reason: 'similar_category',
          confidence: 0.5,
        })
      }
    }

    return recommendations
  }

  /**
   * Get customer-based recommendations
   */
  private getCustomerBasedRecommendations(
    customerId: string,
    cartProductIds: string[]
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = []
    const preferences = this.customerPreferences.get(customerId)

    if (!preferences) return recommendations

    // Recommend from favorite products
    for (const productId of preferences.favorite_products) {
      if (!cartProductIds.includes(productId)) {
        const metadata = this.productMetadata.get(productId)

        if (metadata) {
          recommendations.push({
            product_id: productId,
            product_name: metadata.name,
            score: 0.7,
            reason: 'customer_history',
            confidence: 0.7,
          })
        }
      }
    }

    return recommendations
  }

  /**
   * Get upsell recommendations
   */
  private getUpsellRecommendations(
    productIds: string[]
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = []

    for (const productId of productIds) {
      const metadata = this.productMetadata.get(productId)

      if (!metadata) continue

      // Find products in same category with higher price
      for (const [otherId, otherMetadata] of this.productMetadata.entries()) {
        if (
          otherMetadata.category === metadata.category &&
          otherMetadata.price > metadata.price &&
          otherMetadata.price <= metadata.price * 1.5 && // Max 50% more expensive
          !productIds.includes(otherId)
        ) {
          recommendations.push({
            product_id: otherId,
            product_name: otherMetadata.name,
            score: 0.6,
            reason: 'upsell',
            confidence: 0.6,
          })
        }
      }
    }

    return recommendations
  }

  /**
   * Deduplicate recommendations
   */
  private deduplicateRecommendations(
    recommendations: ProductRecommendation[],
    excludeIds: string[]
  ): ProductRecommendation[] {
    const seen = new Set(excludeIds)
    const unique: ProductRecommendation[] = []

    for (const rec of recommendations) {
      if (!seen.has(rec.product_id)) {
        seen.add(rec.product_id)
        unique.push(rec)
      }
    }

    return unique
  }

  // ==========================================================================
  // Product Metadata
  // ==========================================================================

  /**
   * Set product metadata
   */
  setProductMetadata(
    productId: string,
    name: string,
    category: string,
    price: number,
    popularity: number = 0
  ): void {
    this.productMetadata.set(productId, {
      name,
      category,
      price,
      popularity,
    })
  }

  /**
   * Bulk set product metadata
   */
  setProductsMetadata(
    products: Array<{
      id: string
      name: string
      category: string
      price: number
      popularity?: number
    }>
  ): void {
    for (const product of products) {
      this.setProductMetadata(
        product.id,
        product.name,
        product.category,
        product.price,
        product.popularity || 0
      )
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get statistics
   */
  getStats(): {
    patterns: number
    associations: number
    customers: number
    products: number
  } {
    return {
      patterns: this.patterns.size,
      associations: Array.from(this.associations.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      customers: this.customerPreferences.size,
      products: this.productMetadata.size,
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.patterns.clear()
    this.associations.clear()
    this.customerPreferences.clear()
    this.productMetadata.clear()
  }

  /**
   * Export data
   */
  exportData(): {
    patterns: PurchasePattern[]
    associations: ProductAssociation[]
    customers: CustomerPreference[]
  } {
    return {
      patterns: Array.from(this.patterns.values()),
      associations: Array.from(this.associations.values()).flat(),
      customers: Array.from(this.customerPreferences.values()),
    }
  }

  /**
   * Import data
   */
  importData(data: {
    patterns?: PurchasePattern[]
    associations?: ProductAssociation[]
    customers?: CustomerPreference[]
  }): void {
    if (data.patterns) {
      for (const pattern of data.patterns) {
        const key = pattern.product_ids.join(',')
        this.patterns.set(key, pattern)
      }
    }

    if (data.associations) {
      for (const assoc of data.associations) {
        const existing = this.associations.get(assoc.product_a) || []
        existing.push(assoc)
        this.associations.set(assoc.product_a, existing)
      }
    }

    if (data.customers) {
      for (const customer of data.customers) {
        this.customerPreferences.set(customer.customer_id, customer)
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const recommendationEngine = new RecommendationEngine()
