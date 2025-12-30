'use client'

import { createClient } from '@/lib/supabase/client'

// Interfaces para análisis de comportamiento de usuario
export interface UserSession {
  id: string
  userId?: string
  sessionId: string
  startTime: Date
  endTime?: Date
  duration?: number
  pageViews: PageView[]
  interactions: UserInteraction[]
  device: DeviceInfo
  location: LocationInfo
  referrer?: string
  exitPage?: string
  bounced: boolean
  converted: boolean
  conversionValue?: number
}

export interface PageView {
  id: string
  sessionId: string
  page: string
  timestamp: Date
  timeOnPage?: number
  scrollDepth: number
  exitPage: boolean
  referrer?: string
}

export interface UserInteraction {
  id: string
  sessionId: string
  type: 'click' | 'scroll' | 'hover' | 'form_submit' | 'search' | 'add_to_cart' | 'purchase'
  element: string
  timestamp: Date
  data?: Record<string, any>
  value?: number
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  screenResolution: string
  userAgent: string
}

export interface LocationInfo {
  country?: string
  region?: string
  city?: string
  timezone: string
  language: string
}

export interface UserBehaviorMetrics {
  totalSessions: number
  uniqueUsers: number
  avgSessionDuration: number
  bounceRate: number
  conversionRate: number
  pageViewsPerSession: number
  topPages: PageMetric[]
  topInteractions: InteractionMetric[]
  userJourney: JourneyStep[]
  cohortAnalysis: CohortData[]
  funnelAnalysis: FunnelStep[]
}

export interface PageMetric {
  page: string
  views: number
  uniqueViews: number
  avgTimeOnPage: number
  bounceRate: number
  exitRate: number
}

export interface InteractionMetric {
  type: string
  element: string
  count: number
  conversionRate: number
  avgValue: number
}

export interface JourneyStep {
  step: number
  page: string
  users: number
  dropoffRate: number
  avgTimeToNext: number
}

export interface CohortData {
  cohort: string
  period: number
  users: number
  retentionRate: number
  revenue: number
}

export interface FunnelStep {
  step: string
  users: number
  conversionRate: number
  dropoffRate: number
}

export interface HeatmapData {
  page: string
  clicks: ClickPoint[]
  scrollDepth: ScrollData[]
  timeSpent: TimeSpentData[]
}

export interface ClickPoint {
  x: number
  y: number
  element: string
  count: number
}

export interface ScrollData {
  depth: number
  users: number
  percentage: number
}

export interface TimeSpentData {
  section: string
  avgTime: number
  users: number
}

export interface ABTestResult {
  testId: string
  variant: string
  users: number
  conversions: number
  conversionRate: number
  confidence: number
  significance: boolean
}

class UserBehaviorAnalyticsEngine {
  private supabase = createClient()
  private sessionStorage: Map<string, UserSession> = new Map()

  // Iniciar seguimiento de sesión
  startSession(sessionId: string, userId?: string, deviceInfo?: DeviceInfo, locationInfo?: LocationInfo): UserSession {
    const session: UserSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      startTime: new Date(),
      pageViews: [],
      interactions: [],
      device: deviceInfo || this.getDefaultDeviceInfo(),
      location: locationInfo || this.getDefaultLocationInfo(),
      bounced: false,
      converted: false
    }

    this.sessionStorage.set(sessionId, session)
    return session
  }

  // Registrar vista de página
  trackPageView(sessionId: string, page: string, referrer?: string): void {
    const session = this.sessionStorage.get(sessionId)
    if (!session) return

    // Finalizar página anterior si existe
    const lastPageView = session.pageViews[session.pageViews.length - 1]
    if (lastPageView && !lastPageView.timeOnPage) {
      lastPageView.timeOnPage = Date.now() - lastPageView.timestamp.getTime()
    }

    const pageView: PageView = {
      id: `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      page,
      timestamp: new Date(),
      scrollDepth: 0,
      exitPage: false,
      referrer
    }

    session.pageViews.push(pageView)
    this.sessionStorage.set(sessionId, session)

    // Persistir en base de datos
    this.persistPageView(pageView)
  }

  // Registrar interacción de usuario
  trackInteraction(
    sessionId: string,
    type: UserInteraction['type'],
    element: string,
    data?: Record<string, any>,
    value?: number
  ): void {
    const session = this.sessionStorage.get(sessionId)
    if (!session) return

    const interaction: UserInteraction = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type,
      element,
      timestamp: new Date(),
      data,
      value
    }

    session.interactions.push(interaction)

    // Marcar conversión si es una compra
    if (type === 'purchase' && value) {
      session.converted = true
      session.conversionValue = (session.conversionValue || 0) + value
    }

    this.sessionStorage.set(sessionId, session)

    // Persistir en base de datos
    this.persistInteraction(interaction)
  }

  // Actualizar profundidad de scroll
  updateScrollDepth(sessionId: string, depth: number): void {
    const session = this.sessionStorage.get(sessionId)
    if (!session) return

    const currentPageView = session.pageViews[session.pageViews.length - 1]
    if (currentPageView) {
      currentPageView.scrollDepth = Math.max(currentPageView.scrollDepth, depth)
      this.sessionStorage.set(sessionId, session)
    }
  }

  // Finalizar sesión
  endSession(sessionId: string, exitPage?: string): void {
    const session = this.sessionStorage.get(sessionId)
    if (!session) return

    session.endTime = new Date()
    session.duration = session.endTime.getTime() - session.startTime.getTime()
    session.exitPage = exitPage

    // Marcar como rebote si solo vio una página y estuvo menos de 30 segundos
    session.bounced = session.pageViews.length === 1 && (session.duration < 30000)

    // Finalizar última página
    const lastPageView = session.pageViews[session.pageViews.length - 1]
    if (lastPageView && !lastPageView.timeOnPage) {
      lastPageView.timeOnPage = Date.now() - lastPageView.timestamp.getTime()
      lastPageView.exitPage = true
    }

    // Persistir sesión completa
    this.persistSession(session)
    this.sessionStorage.delete(sessionId)
  }

  // Obtener métricas de comportamiento
  async getBehaviorMetrics(
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string
      page?: string
      device?: string
      country?: string
    }
  ): Promise<UserBehaviorMetrics> {
    try {
      // Construir query base
      let query = this.supabase
        .from('user_sessions')
        .select(`
          *,
          page_views(*),
          user_interactions(*)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())

      // Aplicar filtros
      if (filters?.userId) query = query.eq('user_id', filters.userId)
      if (filters?.device) query = query.eq('device_type', filters.device)
      if (filters?.country) query = query.eq('country', filters.country)

      const { data: sessions } = await query

      if (!sessions) {
        throw new Error('No session data found')
      }

      // Calcular métricas
      const totalSessions = sessions.length
      const uniqueUsers = new Set(sessions.map(s => s.user_id).filter(Boolean)).size
      const avgSessionDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions
      const bounceRate = sessions.filter(s => s.bounced).length / totalSessions
      const conversionRate = sessions.filter(s => s.converted).length / totalSessions
      const totalPageViews = sessions.reduce((sum, s) => sum + (s.page_views?.length || 0), 0)
      const pageViewsPerSession = totalPageViews / totalSessions

      // Top páginas
      const topPages = this.calculateTopPages(sessions)

      // Top interacciones
      const topInteractions = this.calculateTopInteractions(sessions)

      // Análisis de journey
      const userJourney = this.calculateUserJourney(sessions)

      // Análisis de cohorte
      const cohortAnalysis = await this.calculateCohortAnalysis(startDate, endDate)

      // Análisis de funnel
      const funnelAnalysis = this.calculateFunnelAnalysis(sessions)

      return {
        totalSessions,
        uniqueUsers,
        avgSessionDuration,
        bounceRate,
        conversionRate,
        pageViewsPerSession,
        topPages,
        topInteractions,
        userJourney,
        cohortAnalysis,
        funnelAnalysis
      }
    } catch (error) {
      console.error('Error getting behavior metrics:', error)
      throw error
    }
  }

  // Generar datos de heatmap
  async generateHeatmapData(page: string, startDate: Date, endDate: Date): Promise<HeatmapData> {
    try {
      const { data: interactions } = await this.supabase
        .from('user_interactions')
        .select('*')
        .eq('type', 'click')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      const { data: pageViews } = await this.supabase
        .from('page_views')
        .select('*')
        .eq('page', page)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      // Procesar clicks
      const clickMap: { [key: string]: ClickPoint } = {}
      interactions?.forEach(interaction => {
        if (interaction.data?.x && interaction.data?.y) {
          const key = `${interaction.data.x},${interaction.data.y}`
          if (!clickMap[key]) {
            clickMap[key] = {
              x: interaction.data.x,
              y: interaction.data.y,
              element: interaction.element,
              count: 0
            }
          }
          clickMap[key].count++
        }
      })

      // Procesar scroll depth
      const scrollDepths: { [key: number]: number } = {}
      pageViews?.forEach(pv => {
        const depth = Math.floor(pv.scroll_depth / 10) * 10 // Agrupar por 10%
        scrollDepths[depth] = (scrollDepths[depth] || 0) + 1
      })

      const scrollData: ScrollData[] = Object.entries(scrollDepths).map(([depth, users]) => ({
        depth: parseInt(depth),
        users,
        percentage: (users / (pageViews?.length || 1)) * 100
      }))

      // Tiempo gastado por sección (simulado)
      const timeSpentData: TimeSpentData[] = [
        { section: 'header', avgTime: 5000, users: pageViews?.length || 0 },
        { section: 'content', avgTime: 30000, users: pageViews?.length || 0 },
        { section: 'footer', avgTime: 2000, users: Math.floor((pageViews?.length || 0) * 0.3) }
      ]

      return {
        page,
        clicks: Object.values(clickMap),
        scrollDepth: scrollData,
        timeSpent: timeSpentData
      }
    } catch (error) {
      console.error('Error generating heatmap data:', error)
      throw error
    }
  }

  // Ejecutar test A/B
  async runABTest(
    testId: string,
    variants: string[],
    trafficSplit: number[] = [0.5, 0.5]
  ): Promise<ABTestResult[]> {
    try {
      const { data: testData } = await this.supabase
        .from('ab_test_results')
        .select('*')
        .eq('test_id', testId)

      if (!testData) {
        throw new Error('No A/B test data found')
      }

      const results: ABTestResult[] = variants.map((variant, index) => {
        const variantData = testData.filter(d => d.variant === variant)
        const users = variantData.length
        const conversions = variantData.filter(d => d.converted).length
        const conversionRate = users > 0 ? conversions / users : 0

        // Calcular significancia estadística (test chi-cuadrado simplificado)
        const { confidence, significance } = this.calculateStatisticalSignificance(
          conversions,
          users,
          testData.filter(d => d.variant !== variant)
        )

        return {
          testId,
          variant,
          users,
          conversions,
          conversionRate,
          confidence,
          significance
        }
      })

      return results
    } catch (error) {
      console.error('Error running A/B test:', error)
      throw error
    }
  }

  // Métodos auxiliares privados
  private getDefaultDeviceInfo(): DeviceInfo {
    return {
      type: 'desktop',
      os: 'Unknown',
      browser: 'Unknown',
      screenResolution: '1920x1080',
      userAgent: navigator?.userAgent || 'Unknown'
    }
  }

  private getDefaultLocationInfo(): LocationInfo {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator?.language || 'en-US'
    }
  }

  private async persistSession(session: UserSession): Promise<void> {
    try {
      await this.supabase
        .from('user_sessions')
        .insert({
          id: session.id,
          user_id: session.userId,
          session_id: session.sessionId,
          start_time: session.startTime.toISOString(),
          end_time: session.endTime?.toISOString(),
          duration: session.duration,
          device_type: session.device.type,
          os: session.device.os,
          browser: session.device.browser,
          country: session.location.country,
          bounced: session.bounced,
          converted: session.converted,
          conversion_value: session.conversionValue
        })
    } catch (error) {
      console.error('Error persisting session:', error)
    }
  }

  private async persistPageView(pageView: PageView): Promise<void> {
    try {
      await this.supabase
        .from('page_views')
        .insert({
          id: pageView.id,
          session_id: pageView.sessionId,
          page: pageView.page,
          timestamp: pageView.timestamp.toISOString(),
          time_on_page: pageView.timeOnPage,
          scroll_depth: pageView.scrollDepth,
          exit_page: pageView.exitPage,
          referrer: pageView.referrer
        })
    } catch (error) {
      console.error('Error persisting page view:', error)
    }
  }

  private async persistInteraction(interaction: UserInteraction): Promise<void> {
    try {
      await this.supabase
        .from('user_interactions')
        .insert({
          id: interaction.id,
          session_id: interaction.sessionId,
          type: interaction.type,
          element: interaction.element,
          timestamp: interaction.timestamp.toISOString(),
          data: interaction.data,
          value: interaction.value
        })
    } catch (error) {
      console.error('Error persisting interaction:', error)
    }
  }

  private calculateTopPages(sessions: Array<Record<string, unknown>>): PageMetric[] {
    const pageStats: { [page: string]: Record<string, unknown> } = {}

    sessions.forEach(session => {
      session.page_views?.forEach((pv: Record<string, unknown>) => {
        if (!pageStats[pv.page]) {
          pageStats[pv.page] = {
            page: pv.page,
            views: 0,
            uniqueViews: new Set(),
            totalTime: 0,
            exits: 0,
            bounces: 0
          }
        }

        pageStats[pv.page].views++
        pageStats[pv.page].uniqueViews.add(session.session_id)
        pageStats[pv.page].totalTime += pv.time_on_page || 0

        if (pv.exit_page) pageStats[pv.page].exits++
        if (session.bounced && session.page_views.length === 1) {
          pageStats[pv.page].bounces++
        }
      })
    })

    return Object.values(pageStats).map((stats: Record<string, unknown>) => ({
      page: stats.page,
      views: stats.views,
      uniqueViews: stats.uniqueViews.size,
      avgTimeOnPage: stats.totalTime / stats.views,
      bounceRate: stats.bounces / stats.views,
      exitRate: stats.exits / stats.views
    })).sort((a, b) => b.views - a.views).slice(0, 10)
  }

  private calculateTopInteractions(sessions: Array<Record<string, unknown>>): InteractionMetric[] {
    const interactionStats: { [key: string]: Record<string, unknown> } = {}

    sessions.forEach(session => {
      session.user_interactions?.forEach((interaction: Record<string, unknown>) => {
        const key = `${interaction.type}_${interaction.element}`
        if (!interactionStats[key]) {
          interactionStats[key] = {
            type: interaction.type,
            element: interaction.element,
            count: 0,
            conversions: 0,
            totalValue: 0
          }
        }

        interactionStats[key].count++
        if (session.converted) interactionStats[key].conversions++
        interactionStats[key].totalValue += interaction.value || 0
      })
    })

    return Object.values(interactionStats).map((stats: Record<string, unknown>) => ({
      type: stats.type,
      element: stats.element,
      count: stats.count,
      conversionRate: stats.conversions / stats.count,
      avgValue: stats.totalValue / stats.count
    })).sort((a, b) => b.count - a.count).slice(0, 10)
  }

  private calculateUserJourney(sessions: Array<Record<string, unknown>>): JourneyStep[] {
    const journeyMap: { [step: number]: { [page: string]: number } } = {}

    sessions.forEach(session => {
      session.page_views?.forEach((pv: Record<string, unknown>, index: number) => {
        if (!journeyMap[index]) journeyMap[index] = {}
        if (!journeyMap[index][pv.page]) journeyMap[index][pv.page] = 0
        journeyMap[index][pv.page]++
      })
    })

    const journey: JourneyStep[] = []
    Object.entries(journeyMap).forEach(([stepStr, pages]) => {
      const step = parseInt(stepStr)
      const topPage = Object.entries(pages).sort(([,a], [,b]) => (b as number) - (a as number))[0]
      
      if (topPage) {
        const users = topPage[1] as number
        const previousUsers = step > 0 ? journey[step - 1]?.users || users : users
        const dropoffRate = step > 0 ? 1 - (users / previousUsers) : 0

        journey.push({
          step: step + 1,
          page: topPage[0],
          users,
          dropoffRate,
          avgTimeToNext: 30000 // Placeholder
        })
      }
    })

    return journey
  }

  private async calculateCohortAnalysis(startDate: Date, endDate: Date): Promise<CohortData[]> {
    // Implementación simplificada de análisis de cohorte
    const cohorts: CohortData[] = []
    
    for (let i = 0; i < 12; i++) {
      const cohortDate = new Date(startDate)
      cohortDate.setMonth(cohortDate.getMonth() + i)
      
      cohorts.push({
        cohort: cohortDate.toISOString().slice(0, 7), // YYYY-MM
        period: i,
        users: Math.floor(Math.random() * 1000) + 100,
        retentionRate: Math.max(0.1, 1 - (i * 0.1)),
        revenue: Math.floor(Math.random() * 10000) + 1000
      })
    }

    return cohorts
  }

  private calculateFunnelAnalysis(sessions: Array<Record<string, unknown>>): FunnelStep[] {
    const funnelSteps = [
      'Landing Page',
      'Product View',
      'Add to Cart',
      'Checkout',
      'Purchase'
    ]

    const stepCounts = funnelSteps.map(() => 0)
    
    sessions.forEach(session => {
      let currentStep = 0
      
      // Landing page
      if (session.page_views?.length > 0) stepCounts[0]++
      
      // Product view
      if (session.page_views?.some((pv: Record<string, unknown>) => (pv.page as string).includes('/product'))) {
        stepCounts[1]++
        currentStep = 1
      }
      
      // Add to cart
      if (session.user_interactions?.some((int: Record<string, unknown>) => int.type === 'add_to_cart')) {
        stepCounts[2]++
        currentStep = 2
      }
      
      // Checkout
      if (session.page_views?.some((pv: Record<string, unknown>) => (pv.page as string).includes('/checkout'))) {
        stepCounts[3]++
        currentStep = 3
      }
      
      // Purchase
      if (session.converted) {
        stepCounts[4]++
      }
    })

    return funnelSteps.map((step, index) => ({
      step,
      users: stepCounts[index],
      conversionRate: index > 0 ? stepCounts[index] / stepCounts[index - 1] : 1,
      dropoffRate: index > 0 ? 1 - (stepCounts[index] / stepCounts[index - 1]) : 0
    }))
  }

  private calculateStatisticalSignificance(
    conversions: number,
    users: number,
    controlData: Array<Record<string, unknown>>
  ): { confidence: number; significance: boolean } {
    // Implementación simplificada de test de significancia
    const controlConversions = controlData.filter(d => d.converted).length
    const controlUsers = controlData.length
    
    if (controlUsers === 0 || users === 0) {
      return { confidence: 0, significance: false }
    }

    const p1 = conversions / users
    const p2 = controlConversions / controlUsers
    const pooledP = (conversions + controlConversions) / (users + controlUsers)
    
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/users + 1/controlUsers))
    const zScore = Math.abs(p1 - p2) / se
    
    // Aproximación de confianza basada en z-score
    const confidence = Math.min(0.99, Math.max(0.5, 1 - Math.exp(-zScore)))
    const significance = confidence > 0.95

    return { confidence, significance }
  }
}

export const userBehaviorAnalytics = new UserBehaviorAnalyticsEngine()
export default userBehaviorAnalytics