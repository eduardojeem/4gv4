/**
 * Tests para el sistema de monitoreo de performance
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { 
  posPerformanceMonitor,
  measurePerformance,
  recordMetric,
  getPerformanceReport,
  measureCartOperation,
  measureProductSearch,
  measureSaleProcessing,
  measureDatabaseQuery
} from '../performance-monitor'

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

describe('POS Performance Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    posPerformanceMonitor.setEnabled(true)
    // Limpiar todas las métricas anteriores
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)
    posPerformanceMonitor.clearOldMetrics(futureDate)
  })

  afterEach(() => {
    posPerformanceMonitor.setEnabled(true)
  })

  describe('Basic Functionality', () => {
    it('should record metrics correctly', () => {
      recordMetric('test-metric', 100, { context: 'test' })
      
      const report = getPerformanceReport()
      expect(report.metrics).toHaveLength(1)
      expect(report.metrics[0].name).toBe('test-metric')
      expect(report.metrics[0].value).toBe(100)
      expect(report.metrics[0].context).toEqual({ context: 'test' })
    })

    it('should measure performance with callback', () => {
      let callbackExecuted = false
      const endMeasurement = measurePerformance('test-operation')
      
      // Simular operación
      callbackExecuted = true
      endMeasurement()
      
      expect(callbackExecuted).toBe(true)
      expect(global.performance.mark).toHaveBeenCalled()
    })

    it('should generate performance report', () => {
      recordMetric('cart-operation', 50)
      recordMetric('cart-operation', 150)
      recordMetric('product-search', 200)
      
      const report = getPerformanceReport()
      
      expect(report.summary.totalOperations).toBe(3)
      expect(report.summary.averageCartOperation).toBe(100) // (50 + 150) / 2
      expect(report.summary.averageProductSearch).toBe(200)
    })

    it('should calculate performance score correctly', () => {
      // Agregar métricas dentro de thresholds
      recordMetric('cart-operation', 50) // threshold: 100ms
      recordMetric('product-search', 100) // threshold: 200ms
      
      const report = getPerformanceReport()
      expect(report.summary.performanceScore).toBeGreaterThan(90)
    })

    it('should detect slow operations', () => {
      recordMetric('cart-operation', 400) // Excede threshold de 300ms
      recordMetric('product-search', 500) // Dentro del threshold de 1000ms
      
      const report = getPerformanceReport()
      expect(report.summary.slowOperations).toBe(1)
    })
  })

  describe('Alerts System', () => {
    it('should generate alerts for slow operations', () => {
      recordMetric('cart-operation', 700) // Muy lento (threshold: 300ms)
      
      const report = getPerformanceReport()
      expect(report.alerts.length).toBeGreaterThan(0)
      expect(report.alerts[0].type).toBe('critical')
      expect(report.alerts[0].metric).toBe('cart-operation')
    })

    it('should generate warning alerts for moderately slow operations', () => {
      recordMetric('product-search', 1200) // Moderadamente lento (threshold: 1000ms)
      
      const report = getPerformanceReport()
      expect(report.alerts.length).toBeGreaterThan(0)
      expect(report.alerts[0].type).toBe('warning')
    })

    it('should not generate alerts for fast operations', () => {
      recordMetric('cart-operation', 50) // Rápido
      recordMetric('product-search', 100) // Rápido
      
      const report = getPerformanceReport()
      expect(report.alerts.length).toBe(0)
    })
  })

  describe('Recommendations System', () => {
    it('should provide recommendations for slow cart operations', () => {
      recordMetric('cart-operation', 400) // Lento (threshold: 300ms)
      
      const report = getPerformanceReport()
      expect(report.recommendations).toContain(
        'Optimizar operaciones de carrito: considerar memoización de cálculos'
      )
    })

    it('should provide recommendations for slow product search', () => {
      recordMetric('product-search', 1200) // Lento (threshold: 1000ms)
      
      const report = getPerformanceReport()
      expect(report.recommendations).toContain(
        'Optimizar búsqueda de productos: implementar debouncing o índices de búsqueda'
      )
    })

    it('should provide positive feedback for good performance', () => {
      recordMetric('cart-operation', 50) // Rápido
      recordMetric('product-search', 100) // Rápido
      
      const report = getPerformanceReport()
      expect(report.recommendations).toContain(
        'Performance óptima: el sistema está funcionando correctamente'
      )
    })
  })

  describe('Wrapper Functions', () => {
    it('should measure cart operations', async () => {
      let operationExecuted = false
      
      await measureCartOperation(() => {
        operationExecuted = true
      })
      
      expect(operationExecuted).toBe(true)
      
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'cart-operation')).toBe(true)
    })

    it('should measure product search operations', async () => {
      const searchResult = await measureProductSearch(async () => {
        return ['product1', 'product2']
      })
      
      expect(searchResult).toEqual(['product1', 'product2'])
      
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'product-search')).toBe(true)
    })

    it('should measure sale processing operations', async () => {
      const saleResult = await measureSaleProcessing(async () => {
        return { success: true, saleId: '123' }
      })
      
      expect(saleResult).toEqual({ success: true, saleId: '123' })
      
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'sale-processing')).toBe(true)
    })

    it('should measure database query operations', async () => {
      const queryResult = await measureDatabaseQuery(async () => {
        return { data: [1, 2, 3] }
      })
      
      expect(queryResult).toEqual({ data: [1, 2, 3] })
      
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'database-query')).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in measured operations', async () => {
      const error = new Error('Test error')
      
      try {
        await measureCartOperation(() => {
          throw error
        })
        // No debería llegar aquí
        expect(true).toBe(false)
      } catch (thrownError) {
        expect(thrownError.message).toBe('Test error')
      }
      
      // Debería registrar la métrica incluso si hay error
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'cart-operation')).toBe(true)
    })

    it('should handle async errors in measured operations', async () => {
      const error = new Error('Async test error')
      
      await expect(measureProductSearch(async () => {
        throw error
      })).rejects.toThrow('Async test error')
      
      const report = getPerformanceReport()
      expect(report.metrics.some(m => m.name === 'product-search')).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should allow custom thresholds', () => {
      posPerformanceMonitor.setThresholds({
        cartOperationTime: 50 // Más estricto
      })
      
      recordMetric('cart-operation', 75) // Ahora debería ser lento
      
      const report = getPerformanceReport()
      expect(report.summary.slowOperations).toBe(1)
    })

    it('should be able to disable monitoring', () => {
      posPerformanceMonitor.setEnabled(false)
      
      recordMetric('test-metric', 100)
      
      const report = getPerformanceReport()
      expect(report.metrics.length).toBe(0)
    })

    it('should provide status information', () => {
      recordMetric('test-metric', 100)
      
      const status = posPerformanceMonitor.getStatus()
      expect(status.isEnabled).toBe(true)
      expect(status.metricsCount).toBeGreaterThan(0)
      expect(status.lastMetric).not.toBeNull()
    })
  })

  describe('Time Range Filtering', () => {
    it('should filter metrics by time range', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      
      // Simular métricas antiguas
      recordMetric('old-metric', 100)
      
      const report = getPerformanceReport({
        start: oneHourAgo,
        end: now
      })
      
      // Debería incluir métricas recientes
      expect(report.metrics.length).toBeGreaterThan(0)
    })
  })

  describe('Memory Management', () => {
    it('should limit the number of stored metrics', () => {
      // Simular muchas métricas
      for (let i = 0; i < 1200; i++) {
        recordMetric('test-metric', i)
      }
      
      const status = posPerformanceMonitor.getStatus()
      expect(status.metricsCount).toBeLessThanOrEqual(1000) // maxMetrics
    })

    it('should clear old metrics', () => {
      recordMetric('test-metric', 100)
      
      const futureDate = new Date(Date.now() + 60 * 60 * 1000)
      posPerformanceMonitor.clearOldMetrics(futureDate)
      
      const status = posPerformanceMonitor.getStatus()
      expect(status.metricsCount).toBe(0)
    })
  })
})