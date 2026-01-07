/**
 * Hook para monitoreo de performance en componentes POS
 * Proporciona una interfaz React-friendly para el sistema de performance monitoring
 */

import { useCallback, useState, useEffect, useRef } from 'react'
import { 
  posPerformanceMonitor,
  measurePerformance,
  recordMetric,
  getPerformanceReport,
  getWebVitals,
  measureCartOperation,
  measureProductSearch,
  measureSaleProcessing,
  measureDatabaseQuery
} from '../utils/performance-monitor'

interface UsePerformanceMonitorReturn {
  // Estado de performance
  performanceScore: number
  isMonitoring: boolean
  lastReport: ReturnType<typeof getPerformanceReport> | null
  webVitals: Record<string, number>
  
  // Funciones de medición
  measureOperation: (name: string, operation: () => void | Promise<void>, context?: Record<string, any>) => Promise<any>
  measureCartOperation: (operation: () => void | Promise<void>) => Promise<any>
  measureProductSearch: (searchFn: () => Promise<any>) => Promise<any>
  measureSaleProcessing: (saleFn: () => Promise<any>) => Promise<any>
  measureDatabaseQuery: (queryFn: () => Promise<any>) => Promise<any>
  measureRenderTime: (componentName: string) => () => void
  
  // Funciones de reporte
  generateReport: (timeRange?: { start: Date; end: Date }) => ReturnType<typeof getPerformanceReport>
  refreshReport: () => void
  
  // Configuración
  setMonitoring: (enabled: boolean) => void
  setThresholds: (thresholds: any) => void
  
  // Estado del monitor
  getStatus: () => ReturnType<typeof posPerformanceMonitor.getStatus>
}

export const usePerformanceMonitor = (): UsePerformanceMonitorReturn => {
  const [performanceScore, setPerformanceScore] = useState(100)
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [lastReport, setLastReport] = useState<ReturnType<typeof getPerformanceReport> | null>(null)
  const [webVitals, setWebVitals] = useState<Record<string, number>>({})
  const reportIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Función para medir operaciones genéricas
  const measureOperation = useCallback(async (
    name: string, 
    operation: () => void | Promise<void>,
    context?: Record<string, any>
  ) => {
    if (!isMonitoring) {
      return await operation()
    }

    const endMeasurement = measurePerformance(name, context)
    
    try {
      const result = operation()
      if (result instanceof Promise) {
        return await result.finally(endMeasurement)
      } else {
        endMeasurement()
        return result
      }
    } catch (error) {
      endMeasurement()
      throw error
    }
  }, [isMonitoring])

  // Wrapper para operaciones de carrito
  const measureCartOperationWrapper = useCallback(async (operation: () => void | Promise<void>) => {
    if (!isMonitoring) {
      return await operation()
    }
    return measureCartOperation(operation)
  }, [isMonitoring])

  // Wrapper para búsqueda de productos
  const measureProductSearchWrapper = useCallback(async (searchFn: () => Promise<any>) => {
    if (!isMonitoring) {
      return await searchFn()
    }
    return measureProductSearch(searchFn)
  }, [isMonitoring])

  // Wrapper para procesamiento de ventas
  const measureSaleProcessingWrapper = useCallback(async (saleFn: () => Promise<any>) => {
    if (!isMonitoring) {
      return await saleFn()
    }
    return measureSaleProcessing(saleFn)
  }, [isMonitoring])

  // Wrapper para consultas de base de datos
  const measureDatabaseQueryWrapper = useCallback(async (queryFn: () => Promise<any>) => {
    if (!isMonitoring) {
      return await queryFn()
    }
    return measureDatabaseQuery(queryFn)
  }, [isMonitoring])

  // Función para medir tiempo de renderizado de componentes
  const measureRenderTime = useCallback((componentName: string) => {
    if (!isMonitoring) {
      return () => {}
    }

    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      recordMetric('render-time', renderTime, { component: componentName })
    }
  }, [isMonitoring])

  // Generar reporte de performance
  const generateReport = useCallback((timeRange?: { start: Date; end: Date }) => {
    const report = getPerformanceReport(timeRange)
    setLastReport(report)
    setPerformanceScore(report.summary.performanceScore)
    return report
  }, [])

  // Refrescar reporte
  const refreshReport = useCallback(() => {
    generateReport()
  }, [generateReport])

  // Configurar monitoreo
  const setMonitoring = useCallback((enabled: boolean) => {
    setIsMonitoring(enabled)
    posPerformanceMonitor.setEnabled(enabled)
  }, [])

  // Configurar thresholds
  const setThresholds = useCallback((thresholds: any) => {
    posPerformanceMonitor.setThresholds(thresholds)
  }, [])

  // Obtener estado del monitor
  const getStatus = useCallback(() => {
    return posPerformanceMonitor.getStatus()
  }, [])

  // Cargar Web Vitals al montar
  useEffect(() => {
    if (isMonitoring) {
      getWebVitals().then(setWebVitals)
    }
  }, [isMonitoring])

  // Configurar reporte automático cada 30 segundos
  useEffect(() => {
    if (isMonitoring) {
      // Generar reporte inicial
      generateReport()
      
      // Configurar intervalo para reportes automáticos
      reportIntervalRef.current = setInterval(() => {
        generateReport()
      }, 30000) // 30 segundos
      
      return () => {
        if (reportIntervalRef.current) {
          clearInterval(reportIntervalRef.current)
        }
      }
    }
  }, [isMonitoring, generateReport])

  return {
    // Estado
    performanceScore,
    isMonitoring,
    lastReport,
    webVitals,
    
    // Funciones de medición
    measureOperation,
    measureCartOperation: measureCartOperationWrapper,
    measureProductSearch: measureProductSearchWrapper,
    measureSaleProcessing: measureSaleProcessingWrapper,
    measureDatabaseQuery: measureDatabaseQueryWrapper,
    measureRenderTime,
    
    // Funciones de reporte
    generateReport,
    refreshReport,
    
    // Configuración
    setMonitoring,
    setThresholds,
    
    // Estado del monitor
    getStatus
  }
}

// Hook especializado para componentes que necesitan medir render time
export const useRenderTimeMonitor = (componentName: string) => {
  const { measureRenderTime, isMonitoring } = usePerformanceMonitor()
  const endMeasurementRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (isMonitoring) {
      endMeasurementRef.current = measureRenderTime(componentName)
      
      return () => {
        if (endMeasurementRef.current) {
          endMeasurementRef.current()
        }
      }
    }
  }, [componentName, measureRenderTime, isMonitoring])

  return { isMonitoring }
}

// Hook para medir performance de operaciones específicas
export const useOperationPerformance = () => {
  const { measureOperation, isMonitoring } = usePerformanceMonitor()

  const measureAsync = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    if (!isMonitoring) {
      return await operation()
    }

    const endMeasurement = measurePerformance(operationName, context)
    
    try {
      const result = await operation()
      endMeasurement()
      return result
    } catch (error) {
      endMeasurement()
      throw error
    }
  }, [isMonitoring])

  const measureSync = useCallback(<T>(
    operationName: string,
    operation: () => T,
    context?: Record<string, any>
  ): T => {
    if (!isMonitoring) {
      return operation()
    }

    const endMeasurement = measurePerformance(operationName, context)
    
    try {
      const result = operation()
      endMeasurement()
      return result
    } catch (error) {
      endMeasurement()
      throw error
    }
  }, [isMonitoring])

  return {
    measureAsync,
    measureSync,
    isMonitoring
  }
}

// Hook para alertas de performance
export const usePerformanceAlerts = () => {
  const { lastReport, refreshReport } = usePerformanceMonitor()
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    if (lastReport?.alerts) {
      setAlerts(lastReport.alerts)
    }
  }, [lastReport])

  const clearAlerts = useCallback(() => {
    setAlerts([])
    refreshReport()
  }, [refreshReport])

  const getCriticalAlerts = useCallback(() => {
    return alerts.filter(alert => alert.type === 'critical')
  }, [alerts])

  const getWarningAlerts = useCallback(() => {
    return alerts.filter(alert => alert.type === 'warning')
  }, [alerts])

  return {
    alerts,
    criticalAlerts: getCriticalAlerts(),
    warningAlerts: getWarningAlerts(),
    hasCriticalAlerts: getCriticalAlerts().length > 0,
    hasWarnings: getWarningAlerts().length > 0,
    clearAlerts
  }
}