import { useEffect, useRef } from 'react'
import { createClient as createSupabaseClient } from '../lib/supabase/client'
import type { RepairOrder } from '@/types/repairs'

type RepairCallbacks = {
  onInsert?: (r: RepairOrder) => void
  onUpdate?: (r: RepairOrder) => void
  onDelete?: (id: string) => void
}

export function useRepairsRealtime(callbacks: RepairCallbacks = {}) {
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    const supabase = createSupabaseClient()

interface DbRepair {
  id: string | number
  customer_name?: string
  device_model?: string
  issue_description?: string
  urgency?: number
  technical_complexity?: number
  historical_value?: number
  stage?: string
  created_at?: string
  updated_at?: string
}

interface RealtimePayload {
  eventType?: string
  event?: string
  new?: DbRepair
  old?: DbRepair
}

    const mapDbToRepair = (r: DbRepair): RepairOrder => ({
      id: String(r.id),
      customerName: r.customer_name,
      deviceModel: r.device_model,
      issueDescription: r.issue_description,
      urgency: r.urgency ?? 3,
      technicalComplexity: r.technical_complexity ?? 3,
      historicalValue: r.historical_value ?? 0,
      stage: r.stage || 'received',
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at,
    })

    const channel = (supabase as { channel?: (name: string) => { on: (event: string, config: unknown, callback: (payload: RealtimePayload) => void) => { subscribe: () => void; unsubscribe: () => void } } })?.channel?.('repairs-live')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, (payload: RealtimePayload) => {
        const type = payload.eventType || payload.event
        const currentCallbacks = callbacksRef.current
        
        if (type === 'INSERT' && currentCallbacks.onInsert && payload.new) {
          currentCallbacks.onInsert(mapDbToRepair(payload.new))
        } else if (type === 'UPDATE' && currentCallbacks.onUpdate && payload.new) {
          currentCallbacks.onUpdate(mapDbToRepair(payload.new))
        } else if (type === 'DELETE' && currentCallbacks.onDelete) {
          currentCallbacks.onDelete(String(payload.old?.id))
        }
      })

    channel?.subscribe?.()

    return () => {
      channel?.unsubscribe?.()
    }
  }, [])
}