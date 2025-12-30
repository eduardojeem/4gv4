/**
 * Sistema de Analytics para Productos
 * Permite validar los cambios mediante métricas de usabilidad y feedback
 */

// Tipos para eventos de analytics
export interface ProductAnalyticsEvent {
  event_type: string
  user_id?: string
  session_id: string
  timestamp: Date
  page_url: string
  product_id?: string
  metadata?: Record<string, any>
}

export interface UserInteractionEvent extends ProductAnalyticsEvent {
  event_type: 'user_interaction'
  interaction_type: 'click' | 'hover' | 'scroll' | 'search' | 'filter' | 'sort'
  element_id: string
  element_type: string
  duration_ms?: number
}

export interface PerformanceEvent extends ProductAnalyticsEvent {
  event_type: 'performance'
  metric_name: string
  metric_value: number
  metric_unit: string
}

export interface ErrorEvent extends ProductAnalyticsEvent {
  event_type: 'error'
  error_type: string
  error_message: string
  stack_trace?: string
}

export interface ConversionEvent extends ProductAnalyticsEvent {
  event_type: 'conversion'
  action: 'product_view' | 'product_edit' | 'product_create' | 'product_delete' | 'add_to_cart'
  success: boolean
  time_to_complete_ms?: number
}

// Clase principal para analytics
export class ProductAnalytics {
  private sessionId: string
  private userId?: string
  private events: ProductAnalyticsEvent[] = []

  constructor(userId?: string) {
    this.sessionId = this.generateSessionId()
    this.userId = userId
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Registra una interacción del usuario
   */
  trackUserInteraction(
    interactionType: UserInteractionEvent['interaction_type'],
    elementId: string,
    elementType: string,
    metadata?: Record<string, any>
  ): void {
    const event: UserInteractionEvent = {
      event_type: 'user_interaction',
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: new Date(),
      page_url: window.location.href,
      interaction_type: interactionType,
      element_id: elementId,
      element_type: elementType,
      metadata
    }

    this.events.push(event)
    this.sendEvent(event)
  }

  /**
   * Registra métricas de rendimiento
   */
  trackPerformance(metricName: string, value: number, unit: string): void {
    const event: PerformanceEvent = {
      event_type: 'performance',
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: new Date(),
      page_url: window.location.href,
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit
    }

    this.events.push(event)
    this.sendEvent(event)
  }

  /**
   * Registra errores
   */
  trackError(errorType: string, errorMessage: string, stackTrace?: string): void {
    const event: ErrorEvent = {
      event_type: 'error',
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: new Date(),
      page_url: window.location.href,
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace
    }

    this.events.push(event)
    this.sendEvent(event)
  }

  /**
   * Registra conversiones y acciones completadas
   */
  trackConversion(
    action: ConversionEvent['action'],
    success: boolean,
    productId?: string,
    timeToComplete?: number
  ): void {
    const event: ConversionEvent = {
      event_type: 'conversion',
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: new Date(),
      page_url: window.location.href,
      product_id: productId,
      action,
      success,
      time_to_complete_ms: timeToComplete
    }

    this.events.push(event)
    this.sendEvent(event)
  }

  /**
   * Envía evento al servidor de analytics
   */
  private async sendEvent(event: ProductAnalyticsEvent): Promise<void> {
    try {
      // En un entorno real, esto enviaría a un servicio de analytics
      console.log('Analytics Event:', event)
      
      // Ejemplo de envío a API
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // })
    } catch (error) {
      console.error('Error sending analytics event:', error)
    }
  }

  /**
   * Obtiene métricas de la sesión actual
   */
  getSessionMetrics(): SessionMetrics {
    const interactions = this.events.filter(e => e.event_type === 'user_interaction') as UserInteractionEvent[]
    const conversions = this.events.filter(e => e.event_type === 'conversion') as ConversionEvent[]
    const errors = this.events.filter(e => e.event_type === 'error') as ErrorEvent[]

    return {
      sessionId: this.sessionId,
      totalInteractions: interactions.length,
      totalConversions: conversions.length,
      totalErrors: errors.length,
      successfulConversions: conversions.filter(c => c.success).length,
      averageTimeToComplete: this.calculateAverageTimeToComplete(conversions),
      mostUsedFeatures: this.getMostUsedFeatures(interactions),
      errorRate: errors.length / (interactions.length || 1)
    }
  }

  private calculateAverageTimeToComplete(conversions: ConversionEvent[]): number {
    const completedConversions = conversions.filter(c => c.success && c.time_to_complete_ms)
    if (completedConversions.length === 0) return 0

    const totalTime = completedConversions.reduce((sum, c) => sum + (c.time_to_complete_ms || 0), 0)
    return totalTime / completedConversions.length
  }

  private getMostUsedFeatures(interactions: UserInteractionEvent[]): Array<{ feature: string; count: number }> {
    const featureCounts = interactions.reduce((acc, interaction) => {
      const feature = interaction.element_type
      acc[feature] = (acc[feature] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(featureCounts)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }
}

// Interfaces para métricas
export interface SessionMetrics {
  sessionId: string
  totalInteractions: number
  totalConversions: number
  totalErrors: number
  successfulConversions: number
  averageTimeToComplete: number
  mostUsedFeatures: Array<{ feature: string; count: number }>
  errorRate: number
}

export interface UsabilityMetrics {
  taskCompletionRate: number
  averageTaskTime: number
  errorRate: number
  userSatisfactionScore: number
  learnabilityScore: number
  efficiencyScore: number
}

export interface ConversionMetrics {
  productViewRate: number
  productEditRate: number
  productCreateRate: number
  searchSuccessRate: number
  filterUsageRate: number
  bounceRate: number
}

// Clase para análisis de usabilidad
export class UsabilityAnalyzer {
  /**
   * Analiza métricas de usabilidad basadas en eventos
   */
  static analyzeUsability(events: ProductAnalyticsEvent[]): UsabilityMetrics {
    const conversions = events.filter(e => e.event_type === 'conversion') as ConversionEvent[]
    const errors = events.filter(e => e.event_type === 'error') as ErrorEvent[]
    const interactions = events.filter(e => e.event_type === 'user_interaction') as UserInteractionEvent[]

    const totalTasks = conversions.length
    const successfulTasks = conversions.filter(c => c.success).length
    const taskCompletionRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0

    const completedTasks = conversions.filter(c => c.success && c.time_to_complete_ms)
    const averageTaskTime = completedTasks.length > 0 
      ? completedTasks.reduce((sum, c) => sum + (c.time_to_complete_ms || 0), 0) / completedTasks.length
      : 0

    const errorRate = interactions.length > 0 ? (errors.length / interactions.length) * 100 : 0

    // Métricas calculadas (en un entorno real vendrían de encuestas)
    const userSatisfactionScore = this.calculateSatisfactionScore(taskCompletionRate, errorRate)
    const learnabilityScore = this.calculateLearnabilityScore(interactions)
    const efficiencyScore = this.calculateEfficiencyScore(averageTaskTime, taskCompletionRate)

    return {
      taskCompletionRate,
      averageTaskTime,
      errorRate,
      userSatisfactionScore,
      learnabilityScore,
      efficiencyScore
    }
  }

  private static calculateSatisfactionScore(completionRate: number, errorRate: number): number {
    // Fórmula simplificada para calcular satisfacción
    const baseScore = completionRate
    const errorPenalty = errorRate * 10
    return Math.max(0, Math.min(100, baseScore - errorPenalty))
  }

  private static calculateLearnabilityScore(interactions: UserInteractionEvent[]): number {
    // Analiza si los usuarios mejoran con el tiempo
    if (interactions.length < 10) return 50 // Score neutral para pocas interacciones

    const firstHalf = interactions.slice(0, Math.floor(interactions.length / 2))
    const secondHalf = interactions.slice(Math.floor(interactions.length / 2))

    const firstHalfErrors = firstHalf.filter(i => i.metadata?.isError).length
    const secondHalfErrors = secondHalf.filter(i => i.metadata?.isError).length

    const firstHalfErrorRate = firstHalfErrors / firstHalf.length
    const secondHalfErrorRate = secondHalfErrors / secondHalf.length

    const improvement = firstHalfErrorRate - secondHalfErrorRate
    return Math.max(0, Math.min(100, 50 + (improvement * 100)))
  }

  private static calculateEfficiencyScore(averageTime: number, completionRate: number): number {
    // Combina tiempo promedio y tasa de completación
    if (averageTime === 0) return completionRate

    // Tiempo objetivo en ms (ejemplo: 30 segundos para tareas básicas)
    const targetTime = 30000
    const timeScore = Math.max(0, 100 - ((averageTime - targetTime) / targetTime) * 50)
    
    return (timeScore + completionRate) / 2
  }

  /**
   * Genera recomendaciones basadas en métricas
   */
  static generateRecommendations(metrics: UsabilityMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.taskCompletionRate < 80) {
      recommendations.push('Mejorar la claridad de las instrucciones y flujos de trabajo')
    }

    if (metrics.errorRate > 10) {
      recommendations.push('Revisar validaciones y mensajes de error para reducir confusión')
    }

    if (metrics.averageTaskTime > 60000) { // 1 minuto
      recommendations.push('Simplificar procesos para reducir tiempo de completación')
    }

    if (metrics.userSatisfactionScore < 70) {
      recommendations.push('Realizar encuestas de satisfacción para identificar puntos de dolor')
    }

    if (metrics.learnabilityScore < 60) {
      recommendations.push('Mejorar onboarding y ayuda contextual')
    }

    if (metrics.efficiencyScore < 70) {
      recommendations.push('Optimizar interfaz para tareas más eficientes')
    }

    if (recommendations.length === 0) {
      recommendations.push('Las métricas de usabilidad están en buen estado')
    }

    return recommendations
  }
}

// Hook para usar analytics en componentes React
export function useProductAnalytics(userId?: string) {
  const analytics = new ProductAnalytics(userId)

  const trackClick = (elementId: string, elementType: string, metadata?: Record<string, any>) => {
    analytics.trackUserInteraction('click', elementId, elementType, metadata)
  }

  const trackSearch = (searchTerm: string, resultsCount: number) => {
    analytics.trackUserInteraction('search', 'search_input', 'input', {
      search_term: searchTerm,
      results_count: resultsCount
    })
  }

  const trackFilter = (filterType: string, filterValue: string) => {
    analytics.trackUserInteraction('filter', `filter_${filterType}`, 'filter', {
      filter_type: filterType,
      filter_value: filterValue
    })
  }

  const trackProductView = (productId: string, timeSpent?: number) => {
    analytics.trackConversion('product_view', true, productId, timeSpent)
  }

  const trackProductEdit = (productId: string, success: boolean, timeToComplete?: number) => {
    analytics.trackConversion('product_edit', success, productId, timeToComplete)
  }

  const trackError = (errorType: string, errorMessage: string) => {
    analytics.trackError(errorType, errorMessage)
  }

  const trackPerformance = (metricName: string, value: number, unit: string = 'ms') => {
    analytics.trackPerformance(metricName, value, unit)
  }

  return {
    trackClick,
    trackSearch,
    trackFilter,
    trackProductView,
    trackProductEdit,
    trackError,
    trackPerformance,
    getSessionMetrics: () => analytics.getSessionMetrics()
  }
}

// Utilidades para A/B Testing
export class ABTestManager {
  private static tests: Map<string, ABTest> = new Map()

  static createTest(testId: string, variants: string[], trafficSplit: number[] = []): void {
    if (variants.length === 0) throw new Error('At least one variant is required')
    
    const defaultSplit = variants.map(() => 100 / variants.length)
    const split = trafficSplit.length === variants.length ? trafficSplit : defaultSplit

    this.tests.set(testId, {
      id: testId,
      variants,
      trafficSplit: split,
      isActive: true
    })
  }

  static getVariant(testId: string, userId: string): string | null {
    const test = this.tests.get(testId)
    if (!test || !test.isActive) return null

    // Usar hash del userId para asignar variante consistentemente
    const hash = this.hashString(userId + testId)
    const percentage = hash % 100

    let cumulativePercentage = 0
    for (let i = 0; i < test.variants.length; i++) {
      cumulativePercentage += test.trafficSplit[i]
      if (percentage < cumulativePercentage) {
        return test.variants[i]
      }
    }

    return test.variants[0] // Fallback
  }

  private static hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  static endTest(testId: string): void {
    const test = this.tests.get(testId)
    if (test) {
      test.isActive = false
    }
  }
}

interface ABTest {
  id: string
  variants: string[]
  trafficSplit: number[]
  isActive: boolean
}

// Configuración de tests A/B para productos
export const PRODUCT_AB_TESTS = {
  PRODUCT_CARD_LAYOUT: 'product_card_layout',
  FILTER_POSITION: 'filter_position',
  PRICING_DISPLAY: 'pricing_display'
} as const

// Inicializar tests A/B
ABTestManager.createTest(PRODUCT_AB_TESTS.PRODUCT_CARD_LAYOUT, ['original', 'optimized'], [50, 50])
ABTestManager.createTest(PRODUCT_AB_TESTS.FILTER_POSITION, ['sidebar', 'top'], [50, 50])
ABTestManager.createTest(PRODUCT_AB_TESTS.PRICING_DISPLAY, ['detailed', 'simple'], [50, 50])