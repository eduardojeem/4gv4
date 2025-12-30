'use client'

import { useCallback, useMemo, useRef, useEffect, useState } from 'react'

// Configuración crítica de rendimiento
export interface CriticalPerformanceConfig {
  enableProductCaching: boolean
  enableImageLazyLoading: boolean
  enableVirtualScrolling: boolean
  enableDebouncing: boolean
  enableMemoization: boolean
  cacheSize: number
  debounceMs: number
  virtualThreshold: number
}

export const CRITICAL_PERFORMANCE_CONFIG: CriticalPerformanceConfig = {
  enableProductCaching: true,
  enableImageLazyLoading: true,
  enableVirtualScrolling: true,
  enableDebouncing: true,
  enableMemoization: true,
  cacheSize: 1000,
  debounceMs: 150,
  virtualThreshold: 100
}

// Cache LRU para productos
class LRUCache<T> {
  private cache = new Map<string, T>()
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Mover al final (más reciente)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Eliminar el más antiguo
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Hook para cache de productos optimizado
export function useProductCache(config: CriticalPerformanceConfig = CRITICAL_PERFORMANCE_CONFIG) {
  const cacheRef = useRef(new LRUCache(config.cacheSize))
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, size: 0 })

  const getProduct = useCallback((id: string) => {
    const cached = cacheRef.current.get(id)
    if (cached) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }))
      return cached
    }
    setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }))
    return null
  }, [])

  const setProduct = useCallback((id: string, product: any) => {
    cacheRef.current.set(id, product)
    setCacheStats(prev => ({ ...prev, size: cacheRef.current.size() }))
  }, [])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    setCacheStats({ hits: 0, misses: 0, size: 0 })
  }, [])

  return {
    getProduct,
    setProduct,
    clearCache,
    cacheStats
  }
}

// Hook para debounce optimizado
export function useCriticalDebounce<T>(
  value: T,
  delay: number = CRITICAL_PERFORMANCE_CONFIG.debounceMs
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])

  return debouncedValue
}

// Hook para memoización crítica
export function useCriticalMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  config: CriticalPerformanceConfig = CRITICAL_PERFORMANCE_CONFIG
): T {
  const memoRef = useRef<{ value: T; deps: React.DependencyList }>()

  return useMemo(() => {
    if (!config.enableMemoization) {
      return factory()
    }

    // Verificar si las dependencias han cambiado
    if (memoRef.current && 
        memoRef.current.deps.length === deps.length &&
        memoRef.current.deps.every((dep, index) => dep === deps[index])) {
      return memoRef.current.value
    }

    const value = factory()
    memoRef.current = { value, deps: [...deps] }
    return value
  }, deps)
}

// Hook para virtualización crítica
export function useVirtualization<T>(
  items: T[],
  itemHeight: number = 60,
  containerHeight: number = 400,
  config: CriticalPerformanceConfig = CRITICAL_PERFORMANCE_CONFIG
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItems = useMemo(() => {
    if (!config.enableVirtualScrolling || items.length < config.virtualThreshold) {
      return { items, startIndex: 0, endIndex: items.length - 1 }
    }

    const startIndex = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const endIndex = Math.min(startIndex + visibleCount + 2, items.length - 1) // +2 para buffer

    return {
      items: items.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex
    }
  }, [items, itemHeight, containerHeight, scrollTop, config])

  const totalHeight = items.length * itemHeight
  const offsetY = visibleItems.startIndex * itemHeight

  return {
    visibleItems: visibleItems.items,
    totalHeight,
    offsetY,
    setScrollTop,
    isVirtualized: config.enableVirtualScrolling && items.length >= config.virtualThreshold
  }
}

// Hook para lazy loading de imágenes
export function useLazyImage(
  src: string,
  config: CriticalPerformanceConfig = CRITICAL_PERFORMANCE_CONFIG
) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const imgRef = useRef<HTMLImageElement>()

  useEffect(() => {
    if (!config.enableImageLazyLoading || !src) {
      setImageSrc(src)
      return
    }

    const img = new Image()
    imgRef.current = img

    img.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
      setIsError(false)
    }

    img.onerror = () => {
      setIsError(true)
      setIsLoaded(false)
    }

    img.src = src

    return () => {
      if (imgRef.current) {
        imgRef.current.onload = null
        imgRef.current.onerror = null
      }
    }
  }, [src, config.enableImageLazyLoading])

  return {
    src: imageSrc,
    isLoaded,
    isError
  }
}

// Hook principal para optimizaciones críticas
export function useCriticalPerformance(config: Partial<CriticalPerformanceConfig> = {}) {
  const finalConfig = { ...CRITICAL_PERFORMANCE_CONFIG, ...config }
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0
  })

  const productCache = useProductCache(finalConfig)

  const measureRender = useCallback((renderFn: () => void) => {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    
    setPerformanceMetrics(prev => ({
      ...prev,
      renderTime: end - start
    }))
  }, [])

  const updateCacheMetrics = useCallback(() => {
    const { hits, misses } = productCache.cacheStats
    const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0
    
    setPerformanceMetrics(prev => ({
      ...prev,
      cacheHitRate: hitRate
    }))
  }, [productCache.cacheStats])

  useEffect(() => {
    updateCacheMetrics()
  }, [updateCacheMetrics, productCache.cacheStats])

  return {
    config: finalConfig,
    productCache,
    performanceMetrics,
    measureRender,
    
    // Hooks optimizados
    useCriticalDebounce: (value: any, delay?: number) => 
      useCriticalDebounce(value, delay || finalConfig.debounceMs),
    useCriticalMemo: (factory: () => any, deps: React.DependencyList) => 
      useCriticalMemo(factory, deps, finalConfig),
    useVirtualization: (items: any[], itemHeight?: number, containerHeight?: number) => 
      useVirtualization(items, itemHeight, containerHeight, finalConfig),
    useLazyImage: (src: string) => 
      useLazyImage(src, finalConfig)
  }
}

// Utilidades de rendimiento
export const PerformanceUtils = {
  // Throttle para eventos de scroll
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number): T => {
    let inThrottle: boolean
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(null, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }) as T
  },

  // Debounce mejorado
  debounce: <T extends (...args: any[]) => any>(func: T, wait: number): T => {
    let timeout: NodeJS.Timeout
    return ((...args: any[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(null, args), wait)
    }) as T
  },

  // Medición de memoria
  getMemoryUsage: () => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  },

  // Verificar si el dispositivo es de bajo rendimiento
  isLowEndDevice: () => {
    const connection = (navigator as any).connection
    if (connection) {
      return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
    }
    return navigator.hardwareConcurrency <= 2
  }
}