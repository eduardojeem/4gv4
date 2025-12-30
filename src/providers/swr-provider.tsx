"use client"

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

// Cache persistente mejorado
class PersistentCache extends Map {
  private readonly STORAGE_KEY = 'swr_cache_v1'
  private readonly MAX_AGE = 1000 * 60 * 30 // 30 minutos
  private readonly MAX_SIZE = 1000

  constructor() {
    super()
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const { data, timestamp } = JSON.parse(stored)
        
        // Verificar si no está expirado
        if (Date.now() - timestamp < this.MAX_AGE) {
          Object.entries(data).forEach(([key, value]) => {
            super.set(key, value)
          })
        }
      }
    } catch (error) {
      console.warn('Failed to load SWR cache from storage:', error)
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return

    try {
      const data = Object.fromEntries(this.entries())
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.warn('Failed to save SWR cache to storage:', error)
    }
  }

  set(key: string, value: any) {
    // Implementar LRU: eliminar el más antiguo si excede el tamaño
    if (this.size >= this.MAX_SIZE) {
      const firstKey = this.keys().next().value
      if (firstKey) {
        this.delete(firstKey)
      }
    }

    const result = super.set(key, value)
    
    // Guardar en localStorage de forma throttled
    this.throttledSave()
    
    return result
  }

  private saveTimeout: NodeJS.Timeout | null = null
  private throttledSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage()
    }, 1000) // Guardar después de 1 segundo de inactividad
  }

  clear() {
    super.clear()
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }
}

// Configuración optimizada de SWR
const swrConfig = {
  // Cache más agresivo para mejor hit ratio
  dedupingInterval: 30000,           // 30 segundos (vs 5s anterior)
  focusThrottleInterval: 5000,       // 5 segundos entre revalidaciones por foco
  loadingTimeout: 15000,             // 15 segundos timeout
  errorRetryInterval: 5000,          // 5 segundos entre reintentos
  
  // Estrategias de revalidación optimizadas
  revalidateOnFocus: false,          // Evitar revalidaciones innecesarias
  revalidateOnReconnect: true,       // Revalidar al reconectar internet
  revalidateIfStale: true,           // Revalidar solo si los datos están obsoletos
  refreshWhenOffline: false,         // No intentar refrescar offline
  refreshWhenHidden: false,          // No refrescar cuando la pestaña está oculta
  
  // Cache persistente personalizado
  provider: () => new PersistentCache(),
  
  // Configuración de errores
  shouldRetryOnError: (error: any) => {
    // No reintentar errores 4xx (excepto 408, 429)
    if (error?.status >= 400 && error?.status < 500) {
      return error.status === 408 || error.status === 429
    }
    return true
  },
  errorRetryCount: 3,
  
  // Optimizaciones de rendimiento
  keepPreviousData: true,            // Mantener datos previos durante carga
  compare: (a: any, b: any) => {
    // Comparación optimizada para evitar re-renders innecesarios
    if (a === b) return true
    if (!a || !b) return false
    
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  },
  
  // Configuración de suspense
  suspense: false,                   // Deshabilitado para mejor control de loading
  
  // Fallback data para mejor UX
  fallback: {},
  
  // Configuración de mutación
  revalidateOnMount: true,           // Revalidar al montar componente
  
  // Configuración de polling (deshabilitado por defecto)
  refreshInterval: 0,
  
  // Configuración de middleware
  use: [
    // Middleware para logging en desarrollo
    ...(process.env.NODE_ENV === 'development' ? [
      (useSWRNext: any) => (key: any, fetcher: any, config: any) => {
        const swr = useSWRNext(key, fetcher, config)
        
        // Log cache hits/misses en desarrollo
        if (swr.data && !swr.isLoading) {
          console.debug(`[SWR Cache HIT] ${JSON.stringify(key)}`)
        } else if (swr.isLoading) {
          console.debug(`[SWR Cache MISS] ${JSON.stringify(key)}`)
        }
        
        return swr
      }
    ] : []),
    
    // Middleware para métricas de performance
    (useSWRNext: any) => (key: any, fetcher: any, config: any) => {
      const startTime = performance.now()
      const swr = useSWRNext(key, fetcher, config)
      
      // Medir tiempo de respuesta
      if (swr.data && !swr.isLoading) {
        const endTime = performance.now()
        const duration = endTime - startTime
        
        // Reportar métricas si es muy lento
        if (duration > 1000) {
          console.warn(`[SWR Slow Query] ${JSON.stringify(key)}: ${duration.toFixed(2)}ms`)
        }
      }
      
      return swr
    }
  ]
}

interface SWRProviderProps {
  children: ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  )
}

// Utilidades para cache management
export const cacheUtils = {
  // Limpiar todo el cache
  clearAll: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('swr_cache_v1')
      window.location.reload()
    }
  },
  
  // Limpiar cache específico
  clearKey: (key: string) => {
    // Implementar usando mutate global
    import('swr').then(({ mutate }) => {
      mutate(key, undefined, { revalidate: false })
    })
  },
  
  // Prefetch data
  prefetch: async (key: string, fetcher: () => Promise<any>) => {
    try {
      const { mutate } = await import('swr')
      const data = await fetcher()
      await mutate(key, data, { revalidate: false })
      return data
    } catch (error) {
      console.warn(`[SWR Prefetch Failed] ${key}:`, error)
      return null
    }
  },
  
  // Obtener estadísticas de cache
  getStats: () => {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem('swr_cache_v1')
      if (stored) {
        const { data, timestamp } = JSON.parse(stored)
        const keys = Object.keys(data)
        const age = Date.now() - timestamp
        
        return {
          totalKeys: keys.length,
          ageMinutes: Math.floor(age / (1000 * 60)),
          sizeKB: Math.floor(stored.length / 1024),
          keys: keys.slice(0, 10) // Primeras 10 keys
        }
      }
    } catch (error) {
      console.warn('Failed to get cache stats:', error)
    }
    
    return null
  }
}

export default SWRProvider