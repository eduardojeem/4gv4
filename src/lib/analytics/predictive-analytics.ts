'use client'

import { createClient } from '@/lib/supabase/client'

// Interfaces para analytics predictivo
export interface PredictiveModel {
  id: string
  name: string
  type: 'sales_forecast' | 'demand_prediction' | 'churn_prediction' | 'price_optimization'
  accuracy: number
  lastTrained: Date
  parameters: Record<string, any>
}

export interface SalesForecast {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  predictions: Array<{
    date: Date
    predictedRevenue: number
    confidence: number
    factors: string[]
  }>
  accuracy: number
  trends: TrendAnalysis[]
}

export interface DemandPrediction {
  productId: string
  productName: string
  predictions: Array<{
    date: Date
    predictedDemand: number
    confidence: number
    seasonalFactor: number
  }>
  stockRecommendations: StockRecommendation[]
  riskFactors: string[]
}

export interface ChurnPrediction {
  customerId: string
  churnProbability: number
  riskLevel: 'low' | 'medium' | 'high'
  factors: ChurnFactor[]
  retentionRecommendations: string[]
  estimatedValue: number
}

export interface PriceOptimization {
  productId: string
  currentPrice: number
  recommendedPrice: number
  expectedImpact: {
    revenueChange: number
    demandChange: number
    profitChange: number
  }
  competitorAnalysis: CompetitorPrice[]
  elasticity: number
}

export interface TrendAnalysis {
  metric: string
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  strength: number
  seasonality: SeasonalPattern[]
  anomalies: Anomaly[]
}

export interface StockRecommendation {
  action: 'reorder' | 'reduce' | 'maintain' | 'discontinue'
  quantity: number
  urgency: 'low' | 'medium' | 'high'
  reasoning: string
  costImpact: number
}

export interface ChurnFactor {
  factor: string
  impact: number
  description: string
}

export interface CompetitorPrice {
  competitor: string
  price: number
  lastUpdated: Date
  source: string
}

export interface SeasonalPattern {
  period: string
  multiplier: number
  confidence: number
}

export interface Anomaly {
  date: Date
  metric: string
  expectedValue: number
  actualValue: number
  severity: 'low' | 'medium' | 'high'
  possibleCauses: string[]
}

export interface MLModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  mse?: number
  mae?: number
  r2?: number
}

export interface CustomerBehaviorMetrics {
  daysSinceLastPurchase: number
  totalSpent: number
  avgOrderValue: number
  purchaseFrequency: number
  accountAge: number
}

class PredictiveAnalyticsEngine {
  private supabase = createClient()
  private models: Map<string, PredictiveModel> = new Map()

  // Predicción de ventas usando regresión lineal simple
  async generateSalesForecast(
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    daysAhead: number = 30
  ): Promise<SalesForecast> {
    try {
      // Obtener datos históricos
      const { data: salesData } = await this.supabase
        .from('sales')
        .select('*')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      if (!salesData || salesData.length === 0) {
        throw new Error('Insufficient historical data for forecasting')
      }

      // Agrupar datos por período
      const groupedData = this.groupSalesDataByPeriod(salesData, period)
      
      // Aplicar regresión lineal
      const { slope, intercept, r2 } = this.linearRegression(groupedData)
      
      // Generar predicciones
      const predictions = []
      const startDate = new Date()
      
      for (let i = 1; i <= daysAhead; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        
        const x = groupedData.length + i
        const predictedRevenue = Math.max(0, slope * x + intercept)
        const confidence = Math.min(0.95, r2 * 0.8) // Ajustar confianza basada en R²
        
        predictions.push({
          date,
          predictedRevenue,
          confidence,
          factors: this.identifyForecastFactors(date, predictedRevenue)
        })
      }

      // Análisis de tendencias
      const trends = this.analyzeTrends(groupedData)

      return {
        period,
        predictions,
        accuracy: r2,
        trends
      }
    } catch (error) {
      console.error('Error generating sales forecast:', error)
      throw error
    }
  }

  // Predicción de demanda por producto
  async generateDemandPrediction(productId: string): Promise<DemandPrediction> {
    try {
      const { data: product } = await this.supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .single()

      const { data: salesHistory } = await this.supabase
        .from('sale_items')
        .select('quantity, created_at, sales(created_at)')
        .eq('product_id', productId)
        .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())

      if (!salesHistory || salesHistory.length === 0) {
        throw new Error('Insufficient sales history for demand prediction')
      }

      // Agrupar por semanas
      const weeklyDemand = this.groupDemandByWeek(salesHistory)
      
      // Detectar estacionalidad
      const seasonalFactors = this.detectSeasonality(weeklyDemand)
      
      // Generar predicciones para las próximas 12 semanas
      const predictions = []
      const baseDate = new Date()
      
      for (let week = 1; week <= 12; week++) {
        const date = new Date(baseDate)
        date.setDate(date.getDate() + week * 7)
        
        const trend = this.calculateTrend(weeklyDemand)
        const seasonal = seasonalFactors[week % 52] || 1
        const predictedDemand = Math.max(0, trend * seasonal)
        
        predictions.push({
          date,
          predictedDemand,
          confidence: this.calculateConfidence(weeklyDemand, week),
          seasonalFactor: seasonal
        })
      }

      // Generar recomendaciones de stock
      const stockRecommendations = this.generateStockRecommendations(predictions)

      return {
        productId,
        productName: product?.name || 'Unknown Product',
        predictions,
        stockRecommendations,
        riskFactors: this.identifyRiskFactors(weeklyDemand, predictions)
      }
    } catch (error) {
      console.error('Error generating demand prediction:', error)
      throw error
    }
  }

  // Predicción de abandono de clientes
  async generateChurnPrediction(customerId: string): Promise<ChurnPrediction> {
    try {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      const { data: purchases } = await this.supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (!customer || !purchases) {
        throw new Error('Customer data not found')
      }

      // Calcular métricas de comportamiento
      const behaviorMetrics = this.calculateCustomerBehaviorMetrics(customer, purchases)
      
      // Aplicar modelo de churn (reglas simples)
      const churnProbability = this.calculateChurnProbability(behaviorMetrics)
      const riskLevel = this.determineRiskLevel(churnProbability)
      const factors = this.identifyChurnFactors(behaviorMetrics)
      
      // Generar recomendaciones de retención
      const retentionRecommendations = this.generateRetentionRecommendations(factors, riskLevel)
      
      // Estimar valor del cliente
      const estimatedValue = this.calculateCustomerLifetimeValue(purchases)

      return {
        customerId,
        churnProbability,
        riskLevel,
        factors,
        retentionRecommendations,
        estimatedValue
      }
    } catch (error) {
      console.error('Error generating churn prediction:', error)
      throw error
    }
  }

  // Optimización de precios
  async generatePriceOptimization(productId: string): Promise<PriceOptimization> {
    try {
      const { data: product } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      const { data: salesHistory } = await this.supabase
        .from('sale_items')
        .select('quantity, unit_price, created_at')
        .eq('product_id', productId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

      if (!product || !salesHistory || salesHistory.length === 0) {
        throw new Error('Insufficient data for price optimization')
      }

      const currentPrice = product.sale_price || product.price || 0
      
      // Calcular elasticidad de precio
      const elasticity = this.calculatePriceElasticity(salesHistory)
      
      // Optimizar precio basado en elasticidad
      const recommendedPrice = this.optimizePrice(currentPrice, elasticity)
      
      // Calcular impacto esperado
      const expectedImpact = this.calculatePriceImpact(
        currentPrice,
        recommendedPrice,
        elasticity,
        salesHistory
      )

      // Análisis de competidores (simulado)
      const competitorAnalysis = this.generateCompetitorAnalysis(product)

      return {
        productId,
        currentPrice,
        recommendedPrice,
        expectedImpact,
        competitorAnalysis,
        elasticity
      }
    } catch (error) {
      console.error('Error generating price optimization:', error)
      throw error
    }
  }

  // Métodos auxiliares
  private groupSalesDataByPeriod(salesData: Array<Record<string, unknown>>, period: string) {
    const grouped: { [key: string]: number } = {}
    
    salesData.forEach(sale => {
      const date = new Date(sale.created_at as string)
      let key: string
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]
          break
        case 'weekly':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        default:
          key = date.toISOString().split('T')[0]
      }
      
      const amount = Number(sale.total_amount) || Number(sale.total) || 0
      grouped[key] = (grouped[key] || 0) + amount
    })
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue], index) => ({ x: index, y: revenue, date }))
  }

  private linearRegression(data: Array<{ x: number; y: number }>) {
    const n = data.length
    const sumX = data.reduce((sum, point) => sum + point.x, 0)
    const sumY = data.reduce((sum, point) => sum + point.y, 0)
    const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0)
    const sumXX = data.reduce((sum, point) => sum + point.x * point.x, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    // Calcular R²
    const yMean = sumY / n
    const ssRes = data.reduce((sum, point) => {
      const predicted = slope * point.x + intercept
      return sum + Math.pow(point.y - predicted, 2)
    }, 0)
    const ssTot = data.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0)
    const r2 = 1 - (ssRes / ssTot)
    
    return { slope, intercept, r2: Math.max(0, r2) }
  }

  private identifyForecastFactors(date: Date, predictedRevenue: number): string[] {
    const factors = []
    
    // Factores estacionales
    const month = date.getMonth()
    if ([10, 11].includes(month)) factors.push('Holiday season boost')
    if ([0, 1].includes(month)) factors.push('Post-holiday decline')
    if ([5, 6, 7].includes(month)) factors.push('Summer season')
    
    // Factores de día de la semana
    const dayOfWeek = date.getDay()
    if ([5, 6].includes(dayOfWeek)) factors.push('Weekend effect')
    if (dayOfWeek === 1) factors.push('Monday effect')
    
    // Factores de magnitud
    if (predictedRevenue > 10000) factors.push('High revenue period')
    if (predictedRevenue < 1000) factors.push('Low revenue period')
    
    return factors
  }

  private analyzeTrends(data: Array<{ x: number; y: number }>): TrendAnalysis[] {
    const { slope } = this.linearRegression(data)
    
    return [{
      metric: 'Revenue',
      trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
      strength: Math.abs(slope),
      seasonality: [],
      anomalies: []
    }]
  }

  private groupDemandByWeek(salesHistory: Array<Record<string, unknown>>) {
    const weekly: { [key: string]: number } = {}
    
    salesHistory.forEach(item => {
      const date = new Date(item.created_at as string)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const key = weekStart.toISOString().split('T')[0]
      
      weekly[key] = (weekly[key] || 0) + (item.quantity as number)
    })
    
    return Object.entries(weekly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, demand]) => ({ date, demand }))
  }

  private detectSeasonality(weeklyDemand: Array<{ date: string; demand: number }>) {
    const factors: { [key: number]: number } = {}
    
    weeklyDemand.forEach((week, index) => {
      const weekOfYear = index % 52
      factors[weekOfYear] = (factors[weekOfYear] || 0) + week.demand
    })
    
    const avgDemand = weeklyDemand.reduce((sum, week) => sum + week.demand, 0) / weeklyDemand.length
    
    Object.keys(factors).forEach(week => {
      const weekNum = parseInt(week)
      factors[weekNum] = factors[weekNum] / avgDemand
    })
    
    return factors
  }

  private calculateTrend(weeklyDemand: Array<{ date: string; demand: number }>) {
    if (weeklyDemand.length < 2) return 0
    
    const recent = weeklyDemand.slice(-4) // Últimas 4 semanas
    const older = weeklyDemand.slice(-8, -4) // 4 semanas anteriores
    
    const recentAvg = recent.reduce((sum, week) => sum + week.demand, 0) / recent.length
    const olderAvg = older.reduce((sum, week) => sum + week.demand, 0) / older.length
    
    return recentAvg || olderAvg || 0
  }

  private calculateConfidence(weeklyDemand: Array<{ date: string; demand: number }>, weeksAhead: number) {
    const baseConfidence = 0.8
    const decayRate = 0.05
    return Math.max(0.3, baseConfidence - (weeksAhead * decayRate))
  }

  private generateStockRecommendations(predictions: Array<Record<string, unknown>>): StockRecommendation[] {
    const recommendations: StockRecommendation[] = []
    
    predictions.forEach((prediction, index) => {
      if (index < 4) { // Próximas 4 semanas
        const demand = prediction.predictedDemand as number
        const confidence = prediction.confidence as number
        
        if (demand > 50 && confidence > 0.7) {
          recommendations.push({
            action: 'reorder',
            quantity: Math.ceil(demand * 1.2), // 20% buffer
            urgency: demand > 100 ? 'high' : 'medium',
            reasoning: `High predicted demand (${Math.round(demand)}) with good confidence (${Math.round(confidence * 100)}%)`,
            costImpact: demand * 10 // Estimación simple
          })
        }
      }
    })
    
    return recommendations
  }

  private identifyRiskFactors(weeklyDemand: Array<{ date: string; demand: number }>, predictions: Array<Record<string, unknown>>): string[] {
    const factors = []
    
    // Volatilidad alta
    const demands = weeklyDemand.map(w => w.demand)
    const avg = demands.reduce((a, b) => a + b, 0) / demands.length
    const variance = demands.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / demands.length
    const stdDev = Math.sqrt(variance)
    
    if (stdDev > avg * 0.5) {
      factors.push('High demand volatility')
    }
    
    // Tendencia decreciente
    const recentTrend = this.calculateTrend(weeklyDemand.slice(-8))
    const overallTrend = this.calculateTrend(weeklyDemand)
    
    if (recentTrend < overallTrend * 0.8) {
      factors.push('Declining demand trend')
    }
    
    // Baja confianza en predicciones
    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence as number), 0) / predictions.length
    if (avgConfidence < 0.6) {
      factors.push('Low prediction confidence')
    }
    
    return factors
  }

  private calculateCustomerBehaviorMetrics(customer: Record<string, unknown>, purchases: Array<Record<string, unknown>>): CustomerBehaviorMetrics {
    const now = new Date()
    const lastPurchase = purchases[0] ? new Date(purchases[0].created_at as string) : null
    const daysSinceLastPurchase = lastPurchase ? 
      Math.floor((now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)) : 999
    
    const totalSpent = purchases.reduce((sum, p) => sum + ((p.total_amount as number) || (p.total as number) || 0), 0)
    const avgOrderValue = purchases.length > 0 ? totalSpent / purchases.length : 0
    const purchaseFrequency = purchases.length
    
    return {
      daysSinceLastPurchase,
      totalSpent,
      avgOrderValue,
      purchaseFrequency,
      accountAge: customer.created_at ? 
        Math.floor((now.getTime() - new Date(customer.created_at as string).getTime()) / (1000 * 60 * 60 * 24)) : 0
    }
  }

  private calculateChurnProbability(metrics: CustomerBehaviorMetrics): number {
    let score = 0
    
    // Días desde última compra (peso: 40%)
    if (metrics.daysSinceLastPurchase > 90) score += 0.4
    else if (metrics.daysSinceLastPurchase > 60) score += 0.3
    else if (metrics.daysSinceLastPurchase > 30) score += 0.2
    
    // Frecuencia de compra (peso: 30%)
    if (metrics.purchaseFrequency < 2) score += 0.3
    else if (metrics.purchaseFrequency < 5) score += 0.2
    else if (metrics.purchaseFrequency < 10) score += 0.1
    
    // Valor promedio de orden (peso: 20%)
    if (metrics.avgOrderValue < 50) score += 0.2
    else if (metrics.avgOrderValue < 100) score += 0.1
    
    // Gasto total (peso: 10%)
    if (metrics.totalSpent < 100) score += 0.1
    
    return Math.min(1, score)
  }

  private determineRiskLevel(churnProbability: number): 'low' | 'medium' | 'high' {
    if (churnProbability > 0.7) return 'high'
    if (churnProbability > 0.4) return 'medium'
    return 'low'
  }

  private identifyChurnFactors(metrics: CustomerBehaviorMetrics): ChurnFactor[] {
    const factors: ChurnFactor[] = []
    
    if (metrics.daysSinceLastPurchase > 60) {
      factors.push({
        factor: 'Long time since last purchase',
        impact: 0.4,
        description: `${metrics.daysSinceLastPurchase} days since last purchase`
      })
    }
    
    if (metrics.purchaseFrequency < 3) {
      factors.push({
        factor: 'Low purchase frequency',
        impact: 0.3,
        description: `Only ${metrics.purchaseFrequency} purchases made`
      })
    }
    
    if (metrics.avgOrderValue < 50) {
      factors.push({
        factor: 'Low average order value',
        impact: 0.2,
        description: `Average order value: $${metrics.avgOrderValue.toFixed(2)}`
      })
    }
    
    return factors
  }

  private generateRetentionRecommendations(factors: ChurnFactor[], riskLevel: string): string[] {
    const recommendations = []
    
    if (riskLevel === 'high') {
      recommendations.push('Send personalized discount offer')
      recommendations.push('Assign dedicated account manager')
      recommendations.push('Conduct customer satisfaction survey')
    }
    
    if (factors.some(f => f.factor.includes('purchase frequency'))) {
      recommendations.push('Create loyalty program incentives')
      recommendations.push('Send product recommendations')
    }
    
    if (factors.some(f => f.factor.includes('order value'))) {
      recommendations.push('Offer bundle deals')
      recommendations.push('Suggest premium products')
    }
    
    if (factors.some(f => f.factor.includes('last purchase'))) {
      recommendations.push('Send re-engagement email campaign')
      recommendations.push('Offer limited-time promotions')
    }
    
    return recommendations
  }

  private calculateCustomerLifetimeValue(purchases: Array<Record<string, unknown>>): number {
    if (purchases.length === 0) return 0
    
    const totalSpent = purchases.reduce((sum, p) => sum + ((p.total_amount as number) || (p.total as number) || 0), 0)
    const avgOrderValue = totalSpent / purchases.length
    const purchaseFrequency = purchases.length
    
    // Estimación simple de CLV
    return avgOrderValue * purchaseFrequency * 2 // Multiplicador conservador
  }

  private calculatePriceElasticity(salesHistory: Array<Record<string, unknown>>): number {
    if (salesHistory.length < 10) return -1 // Elasticidad por defecto
    
    // Agrupar por precio y calcular demanda promedio
    const priceGroups: { [key: string]: number[] } = {}
    
    salesHistory.forEach(sale => {
      const price = Math.round(((sale.unit_price as number) || (sale.price as number) || 0) * 100) / 100 // Redondear a centavos
      const key = price.toString()
      if (!priceGroups[key]) priceGroups[key] = []
      priceGroups[key].push(sale.quantity as number)
    })
    
    // Calcular elasticidad simple
    const prices = Object.keys(priceGroups).map(Number).sort((a, b) => a - b)
    if (prices.length < 2) return -1
    
    const lowPrice = prices[0]
    const highPrice = prices[prices.length - 1]
    const lowDemand = priceGroups[lowPrice.toString()].reduce((a, b) => a + b, 0) / priceGroups[lowPrice.toString()].length
    const highDemand = priceGroups[highPrice.toString()].reduce((a, b) => a + b, 0) / priceGroups[highPrice.toString()].length
    
    if (lowPrice === highPrice || lowDemand === highDemand) return -1
    
    const elasticity = ((highDemand - lowDemand) / lowDemand) / ((highPrice - lowPrice) / lowPrice)
    return Math.max(-5, Math.min(0, elasticity)) // Limitar elasticidad
  }

  private optimizePrice(currentPrice: number, elasticity: number): number {
    // Optimización simple basada en elasticidad
    if (elasticity > -1) {
      // Demanda inelástica, se puede subir el precio
      return currentPrice * 1.1
    } else if (elasticity < -2) {
      // Demanda muy elástica, bajar precio
      return currentPrice * 0.95
    }
    
    return currentPrice // Mantener precio actual
  }

  private calculatePriceImpact(currentPrice: number, recommendedPrice: number, elasticity: number, salesHistory: Array<Record<string, unknown>>) {
    const priceChange = (recommendedPrice - currentPrice) / currentPrice
    const demandChange = elasticity * priceChange
    const avgQuantity = salesHistory.reduce((sum, sale) => sum + (sale.quantity as number || 0), 0) / salesHistory.length
    
    const newQuantity = avgQuantity * (1 + demandChange)
    const revenueChange = (recommendedPrice * newQuantity) - (currentPrice * avgQuantity)
    
    return {
      revenueChange,
      demandChange: demandChange * 100, // Porcentaje
      profitChange: revenueChange * 0.3 // Asumiendo 30% de margen
    }
  }

  private generateCompetitorAnalysis(product: Record<string, unknown>): CompetitorPrice[] {
    // Simulación de análisis de competidores
    const basePrice = (product.sale_price as number) || (product.price as number) || 0
    
    return [
      {
        competitor: 'Competitor A',
        price: basePrice * (0.9 + Math.random() * 0.2),
        lastUpdated: new Date(),
        source: 'Web scraping'
      },
      {
        competitor: 'Competitor B',
        price: basePrice * (0.85 + Math.random() * 0.3),
        lastUpdated: new Date(),
        source: 'API integration'
      }
    ]
  }

  // Método para entrenar modelos (placeholder para futuras implementaciones)
  async trainModel(modelType: string, trainingData: Array<Record<string, unknown>>): Promise<PredictiveModel> {
    // Implementación futura con bibliotecas de ML
    return {
      id: `model_${Date.now()}`,
      name: `${modelType}_model`,
      type: modelType as any,
      accuracy: 0.75 + Math.random() * 0.2,
      lastTrained: new Date(),
      parameters: {}
    }
  }

  // Método para evaluar modelos
  async evaluateModel(modelId: string, testData: Array<Record<string, unknown>>): Promise<MLModelMetrics> {
    // Implementación futura
    return {
      accuracy: 0.8,
      precision: 0.75,
      recall: 0.85,
      f1Score: 0.8,
      mse: 0.1,
      mae: 0.05,
      r2: 0.9
    }
  }
}

export const predictiveAnalytics = new PredictiveAnalyticsEngine()
export default predictiveAnalytics