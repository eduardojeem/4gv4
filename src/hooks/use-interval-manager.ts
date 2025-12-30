import { useEffect, useRef, useCallback, useState } from 'react'

interface IntervalConfig {
  interval: number
  immediate?: boolean
  enabled?: boolean
  maxExecutions?: number
  onError?: (error: Error) => void
}

interface IntervalState {
  isRunning: boolean
  executionCount: number
  lastExecution: Date | null
  error: Error | null
}

export const useIntervalManager = (
  callback: () => void | Promise<void>,
  config: IntervalConfig
) => {
  const { interval, immediate = false, enabled = true, maxExecutions, onError } = config
  
  const [state, setState] = useState<IntervalState>({
    isRunning: false,
    executionCount: 0,
    lastExecution: null,
    error: null
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  const isExecutingRef = useRef(false)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const executeCallback = useCallback(async () => {
    if (isExecutingRef.current) return

    try {
      isExecutingRef.current = true
      setState(prev => ({ ...prev, error: null }))
      
      await callbackRef.current()
      
      setState(prev => ({
        ...prev,
        executionCount: prev.executionCount + 1,
        lastExecution: new Date()
      }))
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setState(prev => ({ ...prev, error: err }))
      onError?.(err)
    } finally {
      isExecutingRef.current = false
    }
  }, [onError])

  const start = useCallback(() => {
    if (intervalRef.current || !enabled) return

    setState(prev => ({ ...prev, isRunning: true }))

    // Execute immediately if requested
    if (immediate) {
      executeCallback()
    }

    intervalRef.current = setInterval(() => {
      // Check if we've reached max executions
      if (maxExecutions && state.executionCount >= maxExecutions) {
        stop()
        return
      }

      executeCallback()
    }, interval)
  }, [interval, immediate, enabled, maxExecutions, executeCallback, state.executionCount])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState(prev => ({ ...prev, isRunning: false }))
  }, [])

  const restart = useCallback(() => {
    stop()
    setState(prev => ({ 
      ...prev, 
      executionCount: 0, 
      lastExecution: null, 
      error: null 
    }))
    start()
  }, [start, stop])

  const reset = useCallback(() => {
    stop()
    setState({
      isRunning: false,
      executionCount: 0,
      lastExecution: null,
      error: null
    })
  }, [stop])

  // Auto-start/stop based on enabled flag
  useEffect(() => {
    if (enabled) {
      start()
    } else {
      stop()
    }

    return () => {
      stop()
    }
  }, [enabled, start, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    ...state,
    start,
    stop,
    restart,
    reset,
    isEnabled: enabled
  }
}

// Specialized hook for data polling
export const useDataPolling = (
  fetchData: () => Promise<void>,
  options: {
    interval?: number
    enabled?: boolean
    retryOnError?: boolean
    maxRetries?: number
    backoffMultiplier?: number
  } = {}
) => {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    retryOnError = true,
    maxRetries = 3,
    backoffMultiplier = 2
  } = options

  const [retryCount, setRetryCount] = useState(0)
  const [currentInterval, setCurrentInterval] = useState(interval)

  const handleError = useCallback((error: Error) => {
    console.error('Data polling error:', error)
    
    if (retryOnError && retryCount < maxRetries) {
      setRetryCount(prev => prev + 1)
      setCurrentInterval(prev => prev * backoffMultiplier)
    }
  }, [retryOnError, retryCount, maxRetries, backoffMultiplier])

  const handleSuccess = useCallback(() => {
    // Reset retry count and interval on successful execution
    if (retryCount > 0) {
      setRetryCount(0)
      setCurrentInterval(interval)
    }
  }, [retryCount, interval])

  const wrappedFetchData = useCallback(async () => {
    try {
      await fetchData()
      handleSuccess()
    } catch (error) {
      throw error // Let the interval manager handle the error
    }
  }, [fetchData, handleSuccess])

  const intervalManager = useIntervalManager(wrappedFetchData, {
    interval: currentInterval,
    enabled: enabled && retryCount < maxRetries,
    onError: handleError
  })

  return {
    ...intervalManager,
    retryCount,
    maxRetries,
    currentInterval,
    resetRetries: () => {
      setRetryCount(0)
      setCurrentInterval(interval)
    }
  }
}

// Hook for managing multiple intervals
export const useMultipleIntervals = () => {
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addInterval = useCallback((
    key: string,
    callback: () => void | Promise<void>,
    interval: number,
    immediate = false
  ) => {
    // Clear existing interval with the same key
    removeInterval(key)

    if (immediate) {
      callback()
    }

    const intervalId = setInterval(callback, interval)
    intervalsRef.current.set(key, intervalId)

    return () => removeInterval(key)
  }, [])

  const removeInterval = useCallback((key: string) => {
    const intervalId = intervalsRef.current.get(key)
    if (intervalId) {
      clearInterval(intervalId)
      intervalsRef.current.delete(key)
    }
  }, [])

  const clearAllIntervals = useCallback(() => {
    intervalsRef.current.forEach((intervalId) => {
      clearInterval(intervalId)
    })
    intervalsRef.current.clear()
  }, [])

  const getActiveIntervals = useCallback(() => {
    return Array.from(intervalsRef.current.keys())
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllIntervals()
    }
  }, [clearAllIntervals])

  return {
    addInterval,
    removeInterval,
    clearAllIntervals,
    getActiveIntervals,
    activeCount: intervalsRef.current.size
  }
}

// Hook for conditional intervals based on visibility
export const useVisibilityInterval = (
  callback: () => void | Promise<void>,
  interval: number,
  options: {
    runWhenHidden?: boolean
    immediate?: boolean
  } = {}
) => {
  const { runWhenHidden = false, immediate = false } = options
  const [isVisible, setIsVisible] = useState(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const shouldRun = runWhenHidden || isVisible

  return useIntervalManager(callback, {
    interval,
    enabled: shouldRun,
    immediate
  })
}