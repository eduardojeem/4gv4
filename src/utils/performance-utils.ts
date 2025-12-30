import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react'

// Memoization utilities
export const createMemoizedSelector = <T, R>(
  selector: (data: T) => R,
  equalityFn?: (a: R, b: R) => boolean
) => {
  let lastInput: T
  let lastResult: R
  let hasResult = false

  return (input: T): R => {
    if (!hasResult || input !== lastInput) {
      const newResult = selector(input)
      
      if (!hasResult || !equalityFn || !equalityFn(lastResult, newResult)) {
        lastResult = newResult
        lastInput = input
        hasResult = true
      }
    }
    
    return lastResult
  }
}

// Deep comparison for objects
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  
  if (a == null || b == null) return a === b
  
  if (typeof a !== typeof b) return false
  
  if (typeof a !== 'object') return a === b
  
  if (Array.isArray(a) !== Array.isArray(b)) return false
  
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false
    return a.every((item, index) => deepEqual(item, (b as unknown[])[index]))
  }
  
  const keysA = Object.keys(a as Record<string, unknown>)
  const keysB = Object.keys(b as Record<string, unknown>)
  
  if (keysA.length !== keysB.length) return false
  
  return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

// Shallow comparison for objects
export const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  if (a === b) return true
  
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
    return a === b
  }
  
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  
  if (keysA.length !== keysB.length) return false
  
  return keysA.every(key => a[key] === b[key])
}

// Custom hook for memoized values with custom equality
export const useMemoizedValue = <T>(
  value: T,
  equalityFn: (a: T, b: T) => boolean = Object.is
): T => {
  const ref = useRef<T>(value)
  
  if (!equalityFn(ref.current, value)) {
    ref.current = value
  }
  
  return ref.current
}

// Custom hook for stable callbacks
export const useStableCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T => {
  const callbackRef = useRef<T>(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, deps)
  
  return useCallback(
    ((...args: unknown[]) => callbackRef.current(...args)) as T,
    []
  )
}

// Debounced value hook
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

// Throttled value hook
export const useThrottledValue = <T>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastExecuted = useRef<number>(Date.now())
  
  useEffect(() => {
    const now = Date.now()
    
    if (now >= lastExecuted.current + delay) {
      setThrottledValue(value)
      lastExecuted.current = now
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value)
        lastExecuted.current = Date.now()
      }, delay - (now - lastExecuted.current))
      
      return () => clearTimeout(timer)
    }
  }, [value, delay])
  
  return throttledValue
}

// Memoized computation hook
export const useMemoizedComputation = <T, R>(
  computation: (input: T) => R,
  input: T,
  equalityFn?: (a: T, b: T) => boolean
): R => {
  const memoizedInput = useMemoizedValue(input, equalityFn || shallowEqual)
  
  return useMemo(() => computation(memoizedInput), [computation, memoizedInput])
}

// Virtual list utilities
export interface VirtualListItem {
  id: string | number
  height?: number
}

export const useVirtualList = <T extends VirtualListItem>(
  items: T[],
  containerHeight: number,
  itemHeight: number = 50,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, itemHeight, overscan, items.length])
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        ...item,
        index: visibleRange.startIndex + index
      }))
  }, [items, visibleRange])
  
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
    visibleRange
  }
}

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const elementRef = useRef<Element | null>(null)
  
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        setEntry(entry)
      },
      options
    )
    
    observer.observe(element)
    
    return () => {
      observer.disconnect()
    }
  }, [options])
  
  return { elementRef, isIntersecting, entry }
}

// Performance monitoring hook
export const usePerformanceMonitor = (name: string) => {
  const startTime = useRef<number>(0)
  
  const start = useCallback(() => {
    startTime.current = performance.now()
  }, [])
  
  const end = useCallback(() => {
    const duration = performance.now() - startTime.current
    console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`)
    return duration
  }, [name])
  
  const measure = useCallback(<T>(fn: () => T): T => {
    start()
    const result = fn()
    end()
    return result
  }, [start, end])
  
  return { start, end, measure }
}

// Memory usage monitoring
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<any>(null)
  
  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory)
      }
    }
    
    updateMemoryInfo()
    const interval = setInterval(updateMemoryInfo, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  return memoryInfo
}

// Batch updates utility
export const useBatchedUpdates = <T>(
  initialValue: T,
  batchDelay: number = 100
) => {
  const [value, setValue] = useState<T>(initialValue)
  const pendingUpdates = useRef<((prev: T) => T)[]>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const batchedSetValue = useCallback((updater: (prev: T) => T) => {
    pendingUpdates.current.push(updater)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setValue(prev => {
        let result = prev
        pendingUpdates.current.forEach(update => {
          result = update(result)
        })
        pendingUpdates.current = []
        return result
      })
    }, batchDelay)
  }, [batchDelay])
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return [value, batchedSetValue] as const
}

// Component performance wrapper
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const { measure } = usePerformanceMonitor(componentName || Component.name)
    
    return measure(() => React.createElement(Component, props as any))
  }
  
  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Memoization decorators for class components
export const memoizeMethod = (
  target: Record<string, unknown>,
  propertyName: string,
  descriptor: PropertyDescriptor
) => {
  const originalMethod = descriptor.value
  const cache = new Map()
  
  descriptor.value = function (...args: unknown[]) {
    const key = JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)
    }
    
    const result = originalMethod.apply(this, args)
    cache.set(key, result)
    
    return result
  }
  
  return descriptor
}

// LRU Cache implementation
export class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, V>
  
  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
  }
  
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!
      this.cache.delete(key)
      this.cache.set(key, value)
      return value
    }
    return undefined
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, value)
  }
  
  has(key: K): boolean {
    return this.cache.has(key)
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  get size(): number {
    return this.cache.size
  }
}