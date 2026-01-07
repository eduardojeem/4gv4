/**
 * Utilidades de performance para optimizar notificaciones
 */

import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook para debounce de funciones
 */
 
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Hook para throttle de funciones
 */
 
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now
        callback(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          callback(...args)
        }, delay - timeSinceLastCall)
      }
    },
    [callback, delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttledCallback
}

/**
 * Utilidad para medir tiempo de ejecución
 */
export function measurePerformance<T>(
  operation: () => T | Promise<T>,
  label?: string
): T | Promise<T> {
  const start = performance.now()
  
  const result = operation()
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now()
      const duration = end - start
      if (label) {
        console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`)
      }
    })
  } else {
    const end = performance.now()
    const duration = end - start
    if (label) {
      console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`)
    }
    return result
  }
}

/**
 * Queue para manejar notificaciones de manera eficiente
 */
class NotificationQueue {
  private queue: Array<() => void> = []
  private processing = false
  private readonly maxConcurrent = 3
  private readonly batchDelay = 50 // ms

  /**
   * Añade una notificación a la cola
   */
  enqueue(notification: () => void): void {
    this.queue.push(notification)
    this.processQueue()
  }

  /**
   * Procesa la cola de notificaciones
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent)
      
      // Ejecutar notificaciones en paralelo
      await Promise.all(
        batch.map(notification => 
          new Promise<void>(resolve => {
            try {
              notification()
            } catch (error) {
              console.error('Error en notificación:', error)
            } finally {
              resolve()
            }
          })
        )
      )

      // Pequeña pausa entre lotes para no saturar la UI
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay))
      }
    }

    this.processing = false
  }

  /**
   * Limpia la cola
   */
  clear(): void {
    this.queue = []
  }

  /**
   * Obtiene el tamaño actual de la cola
   */
  size(): number {
    return this.queue.length
  }
}

// Instancia singleton de la cola
export const notificationQueue = new NotificationQueue()

/**
 * Hook para optimizar notificaciones con cola
 */
export function useOptimizedNotificationQueue() {
  const enqueueNotification = useCallback((notification: () => void) => {
    notificationQueue.enqueue(notification)
  }, [])

  const clearQueue = useCallback(() => {
    notificationQueue.clear()
  }, [])

  const getQueueSize = useCallback(() => {
    return notificationQueue.size()
  }, [])

  return {
    enqueueNotification,
    clearQueue,
    getQueueSize
  }
}

/**
 * Utilidad para agrupar notificaciones similares
 */
export class NotificationBatcher {
  private batches = new Map<string, {
    notifications: Array<() => void>
    timer: NodeJS.Timeout
  }>()
  
  private readonly batchDelay = 200 // ms

  /**
   * Agrupa notificaciones por clave
   */
  batch(key: string, notification: () => void): void {
    const existing = this.batches.get(key)

    if (existing) {
      existing.notifications.push(notification)
      clearTimeout(existing.timer)
    } else {
      this.batches.set(key, {
        notifications: [notification],
        timer: setTimeout(() => {}, 0) // Placeholder
      })
    }

    // Configurar nuevo timer
    const batch = this.batches.get(key)!
    batch.timer = setTimeout(() => {
      this.executeBatch(key)
    }, this.batchDelay)
  }

  /**
   * Ejecuta un lote de notificaciones
   */
  private executeBatch(key: string): void {
    const batch = this.batches.get(key)
    if (!batch) return

    // Ejecutar solo la última notificación del lote
    const lastNotification = batch.notifications[batch.notifications.length - 1]
    if (lastNotification) {
      lastNotification()
    }

    this.batches.delete(key)
  }

  /**
   * Limpia todos los lotes pendientes
   */
  clear(): void {
    this.batches.forEach(batch => {
      clearTimeout(batch.timer)
    })
    this.batches.clear()
  }
}

// Instancia singleton del batcher
export const notificationBatcher = new NotificationBatcher()

/**
 * Configuración de delays optimizados por tipo de acción
 */
export const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAYS: {
    SEARCH: 300,
    FILTER: 200,
    VALIDATION: 500,
  },
  THROTTLE_DELAYS: {
    SCROLL: 16, // ~60fps
    RESIZE: 100,
    API_CALLS: 1000,
  },
  BATCH_DELAYS: {
    NOTIFICATIONS: 200,
    UI_UPDATES: 50,
    DATA_SYNC: 500,
  }
} as const