'use client'

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RealTimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: unknown
  old_record?: unknown
  timestamp: string
}

export interface RealTimeSyncOptions {
  tables: string[]
  onProductChange?: (event: RealTimeEvent) => void
  onStockChange?: (event: RealTimeEvent) => void
  onSaleChange?: (event: RealTimeEvent) => void
  onError?: (error: Error) => void
  enableLogging?: boolean
}

export interface RealTimeSyncReturn {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastSync: Date | null
  eventsReceived: number
  subscribe: () => void
  unsubscribe: () => void
  reconnect: () => void
  getConnectionHealth: () => {
    isHealthy: boolean
    latency: number
    lastHeartbeat: Date | null
  }
}

const MAX_AUTO_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 5000
const RECONNECT_MAX_DELAY_MS = 5 * 60 * 1000

export function useRealTimeSync(options: RealTimeSyncOptions): RealTimeSyncReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [eventsReceived, setEventsReceived] = useState(0)
  const [latency, setLatency] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)

  const channelsRef = useRef<RealtimeChannel[]>([])
  const supabaseRef = useRef(createClient())
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const reconnectAttemptsRef = useRef(0)

  const log = useCallback((message: string, data?: unknown) => {
    if (options.enableLogging) {
      console.log(`[RealTimeSync] ${message}`, data || '')
    }
  }, [options.enableLogging])

  const handleRealtimeEvent = useCallback((payload: { eventType: string; new?: unknown; old?: unknown }, table: string) => {
    const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
    const event: RealTimeEvent = {
      type: eventType,
      table,
      record: payload.new,
      old_record: payload.old,
      timestamp: new Date().toISOString()
    }

    // Un evento real confirma que el canal funciona.
    reconnectAttemptsRef.current = 0
    setEventsReceived(prev => prev + 1)
    setLastSync(new Date())

    log(`Evento recibido en ${table}:`, event)

    // Enrutar eventos según la tabla
    switch (table) {
      case 'products':
        options.onProductChange?.(event)
        break
      case 'product_movements':
      case 'inventory_movements':
        options.onStockChange?.(event)
        break
      case 'sales':
      case 'sale_items':
        options.onSaleChange?.(event)
        break
    }
  }, [options, log])

  const startHeartbeat = useCallback(() => {
    // Cada canal que responde SUBSCRIBED llama a esta función; si ya hay un
    // latido activo no se crea otro (antes se acumulaban intervalos).
    if (heartbeatIntervalRef.current) return

    heartbeatIntervalRef.current = setInterval(async () => {
      const start = Date.now()
      try {
        await supabaseRef.current
          .from('products')
          .select('id')
          .limit(1)
        
        setLatency(Date.now() - start)
        setLastHeartbeat(new Date())
      } catch (error: unknown) {
        log('Error en heartbeat:', error)
        setConnectionStatus('error')
      }
    }, 30000) // Cada 30 segundos
  }, [log])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = undefined
    }
  }, [])

  const subscribe = useCallback(() => {
    if (!config.supabase.isConfigured) {
      log('Supabase no configurado, omitiendo sincronización en tiempo real')
      return
    }

    setConnectionStatus('connecting')
    log('Iniciando suscripción en tiempo real...')

    // Limpiar suscripciones existentes
    channelsRef.current.forEach(channel => {
      supabaseRef.current.removeChannel(channel)
    })
    channelsRef.current = []

    // Crear suscripciones para cada tabla
    options.tables.forEach(table => {
      const channel = supabaseRef.current
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table
          },
          (payload) => handleRealtimeEvent(payload, table)
        )
        .subscribe((status) => {
          log(`Estado de suscripción para ${table}:`, status)
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            setConnectionStatus('connected')
            startHeartbeat()
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false)
            setConnectionStatus('error')
            options.onError?.(new Error(`Error en canal ${table}`))
          }
        })

      channelsRef.current.push(channel)
    })
  }, [options, handleRealtimeEvent, log, startHeartbeat])

  const unsubscribe = useCallback(() => {
    log('Desconectando sincronización en tiempo real...')
    
    stopHeartbeat()
    
    channelsRef.current.forEach(channel => {
      supabaseRef.current.removeChannel(channel)
    })
    channelsRef.current = []
    
    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [log, stopHeartbeat])

  const restartChannels = useCallback(() => {
    log('Reconectando...')
    unsubscribe()

    // Esperar un poco antes de reconectar
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    reconnectTimeoutRef.current = setTimeout(() => {
      subscribe()
    }, 2000)
  }, [subscribe, unsubscribe, log])

  // Reconexión manual: reinicia el contador de reintentos automáticos.
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    restartChannels()
  }, [restartChannels])

  const getConnectionHealth = useCallback(() => {
    return {
      isHealthy: isConnected && connectionStatus === 'connected' && latency < 5000,
      latency,
      lastHeartbeat
    }
  }, [isConnected, connectionStatus, latency, lastHeartbeat])

  // Auto-reconexión en caso de error, con espera creciente y un tope de
  // intentos. Un canal sobre una tabla fuera de la publicación de Realtime
  // falla siempre; sin tope, reintentaba cada ~7 s indefinidamente.
  useEffect(() => {
    if (connectionStatus !== 'error') return

    const attempt = reconnectAttemptsRef.current
    if (attempt >= MAX_AUTO_RECONNECT_ATTEMPTS) {
      log('Se agotaron los reintentos automáticos; la sincronización queda en pausa')
      return
    }

    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS)
    reconnectAttemptsRef.current = attempt + 1
    log(`Detectado error de conexión, reintento ${attempt + 1} en ${delay} ms...`)
    const timeout = setTimeout(() => {
      restartChannels()
    }, delay)

    return () => clearTimeout(timeout)
  }, [connectionStatus, restartChannels, log])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      unsubscribe()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [unsubscribe])

  return useMemo(() => ({
    isConnected,
    connectionStatus,
    lastSync,
    eventsReceived,
    subscribe,
    unsubscribe,
    reconnect,
    getConnectionHealth
  }), [
    isConnected,
    connectionStatus,
    lastSync,
    eventsReceived,
    subscribe,
    unsubscribe,
    reconnect,
    getConnectionHealth
  ])
}

// Hook simplificado para productos
export function useProductRealTimeSync(
  onProductUpdate: (product: unknown) => void,
  onStockUpdate: (movement: unknown) => void
) {
  const options = useMemo(() => ({
    tables: ['products', 'product_movements'],
    onProductChange: (event: RealTimeEvent) => {
      if (event.type === 'UPDATE' || event.type === 'INSERT') {
        onProductUpdate(event.record)
      }
    },
    onStockChange: (event: RealTimeEvent) => {
      if (event.type === 'INSERT') {
        onStockUpdate(event.record)
      }
    },
    enableLogging: false
  }), [onProductUpdate, onStockUpdate])

  return useRealTimeSync(options)
}
