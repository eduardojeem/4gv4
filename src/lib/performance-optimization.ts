'use client'

import { useCallback, useMemo, useRef, useEffect, useState } from 'react'

// Configuración de optimización
export interface PerformanceConfig {
  enableMemoization?: boolean
  enableDebouncing?: boolean
  enableVirtualization?: boolean
  enableLazyLoading?: boolean
  debounceMs?: number
  memoizationTTL?: number
  virtualChunkSize?: number
  performanceThreshold?: number
  // Added properties
  optimization?: {
    largeDatasetThreshold: number
    chunkSize: number
    slowOperationThreshold: number
  }
  memoization?: {
    ttl: number
  }
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableMemoization: true,
  enableDebouncing: true,
  enableVirtualization: false,
  enableLazyLoading: true,
  debounceMs: 300,
  memoizationTTL: 5 * 60 * 1000,
  virtualChunkSize: 50,
  performanceThreshold: 100,
  optimization: {
    largeDatasetThreshold: 1000,
    chunkSize: 100,
    slowOperationThreshold: 100
  },
  memoization: {
    ttl: 5 * 60 * 1000
  }
}

// ... (PerformanceMetrics and TTLCache remain the same)

// Hook para métricas de rendimiento
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const metricsRef = useRef<PerformanceMetrics[]>([])

  const recordMetric = useCallback((metric: PerformanceMetrics) => {
    metricsRef.current.push(metric)

    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100)
    }

    setMetrics([...metricsRef.current])
  }, [])

  const getMetrics = useCallback(() => metricsRef.current, [])

  const measureOperation = useCallback(<T>(
    operationName: string,
    operation: () => T,
    itemCount?: number
  ): T => {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize

    try {
      const result = operation()

      const endTime = performance.now()
      const endMemory = (performance as any).memory?.usedJSHeapSize

      recordMetric({
        operationName,
        duration: endTime - startTime,
        timestamp: Date.now(),
        memoryUsage: endMemory ? endMemory - startMemory : undefined,
        itemCount
      })

      return result
    } catch (error) {
      const endTime = performance.now()
      recordMetric({
        operationName: `${operationName} (error)`,
        duration: endTime - startTime,
        timestamp: Date.now(),
        itemCount
      })
      throw error
    }
  }, [recordMetric])

  const getAverageMetrics = useCallback((operationName?: string) => {
    const currentMetrics = metricsRef.current
    const filteredMetrics = operationName
      ? currentMetrics.filter(m => m.operationName === operationName)
      : currentMetrics

    if (filteredMetrics.length === 0) return null

    const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0)
    const totalMemory = filteredMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0)

    return {
      averageDuration: totalDuration / filteredMetrics.length,
      averageMemory: totalMemory / filteredMetrics.length,
      operationCount: filteredMetrics.length,
      slowestOperation: Math.max(...filteredMetrics.map(m => m.duration)),
      fastestOperation: Math.min(...filteredMetrics.map(m => m.duration))
    }
  }, [])

  const clearMetrics = useCallback(() => {
    metricsRef.current = []
    setMetrics([])
  }, [])

  return {
    metrics,
    recordMetric,
    getMetrics,
    measureOperation,
    getAverageMetrics,
    clearMetrics
  }
}

// Hook para memoización avanzada con TTL
export function useAdvancedMemoization<T extends (...args: unknown[]) => unknown>(
  factoryOrFn: T | (() => ReturnType<T>),
  deps: React.DependencyList,
  config: { ttl?: number; key?: string } = {}
) {
  const cacheRef = useRef<TTLCache<ReturnType<T>>>(new TTLCache(config.ttl))
  const depsRef = useRef<React.DependencyList | undefined>(undefined)

  // Support for "memoize" and "clear" return pattern if used as a utility hook
  // But primarily acts as useMemo/useCallback hybrid

  const memoizedFn = useCallback((...args: Parameters<T>): ReturnType<T> => {
    const key = config.key || JSON.stringify(args)
    const cached = cacheRef.current.get(key)
    if (cached !== undefined) return cached

    // If factoryOrFn is a function that takes args, call it
    // If it's a factory () => value, this pattern doesn't quite fit standard useMemo
    // Assuming usage as a memoized callback wrapper based on useProductFiltering.ts

    const result = (factoryOrFn as any)(...args)
    cacheRef.current.set(key, result)
    return result
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  // If used as `const { memoize, clear } = useAdvancedMemoization(...)`
  // We need to return an object. 
  // But if used as `const result = useAdvancedMemoization(...)`
  // We need to return the function.
  // This is ambiguous. 
  // Based on useProductFiltering.ts, it's used in TWO ways.
  // 1. const { memoize, clear } = useAdvancedMemoization(...)
  // 2. const filtered = useAdvancedMemoization(fn, deps)(args)

  // To support both, we can assign properties to the returned function
  const result = memoizedFn as any
  result.memoize = memoizedFn
  result.clear = clear

  return result
}

// Hook para debouncing optimizado
export function useOptimizedDebounce<T>(
  value: T,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const maxTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastCallTimeRef = useRef<number | undefined>(undefined)

  const { leading = false, trailing = true, maxWait } = options

  useEffect(() => {
    const now = Date.now()

    // Limpiar timeouts existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Leading edge
    if (leading && !lastCallTimeRef.current) {
      setDebouncedValue(value)
      lastCallTimeRef.current = now
    }

    // Configurar timeout para trailing edge
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value)
        lastCallTimeRef.current = undefined

        if (maxTimeoutRef.current) {
          clearTimeout(maxTimeoutRef.current)
          maxTimeoutRef.current = undefined
        }
      }, delay)
    }

    // MaxWait timeout
    if (maxWait && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        setDebouncedValue(value)
        lastCallTimeRef.current = undefined

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }, maxWait)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current)
      }
    }
  }, [value, delay, leading, trailing, maxWait])

  return debouncedValue
}

// Hook para virtualización de listas grandes
export function useVirtualization<T>(
  items: T[],
  config: {
    itemHeight: number
    containerHeight: number
    overscan?: number
    enabled?: boolean
  }
) {
  const [scrollTop, setScrollTop] = useState(0)
  const { itemHeight, containerHeight, overscan = 5, enabled = true } = config

  const virtualizedData = useMemo(() => {
    if (!enabled || items.length === 0) {
      return {
        visibleItems: items,
        startIndex: 0,
        endIndex: items.length - 1,
        totalHeight: items.length * itemHeight,
        offsetY: 0
      }
    }

    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2)

    const visibleItems = items.slice(startIndex, endIndex + 1)
    const offsetY = startIndex * itemHeight
    const totalHeight = items.length * itemHeight

    return {
      visibleItems,
      startIndex,
      endIndex,
      totalHeight,
      offsetY
    }
  }, [items, scrollTop, itemHeight, containerHeight, overscan, enabled])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    ...virtualizedData,
    handleScroll
  }
}

// Hook para lazy loading de datos
export function useLazyLoading<T>(
  loadFunction: (page: number, pageSize: number) => Promise<T[]>,
  config: {
    pageSize?: number
    threshold?: number
    enabled?: boolean
  } = {}
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const loadingRef = useRef(false)

  const { pageSize = 20, threshold = 0.8, enabled = true } = config

  const loadMore = useCallback(async () => {
    if (!enabled || loadingRef.current || !hasMore) return

    loadingRef.current = true
    setLoading(true)

    try {
      const newData = await loadFunction(page, pageSize)

      if (newData.length < pageSize) {
        setHasMore(false)
      }

      setData(prev => [...prev, ...newData])
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [loadFunction, page, pageSize, hasMore, enabled])

  const checkThreshold = useCallback((scrollElement: HTMLElement) => {
    if (!enabled || loading || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = scrollElement
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    if (scrollPercentage >= threshold) {
      loadMore()
    }
  }, [enabled, loading, hasMore, threshold, loadMore])

  const reset = useCallback(() => {
    setData([])
    setPage(0)
    setHasMore(true)
    setLoading(false)
    loadingRef.current = false
  }, [])

  return {
    data,
    loading,
    hasMore,
    loadMore,
    checkThreshold,
    reset
  }
}

// Utilidades de optimización
export const PerformanceUtils = {
  // ... (createMemoizedFunction, chunkArray remain the same)
  createMemoizedFunction: <Args extends any[], Return>(
    fn: (...args: Args) => Return,
    keyGenerator?: (...args: Args) => string,
    ttl?: number
  ) => {
    const cache = new TTLCache<Return>(ttl)

    return (...args: Args): Return => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

      const cached = cache.get(key)
      if (cached !== undefined) {
        return cached
      }

      const result = fn(...args)
      cache.set(key, result)
      return result
    }
  },

  chunkArray: <T>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  },

  processArrayAsync: async <T, R>(
    array: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    chunkSize: number = 100,
    delay: number = 0
  ): Promise<R[]> => {
    const results: R[] = []
    const chunks = PerformanceUtils.chunkArray(array, chunkSize)

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((item, index) => processor(item, index))
      )
      results.push(...chunkResults)

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return results
  },

  isLowEndDevice: (): boolean => {
    const memory = (navigator as any).deviceMemory
    if (memory && memory < 4) return true
    const cores = navigator.hardwareConcurrency
    if (cores && cores < 4) return true
    const connection = (navigator as any).connection
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return true
    }
    return false
  },

  // Added methods
  generatePerformanceRecommendations: (metrics: PerformanceMetrics[]) => {
    const recommendations: string[] = []
    if (metrics.length === 0) return recommendations

    const slowOps = metrics.filter(m => m.duration > 200)
    if (slowOps.length > 0) {
      recommendations.push(`Detectadas ${slowOps.length} operaciones lentas (>200ms). Considera optimizar.`)
    }

    return recommendations
  },

  getMemoryUsage: () => {
    return (performance as any).memory?.usedJSHeapSize || 0
  }
}