import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/hooks/use-customer-state'
import { SegmentCriteria, Segment } from '@/hooks/use-segmentation'

export interface SegmentationData {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
  color: string
  icon: string
  is_active: boolean
  auto_update: boolean
  priority: number
  tags: string[]
  created_at: string
  updated_at: string
  created_by?: string
}

export interface SegmentAnalytics {
  segment_id: string
  customer_count: number
  total_revenue: number
  avg_order_value: number
  conversion_rate: number
  growth_rate: number
  retention_rate: number
  engagement_score: number
  last_calculated: string
}

class SegmentationService {
  private supabase = createClient()

  // Obtener todos los segmentos
  async getSegments(): Promise<{ success: boolean; data?: Segment[]; error?: string }> {
    try {
      const { data: segmentsData, error: segmentsError } = await this.supabase
        .from('customer_segments')
        .select('*')
        .order('priority', { ascending: true })

      if (segmentsError) throw segmentsError

      // Obtener analytics para cada segmento
      const { data: analyticsData, error: analyticsError } = await this.supabase
        .from('segment_analytics')
        .select('*')

      if (analyticsError) {
        console.warn('Analytics not available:', analyticsError.message)
      }

      const segments: Segment[] = (segmentsData || []).map(segment => {
        const analytics = analyticsData?.find(a => a.segment_id === segment.id)
        
        return {
          id: segment.id,
          name: segment.name,
          description: segment.description,
          criteria: segment.criteria || {},
          color: segment.color,
          icon: segment.icon,
          customerCount: analytics?.customer_count || 0,
          isActive: segment.is_active,
          createdAt: segment.created_at,
          lastUpdated: segment.updated_at,
          autoUpdate: segment.auto_update,
          priority: segment.priority,
          tags: segment.tags || [],
          estimatedRevenue: analytics?.total_revenue || 0,
          conversionRate: analytics?.conversion_rate || 0,
          aiSuggested: false, // TODO: Implementar lógica de IA
          performance: {
            growth: analytics?.growth_rate || 0,
            engagement: analytics?.engagement_score || 0,
            retention: analytics?.retention_rate || 0
          }
        }
      })

      return { success: true, data: segments }
    } catch (error: unknown) {
      console.error('Error fetching segments:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Crear nuevo segmento
  async createSegment(segmentData: Omit<SegmentationData, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Segment; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('customer_segments')
        .insert({
          name: segmentData.name,
          description: segmentData.description,
          criteria: segmentData.criteria,
          color: segmentData.color,
          icon: segmentData.icon,
          is_active: segmentData.is_active,
          auto_update: segmentData.auto_update,
          priority: segmentData.priority,
          tags: segmentData.tags,
          created_by: segmentData.created_by
        })
        .select()
        .single()

      if (error) throw error

      // Calcular métricas iniciales del segmento
      await this.calculateSegmentMetrics(data.id)

      // Convertir a formato Segment
      const segment: Segment = {
        id: data.id,
        name: data.name,
        description: data.description,
        criteria: data.criteria || {},
        color: data.color,
        icon: data.icon,
        customerCount: 0, // Se calculará en calculateSegmentMetrics
        isActive: data.is_active,
        createdAt: data.created_at,
        lastUpdated: data.updated_at,
        autoUpdate: data.auto_update,
        priority: data.priority,
        tags: data.tags || [],
        estimatedRevenue: 0,
        conversionRate: 0,
        aiSuggested: false,
        performance: {
          growth: 0,
          engagement: 0,
          retention: 0
        }
      }

      return { success: true, data: segment }
    } catch (error: unknown) {
      console.error('Error creating segment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Actualizar segmento
  async updateSegment(segmentId: string, updates: Partial<SegmentationData>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('customer_segments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', segmentId)

      if (error) throw error

      // Recalcular métricas si los criterios cambiaron
      if (updates.criteria) {
        await this.calculateSegmentMetrics(segmentId)
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error updating segment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Eliminar segmento
  async deleteSegment(segmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Eliminar analytics primero
      await this.supabase
        .from('segment_analytics')
        .delete()
        .eq('segment_id', segmentId)

      // Eliminar segmento
      const { error } = await this.supabase
        .from('customer_segments')
        .delete()
        .eq('id', segmentId)

      if (error) throw error

      return { success: true }
    } catch (error: unknown) {
      console.error('Error deleting segment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener clientes de un segmento específico
  async getSegmentCustomers(segmentId: string): Promise<{ success: boolean; data?: Customer[]; error?: string }> {
    try {
      // Obtener criterios del segmento
      const { data: segmentData, error: segmentError } = await this.supabase
        .from('customer_segments')
        .select('criteria')
        .eq('id', segmentId)
        .single()

      if (segmentError) throw segmentError

      // Aplicar criterios para obtener clientes
      const customers = await this.applySegmentCriteria(segmentData.criteria)
      
      return { success: true, data: customers }
    } catch (error: unknown) {
      console.error('Error fetching segment customers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Aplicar criterios de segmentación a la base de datos
  private async applySegmentCriteria(criteria: SegmentCriteria): Promise<Customer[]> {
    let query = this.supabase.from('customers').select('*')

    // Aplicar filtros financieros
    if (criteria.lifetimeValue?.min) {
      query = query.gte('lifetime_value', criteria.lifetimeValue.min)
    }
    if (criteria.lifetimeValue?.max) {
      query = query.lte('lifetime_value', criteria.lifetimeValue.max)
    }

    if (criteria.totalSpent?.min) {
      query = query.gte('total_spent_this_year', criteria.totalSpent.min)
    }
    if (criteria.totalSpent?.max) {
      query = query.lte('total_spent_this_year', criteria.totalSpent.max)
    }

    if (criteria.orderCount?.min) {
      query = query.gte('total_purchases', criteria.orderCount.min)
    }
    if (criteria.orderCount?.max) {
      query = query.lte('total_purchases', criteria.orderCount.max)
    }

    if (criteria.avgOrderValue?.min) {
      query = query.gte('avg_order_value', criteria.avgOrderValue.min)
    }
    if (criteria.avgOrderValue?.max) {
      query = query.lte('avg_order_value', criteria.avgOrderValue.max)
    }

    // Aplicar filtros de comportamiento
    if (criteria.satisfactionScore?.min) {
      query = query.gte('satisfaction_score', criteria.satisfactionScore.min)
    }
    if (criteria.satisfactionScore?.max) {
      query = query.lte('satisfaction_score', criteria.satisfactionScore.max)
    }

    if (criteria.loyaltyPoints?.min) {
      query = query.gte('loyalty_points', criteria.loyaltyPoints.min)
    }
    if (criteria.loyaltyPoints?.max) {
      query = query.lte('loyalty_points', criteria.loyaltyPoints.max)
    }

    // Aplicar filtros demográficos
    if (criteria.status && criteria.status.length > 0) {
      query = query.in('status', criteria.status)
    }

    if (criteria.customerType && criteria.customerType.length > 0) {
      query = query.in('customer_type', criteria.customerType)
    }

    if (criteria.cities && criteria.cities.length > 0) {
      query = query.in('city', criteria.cities)
    }

    if (criteria.segments && criteria.segments.length > 0) {
      query = query.in('segment', criteria.segments)
    }

    if (criteria.preferredContact && criteria.preferredContact.length > 0) {
      query = query.in('preferred_contact', criteria.preferredContact)
    }

    // Aplicar filtros temporales (requieren cálculo en el cliente por ahora)
    const { data, error } = await query

    if (error) throw error

    let customers = data || []

    // Filtros temporales que requieren cálculo
    if (criteria.lastOrderDays) {
      customers = customers.filter(customer => {
        const daysSinceLastOrder = Math.floor((Date.now() - new Date(customer.last_visit).getTime()) / (1000 * 60 * 60 * 24))
        if (criteria.lastOrderDays!.min && daysSinceLastOrder < criteria.lastOrderDays!.min) return false
        if (criteria.lastOrderDays!.max && daysSinceLastOrder > criteria.lastOrderDays!.max) return false
        return true
      })
    }

    if (criteria.registrationDays) {
      customers = customers.filter(customer => {
        const daysSinceRegistration = Math.floor((Date.now() - new Date(customer.registration_date).getTime()) / (1000 * 60 * 60 * 24))
        if (criteria.registrationDays!.min && daysSinceRegistration < criteria.registrationDays!.min) return false
        if (criteria.registrationDays!.max && daysSinceRegistration > criteria.registrationDays!.max) return false
        return true
      })
    }

    // Filtros de tags
    if (criteria.tags && criteria.tags.length > 0) {
      customers = customers.filter(customer => {
        const customerTags = customer.tags || []
        return criteria.tags!.some(tag => customerTags.includes(tag))
      })
    }

    return customers.map(this.mapSupabaseToCustomer)
  }

  // Mapear datos de Supabase a Customer
  private mapSupabaseToCustomer(data: Record<string, unknown>): Customer {
    return {
      id: data.id as string,
      customerCode: (data.customer_code as string) || `CLI-${(data.id as string)?.slice(0, 6)}`,
      name: data.name as string,
      email: data.email as string,
      phone: data.phone,
      ruc: data.ruc,
      customer_type: data.customer_type || 'regular',
      status: data.status || 'active',
      total_purchases: data.total_purchases || 0,
      total_repairs: data.total_repairs || 0,
      registration_date: data.created_at,
      last_visit: data.last_visit || data.created_at,
      last_activity: data.updated_at || data.created_at,
      address: data.address || '',
      city: data.city || '',
      credit_score: data.credit_score || 0,
      segment: data.segment || 'regular',
      satisfaction_score: data.satisfaction_score || 0,
      lifetime_value: data.lifetime_value || 0,
      avg_order_value: data.avg_order_value || 0,
      purchase_frequency: data.purchase_frequency || 'low',
      preferred_contact: data.preferred_contact || 'email',
      birthday: data.birthday || '',
      loyalty_points: data.loyalty_points || 0,
      credit_limit: data.credit_limit || 0,
      current_balance: data.current_balance || 0,
      pending_amount: data.pending_amount || 0,
      notes: data.notes || '',
      tags: data.tags || [],
      whatsapp: data.whatsapp,
      social_media: data.social_media,
      company: data.company,
      position: data.position,
      referral_source: data.referral_source || 'Directo',
      discount_percentage: data.discount_percentage || 0,
      payment_terms: data.payment_terms || 'Contado',
      assigned_salesperson: data.assigned_salesperson || 'Sin asignar',
      last_purchase_amount: data.last_purchase_amount || 0,
      total_spent_this_year: data.total_spent_this_year || 0
    }
  }

  // Calcular métricas de un segmento
  async calculateSegmentMetrics(segmentId: string): Promise<void> {
    try {
      const customers = await this.getSegmentCustomers(segmentId)
      
      if (!customers.success || !customers.data) return

      const segmentCustomers = customers.data
      const customerCount = segmentCustomers.length
      const totalRevenue = segmentCustomers.reduce((acc, c) => acc + c.lifetime_value, 0)
      const avgOrderValue = customerCount > 0 
        ? segmentCustomers.reduce((acc, c) => acc + c.avg_order_value, 0) / customerCount 
        : 0

      // Calcular métricas simuladas (en una implementación real, estas vendrían de datos históricos)
      const conversionRate = Math.random() * 0.3 + 0.1
      const growthRate = Math.random() * 20 - 10
      const retentionRate = Math.random() * 40 + 60
      const engagementScore = Math.random() * 100

      // Guardar o actualizar analytics
      await this.supabase
        .from('segment_analytics')
        .upsert({
          segment_id: segmentId,
          customer_count: customerCount,
          total_revenue: totalRevenue,
          avg_order_value: avgOrderValue,
          conversion_rate: conversionRate,
          growth_rate: growthRate,
          retention_rate: retentionRate,
          engagement_score: engagementScore,
          last_calculated: new Date().toISOString()
        })

    } catch (error) {
      console.error('Error calculating segment metrics:', error)
    }
  }

  // Recalcular todas las métricas de segmentos
  async recalculateAllMetrics(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: segments, error } = await this.supabase
        .from('customer_segments')
        .select('id')
        .eq('is_active', true)

      if (error) throw error

      // Calcular métricas para cada segmento activo
      for (const segment of segments || []) {
        await this.calculateSegmentMetrics(segment.id)
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error recalculating metrics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener insights de IA basados en datos reales
  async getAIInsights(): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
    try {
      // Obtener datos para análisis
      const { data: customers, error: customersError } = await this.supabase
        .from('customers')
        .select('*')

      if (customersError) throw customersError

      const insights = []

      // Detectar clientes de alto valor inactivos
      const highValueInactive = customers?.filter(c => 
        c.lifetime_value > 2000 && 
        new Date(c.last_visit) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      ) || []

      if (highValueInactive.length > 0) {
        insights.push({
          id: 'high-value-inactive',
          type: 'risk',
          title: 'Clientes de Alto Valor Inactivos',
          description: `${highValueInactive.length} clientes valiosos no han comprado en más de 90 días`,
          impact: 'high',
          confidence: 92,
          suggestedAction: 'Implementar campaña de retención personalizada',
          affectedCustomers: highValueInactive.length,
          potentialRevenue: -highValueInactive.reduce((acc, c) => acc + c.lifetime_value, 0) * 0.3,
          createdAt: new Date().toISOString()
        })
      }

      // Detectar oportunidades de upselling
      const upsellCandidates = customers?.filter(c => 
        c.total_purchases > 5 && 
        c.avg_order_value < 500 &&
        new Date(c.last_visit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ) || []

      if (upsellCandidates.length > 0) {
        insights.push({
          id: 'upsell-opportunity',
          type: 'opportunity',
          title: 'Oportunidad de Upselling',
          description: `${upsellCandidates.length} clientes frecuentes con potencial de compras mayores`,
          impact: 'high',
          confidence: 85,
          suggestedAction: 'Crear campaña de productos premium',
          affectedCustomers: upsellCandidates.length,
          potentialRevenue: upsellCandidates.length * 300,
          createdAt: new Date().toISOString()
        })
      }

      // Detectar tendencias de contacto
      const whatsappUsers = customers?.filter(c => c.preferred_contact === 'whatsapp') || []
      const whatsappPercentage = customers ? (whatsappUsers.length / customers.length) * 100 : 0

      if (whatsappPercentage > 30) {
        insights.push({
          id: 'whatsapp-trend',
          type: 'trend',
          title: 'Crecimiento en Preferencia por WhatsApp',
          description: `${whatsappPercentage.toFixed(1)}% de clientes prefieren WhatsApp como canal de contacto`,
          impact: 'medium',
          confidence: 78,
          suggestedAction: 'Expandir capacidades de atención por WhatsApp',
          affectedCustomers: whatsappUsers.length,
          createdAt: new Date().toISOString()
        })
      }

      return { success: true, data: insights }
    } catch (error: unknown) {
      console.error('Error generating AI insights:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }
}

export const segmentationService = new SegmentationService()
export default segmentationService