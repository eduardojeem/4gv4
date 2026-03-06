import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/hooks/use-customer-state'

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

const supabase = createClient()

export const segmentationService = {
  async getSegments(): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await supabase
        .from('customer_segments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error loading segments' }
    }
  },

  async getAIInsights(): Promise<ServiceResult<any[]>> {
    return { success: true, data: [] }
  },

  async createSegment(payload: Record<string, unknown>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase
        .from('customer_segments')
        .insert([payload])
        .select('*')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error creating segment' }
    }
  },

  async updateSegment(id: string, payload: Record<string, unknown>): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await supabase
        .from('customer_segments')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error updating segment' }
    }
  },

  async deleteSegment(id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: null }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error deleting segment' }
    }
  },

  async getSegmentCustomers(segmentId: string): Promise<ServiceResult<Customer[]>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('segment', segmentId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data || []) as Customer[] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error loading segment customers' }
    }
  }
}
