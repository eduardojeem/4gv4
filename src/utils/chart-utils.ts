import { useState, useEffect, useCallback, useMemo } from 'react'

// Chart data types
export interface ChartDataPoint {
  [key: string]: string | number | Date
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'pie' | 'scatter' | 'composed'
  dataKey: string
  xAxisKey?: string
  yAxisKey?: string
  colors?: string[]
  animate?: boolean
  responsive?: boolean
}

export interface ChartLoadingState {
  isLoading: boolean
  error: Error | null
  data: ChartDataPoint[]
  isEmpty: boolean
  lastUpdated: Date | null
}

// Chart loading hook
export const useChartData = <T extends ChartDataPoint>(
  fetchData: () => Promise<T[]>,
  config: {
    refreshInterval?: number
    retryOnError?: boolean
    maxRetries?: number
    cacheKey?: string
    dependencies?: unknown[]
  } = {}
) => {
  const {
    refreshInterval,
    retryOnError = true,
    maxRetries = 3,
    cacheKey,
    dependencies = []
  } = config

  const [state, setState] = useState<ChartLoadingState>({
    isLoading: true,
    error: null,
    data: [],
    isEmpty: true,
    lastUpdated: null
  })

  const [retryCount, setRetryCount] = useState(0)

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await fetchData()

      setState({
        isLoading: false,
        error: null,
        data,
        isEmpty: !data || data.length === 0,
        lastUpdated: new Date()
      })

      setRetryCount(0)

      // Cache data if cache key is provided
      if (cacheKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `chart_cache_${cacheKey}`,
            JSON.stringify({
              data,
              timestamp: Date.now()
            })
          )
        } catch (e) {
          console.warn('Failed to cache chart data:', e)
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err
      }))

      if (retryOnError && retryCount < maxRetries) {
        setRetryCount(prev => prev + 1)
        setTimeout(() => loadData(), Math.pow(2, retryCount) * 1000) // Exponential backoff
      }
    }
  }, [fetchData, retryOnError, maxRetries, retryCount, cacheKey])

  // Load cached data on mount
  useEffect(() => {
    if (cacheKey && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`chart_cache_${cacheKey}`)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const isStale = Date.now() - timestamp > (refreshInterval || 300000) // 5 minutes default

          if (!isStale) {
            setState({
              isLoading: false,
              error: null,
              data,
              isEmpty: !data || data.length === 0,
              lastUpdated: new Date(timestamp)
            })
            return
          }
        }
      } catch (e) {
        console.warn('Failed to load cached chart data:', e)
      }
    }

    loadData()
  }, [cacheKey, loadData, refreshInterval, dependencies])

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(loadData, refreshInterval)
    return () => clearInterval(interval)
  }, [loadData, refreshInterval])

  const refresh = useCallback(() => {
    setRetryCount(0)
    loadData()
  }, [loadData])

  return {
    ...state,
    refresh,
    retryCount,
    maxRetries
  }
}

// Chart data transformation utilities
export const transformChartData = {
  // Convert data for time series charts
  toTimeSeries: (
    data: Record<string, unknown>[],
    dateKey: string,
    valueKey: string,
    groupBy?: string
  ): ChartDataPoint[] => {
    if (groupBy) {
      const grouped = data.reduce<Record<string, Record<string, unknown>[]>>((acc, item) => {
        const group = String(item[groupBy])
        if (!acc[group]) acc[group] = []
        acc[group].push(item)
        return acc
      }, {})

      return Object.entries(grouped).flatMap(([group, items]) =>
        items.map(item => ({
          date: item[dateKey] as string | number | Date,
          value: item[valueKey] as string | number | Date,
          group,
          ...item
        } as ChartDataPoint))
      )
    }

    return data.map(item => ({
      date: item[dateKey] as string | number | Date,
      value: item[valueKey] as string | number | Date,
      ...item
    } as ChartDataPoint))
  },

  // Convert data for pie charts
  toPieChart: (
    data: Record<string, unknown>[],
    labelKey: string,
    valueKey: string
  ): ChartDataPoint[] => {
    return data.map(item => ({
      name: item[labelKey] as string,
      value: item[valueKey] as number,
      ...item
    } as ChartDataPoint))
  },

  // Aggregate data by period
  aggregateByPeriod: (
    data: Record<string, unknown>[],
    dateKey: string,
    valueKey: string,
    period: 'day' | 'week' | 'month' | 'year' = 'day'
  ): ChartDataPoint[] => {
    const grouped = data.reduce<Record<string, { date: string; value: number; count: number }>>((acc, item) => {
      const date = new Date(item[dateKey] as string)
      let key: string

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        case 'year':
          key = String(date.getFullYear())
          break
        default:
          key = date.toISOString().split('T')[0]
      }

      if (!acc[key]) {
        acc[key] = { date: key, value: 0, count: 0 }
      }

      acc[key].value += Number(item[valueKey]) || 0
      acc[key].count += 1

      return acc
    }, {})

    return Object.values(grouped).sort((a: { date: string }, b: { date: string }) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ) as ChartDataPoint[]
  },

  // Calculate percentage distribution
  toPercentage: (data: ChartDataPoint[], valueKey: string): ChartDataPoint[] => {
    const total = data.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0)

    return data.map(item => ({
      ...item,
      percentage: total > 0 ? ((Number(item[valueKey]) || 0) / total) * 100 : 0
    }))
  }
}

// Chart color utilities
export const chartColors = {
  primary: ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a'],
  success: ['#10b981', '#059669', '#047857', '#065f46'],
  warning: ['#f59e0b', '#d97706', '#b45309', '#92400e'],
  danger: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  info: ['#06b6d4', '#0891b2', '#0e7490', '#155e75'],
  gradient: [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#ef4444', '#6366f1'
  ],

  getColorPalette: (count: number, type: 'primary' | 'gradient' = 'gradient') => {
    const colors = chartColors[type]
    if (count <= colors.length) {
      return colors.slice(0, count)
    }

    // Generate additional colors if needed
    const additional = []
    for (let i = colors.length; i < count; i++) {
      const hue = (i * 137.508) % 360 // Golden angle approximation
      additional.push(`hsl(${hue}, 70%, 50%)`)
    }

    return [...colors, ...additional]
  }
}

// Chart responsive utilities
export const useChartResponsive = () => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const getChartSize = useMemo(() => {
    const { width } = dimensions

    if (width < 640) { // sm
      return { width: '100%', height: 200 }
    } else if (width < 768) { // md
      return { width: '100%', height: 250 }
    } else if (width < 1024) { // lg
      return { width: '100%', height: 300 }
    } else {
      return { width: '100%', height: 350 }
    }
  }, [dimensions])

  const isMobile = dimensions.width < 768
  const isTablet = dimensions.width >= 768 && dimensions.width < 1024
  const isDesktop = dimensions.width >= 1024

  return {
    dimensions,
    getChartSize,
    isMobile,
    isTablet,
    isDesktop
  }
}

// Chart loading skeleton component props
export const getSkeletonProps = (type: ChartConfig['type']) => {
  const baseProps = {
    animate: true,
    className: "w-full"
  }

  switch (type) {
    case 'line':
    case 'area':
      return {
        ...baseProps,
        height: 300,
        lines: 3
      }
    case 'bar':
      return {
        ...baseProps,
        height: 300,
        bars: 6
      }
    case 'pie':
      return {
        ...baseProps,
        height: 300,
        circle: true
      }
    default:
      return {
        ...baseProps,
        height: 300
      }
  }
}

// Error handling for charts
export const handleChartError = (error: Error, chartType: string) => {
  console.error(`Chart error (${chartType}):`, error)


  return {
    message: `Error loading ${chartType} chart`,
    details: error.message,
    timestamp: new Date().toISOString()
  }
}