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

interface PerformanceMemory {
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
}

interface NetworkInformation {
  effectiveType?: string
  saveData?: boolean
  downlink?: number
  rtt?: number
}

type PerformanceWithMemory = Performance & { memory?: PerformanceMemory }
type NavigatorWithHardware = Navigator & { deviceMemory?: number; connection?: NetworkInformation }

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

export interface PerformanceMetrics {
  operationName: string
  duration: number
  timestamp: number
  memoryUsage?: number
  itemCount?: number
}

export class TTLCache<T> {
  private cache: Map<string, { value: T; timestamp: number }> = new Map()
  private ttl: number
  private maxSize: number

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 50) {
    this.ttl = ttl
    this.maxSize = maxSize
  }

  set(key: string, value: T): void {
    // Eviction policy: LRU-ish (delete first inserted if full)
    // Map iterates in insertion order, so keys().next() gives the oldest.
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key)
    if (!item) return undefined

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    return item.value
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }
}

// Hook para métricas de rendimiento
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const metricsRef = useRef<PerformanceMetrics[]>([])

  const recordMetric = useCallback((metric: PerformanceMetrics) => {
    metricsRef.current.push(metric)

    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100)
    }

    // setMetrics([...metricsRef.current]) // Disabled to prevent re-render loops
  }, [])

  const getMetrics = useCallback(() => metricsRef.current, [])

  const measureOperation = useCallback(<T>(
    operationName: string,
    operation: () => T,
    itemCount?: number
  ): T => {
    const startTime = performance.now()
    const startMemory = (performance as PerformanceWithMemory).memory?.usedJSHeapSize

    try {
      const result = operation()

      const endTime = performance.now()
      const endMemory = (performance as PerformanceWithMemory).memory?.usedJSHeapSize

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
export function useAdvancedMemoization<T>(
  factoryOrFn: () => T,
  deps: React.DependencyList,
  _config: { ttl?: number; key?: string; keyGenerator?: (...args: unknown[]) => string } = {}
): T {
  const [inputs, setInputs] = useState(() => ({ deps, factory: factoryOrFn }))
  if (deps.length !== inputs.deps.length || deps.some((dep, i) => !Object.is(dep, inputs.deps[i]))) {
    setInputs({ deps, factory: factoryOrFn })
  }
  return useMemo(() => inputs.factory(), [inputs])
}

// Debounce con una ventana maxWait que no se reinicia con cada tecla.
export function useOptimizedDebounce<T>(
  value: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
) {
  const { leading = false, trailing = true, maxWait } = options
  const [state, setState] = useState(() => ({ input: value, output: value, inBurst: false }))
  const latestValue = useRef(value)
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  if (!Object.is(state.input, value)) {
    setState({
      input: value,
      output: leading && !state.inBurst ? value : state.output,
      inBurst: true,
    })
  }

  useEffect(() => {
    latestValue.current = value
    const finish = () => {
      setState(prev => ({ ...prev, output: trailing ? latestValue.current : prev.output, inBurst: false }))
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = undefined
    }
    const timer = setTimeout(finish, delay)
    if (maxWait && maxTimeoutRef.current === undefined) {
      maxTimeoutRef.current = setTimeout(finish, maxWait)
    }
    return () => clearTimeout(timer)
  }, [value, delay, trailing, maxWait])

  useEffect(() => () => {
    clearTimeout(maxTimeoutRef.current)
  }, [])

  return state.output
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
  createMemoizedFunction: <Args extends unknown[], Return>(
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
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithHardware) : undefined
    const memory = nav?.deviceMemory
    if (memory && memory < 4) return true
    const cores = nav?.hardwareConcurrency
    if (cores && cores < 4) return true
    const connection = nav?.connection
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
    return typeof performance !== 'undefined' ? (performance as PerformanceWithMemory).memory?.usedJSHeapSize || 0 : 0
  }
}
