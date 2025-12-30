/**
 * Tests para el hook usePerformanceMonitor
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { 
  usePerformanceMonitor, 
  useRenderTimeMonitor, 
  useOperationPerformance,
  usePerformanceAlerts
} from '../usePerformanceMonitor'

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn()
}))

// Mock timers
vi.useFakeTimers()

describe('usePerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    expect(result.current.performanceScore).toBe(100)
    expect(result.current.isMonitoring).toBe(true)
    expect(result.current.lastReport).toBeNull()
    expect(result.current.webVitals).toEqual({})
  })

  it('should measure operations when monitoring is enabled', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    let operationExecuted = false
    
    await act(async () => {
      await result.current.measureOperation('test-operation', () => {
        operationExecuted = true
      })
    })
    
    expect(operationExecuted).toBe(true)
  })

  it('should skip measurement when monitoring is disabled', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    act(() => {
      result.current.setMonitoring(false)
    })
    
    let operationExecuted = false
    
    await act(async () => {
      await result.current.measureOperation('test-operation', () => {
        operationExecuted = true
      })
    })
    
    expect(operationExecuted).toBe(true)
    expect(result.current.isMonitoring).toBe(false)
  })

  it('should measure cart operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    let cartOperationExecuted = false
    
    await act(async () => {
      await result.current.measureCartOperation(() => {
        cartOperationExecuted = true
      })
    })
    
    expect(cartOperationExecuted).toBe(true)
  })

  it('should measure product search operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    const searchResult = await act(async () => {
      return await result.current.measureProductSearch(async () => {
        return ['product1', 'product2']
      })
    })
    
    expect(searchResult).toEqual(['product1', 'product2'])
  })

  it('should measure sale processing operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    const saleResult = await act(async () => {
      return await result.current.measureSaleProcessing(async () => {
        return { success: true, saleId: '123' }
      })
    })
    
    expect(saleResult).toEqual({ success: true, saleId: '123' })
  })

  it('should measure database query operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    const queryResult = await act(async () => {
      return await result.current.measureDatabaseQuery(async () => {
        return { data: [1, 2, 3] }
      })
    })
    
    expect(queryResult).toEqual({ data: [1, 2, 3] })
  })

  it('should generate and refresh reports', () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    act(() => {
      result.current.refreshReport()
    })
    
    expect(result.current.lastReport).not.toBeNull()
    expect(typeof result.current.performanceScore).toBe('number')
  })

  it('should provide status information', () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    const status = result.current.getStatus()
    expect(status).toHaveProperty('isEnabled')
    expect(status).toHaveProperty('metricsCount')
    expect(status).toHaveProperty('thresholds')
  })

  it('should handle render time measurement', () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    const endMeasurement = result.current.measureRenderTime('TestComponent')
    expect(typeof endMeasurement).toBe('function')
    
    // Simular fin de renderizado
    act(() => {
      endMeasurement()
    })
  })

  it('should auto-refresh reports when enabled', () => {
    const { result } = renderHook(() => usePerformanceMonitor())
    
    // Verificar que se genera un reporte inicial
    expect(result.current.lastReport).not.toBeNull()
    
    // Avanzar tiempo para trigger auto-refresh
    act(() => {
      vi.advanceTimersByTime(30000) // 30 segundos
    })
    
    // El reporte debería haberse actualizado
    expect(result.current.lastReport).not.toBeNull()
  })
})

describe('useRenderTimeMonitor', () => {
  it('should monitor render time for components', () => {
    const { result } = renderHook(() => useRenderTimeMonitor('TestComponent'))
    
    expect(result.current.isMonitoring).toBe(true)
  })

  it('should not monitor when disabled', () => {
    // Mock para deshabilitar monitoreo
    vi.doMock('../usePerformanceMonitor', () => ({
      usePerformanceMonitor: () => ({
        measureRenderTime: vi.fn(() => vi.fn()),
        isMonitoring: false
      })
    }))
    
    const { result } = renderHook(() => useRenderTimeMonitor('TestComponent'))
    
    expect(result.current.isMonitoring).toBe(false)
  })
})

describe('useOperationPerformance', () => {
  it('should measure async operations', async () => {
    const { result } = renderHook(() => useOperationPerformance())
    
    const operationResult = await act(async () => {
      return await result.current.measureAsync('test-async', async () => {
        return 'async-result'
      })
    })
    
    expect(operationResult).toBe('async-result')
  })

  it('should measure sync operations', () => {
    const { result } = renderHook(() => useOperationPerformance())
    
    const operationResult = act(() => {
      return result.current.measureSync('test-sync', () => {
        return 'sync-result'
      })
    })
    
    expect(operationResult).toBe('sync-result')
  })

  it('should skip measurement when monitoring is disabled', async () => {
    // Mock para deshabilitar monitoreo
    vi.doMock('../usePerformanceMonitor', () => ({
      usePerformanceMonitor: () => ({
        measureOperation: vi.fn(),
        isMonitoring: false
      })
    }))
    
    const { result } = renderHook(() => useOperationPerformance())
    
    const operationResult = await act(async () => {
      return await result.current.measureAsync('test-async', async () => {
        return 'result-without-monitoring'
      })
    })
    
    expect(operationResult).toBe('result-without-monitoring')
  })

  it('should handle errors in measured operations', async () => {
    const { result } = renderHook(() => useOperationPerformance())
    
    await expect(act(async () => {
      return await result.current.measureAsync('test-error', async () => {
        throw new Error('Test error')
      })
    })).rejects.toThrow('Test error')
  })
})

describe('usePerformanceAlerts', () => {
  it('should initialize with no alerts', () => {
    const { result } = renderHook(() => usePerformanceAlerts())
    
    expect(result.current.alerts).toEqual([])
    expect(result.current.criticalAlerts).toEqual([])
    expect(result.current.warningAlerts).toEqual([])
    expect(result.current.hasCriticalAlerts).toBe(false)
    expect(result.current.hasWarnings).toBe(false)
  })

  it('should update alerts when report changes', () => {
    // Mock para simular alertas
    const mockAlerts = [
      {
        type: 'critical',
        message: 'Critical performance issue',
        metric: 'cart-operation',
        value: 500,
        threshold: 100,
        timestamp: new Date()
      },
      {
        type: 'warning',
        message: 'Performance warning',
        metric: 'product-search',
        value: 250,
        threshold: 200,
        timestamp: new Date()
      }
    ]

    vi.doMock('../usePerformanceMonitor', () => ({
      usePerformanceMonitor: () => ({
        lastReport: {
          alerts: mockAlerts
        },
        refreshReport: vi.fn()
      })
    }))

    const { result } = renderHook(() => usePerformanceAlerts())
    
    expect(result.current.alerts).toEqual(mockAlerts)
    expect(result.current.criticalAlerts).toHaveLength(1)
    expect(result.current.warningAlerts).toHaveLength(1)
    expect(result.current.hasCriticalAlerts).toBe(true)
    expect(result.current.hasWarnings).toBe(true)
  })

  it('should clear alerts', () => {
    const mockRefreshReport = vi.fn()
    
    vi.doMock('../usePerformanceMonitor', () => ({
      usePerformanceMonitor: () => ({
        lastReport: {
          alerts: []
        },
        refreshReport: mockRefreshReport
      })
    }))

    const { result } = renderHook(() => usePerformanceAlerts())
    
    act(() => {
      result.current.clearAlerts()
    })
    
    expect(mockRefreshReport).toHaveBeenCalled()
  })
})