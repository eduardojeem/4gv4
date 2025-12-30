import { createClient } from '@/lib/supabase/client'

export interface DatabaseMetrics {
  totalSize: number
  tablesSizes: TableSize[]
  connectionStats: ConnectionStats
  queryPerformance: QueryPerformance
  storageBreakdown: StorageBreakdown
  alerts: DatabaseAlert[]
}

export interface TableSize {
  tableName: string
  size: number
  rowCount: number
  indexSize: number
  percentage: number
}

export interface ConnectionStats {
  activeConnections: number
  maxConnections: number
  connectionUsage: number
  avgConnectionTime: number
}

export interface QueryPerformance {
  slowQueries: SlowQuery[]
  avgQueryTime: number
  queriesPerSecond: number
  cacheHitRatio: number
}

export interface SlowQuery {
  query: string
  duration: number
  timestamp: Date
  frequency: number
}

export interface StorageBreakdown {
  tables: number
  indexes: number
  logs: number
  temp: number
  other: number
}

export interface DatabaseAlert {
  id: string
  type: 'size' | 'performance' | 'connections' | 'storage'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  value: number
  threshold: number
  timestamp: Date
  resolved: boolean
}

class DatabaseMonitoringService {
  private supabase = createClient()

  // Obtener métricas generales de la base de datos
  async getDatabaseMetrics(): Promise<{ success: boolean; data?: DatabaseMetrics; error?: string }> {
    try {
      // Obtener tamaño total de la base de datos
      const totalSizeInfo = await this.getDatabaseSizeInfo()
      
      // Obtener tamaños de tablas
      const tablesSizes = await this.getTablesSizes()
      
      // Obtener estadísticas de conexiones
      const connectionStats = await this.getConnectionStats()
      
      // Obtener rendimiento de queries
      const queryPerformance = await this.getQueryPerformance()
      
      // Obtener desglose de almacenamiento
      const storageBreakdown = await this.getStorageBreakdown(tablesSizes)
      
      // Generar alertas
      const alerts = await this.generateAlerts(totalSizeInfo.totalSize, tablesSizes, connectionStats, queryPerformance)

      const metrics: DatabaseMetrics = {
        totalSize: totalSizeInfo.totalSize,
        tablesSizes,
        connectionStats,
        queryPerformance,
        storageBreakdown,
        alerts
      }

      return { success: true, data: metrics }
    } catch (error) {
      console.error('Error obteniendo métricas de base de datos:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  // Obtener información del tamaño total de la base de datos
  private async getDatabaseSizeInfo(): Promise<{ totalSize: number; sizeGB: number; sizeMB: number }> {
    try {
      const { data, error } = await this.supabase.rpc('get_database_size_info')
      
      if (error) {
        console.warn('No se pudo obtener tamaño de BD, usando estimación:', error)
        const estimatedSize = 25 * 1024 * 1024 // 25MB estimado
        return {
          totalSize: estimatedSize,
          sizeMB: 25,
          sizeGB: 0.025
        }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const dbInfo = data[0]
        return {
          totalSize: dbInfo.total_size_bytes || 0,
          sizeMB: dbInfo.total_size_mb || 0,
          sizeGB: dbInfo.total_size_gb || 0
        }
      }

      // Fallback a estimación
      const estimatedSize = 25 * 1024 * 1024
      return {
        totalSize: estimatedSize,
        sizeMB: 25,
        sizeGB: 0.025
      }
    } catch (error) {
      console.warn('Error obteniendo tamaño de BD:', error)
      const estimatedSize = 25 * 1024 * 1024
      return {
        totalSize: estimatedSize,
        sizeMB: 25,
        sizeGB: 0.025
      }
    }
  }

  // Obtener tamaños de todas las tablas
  private async getTablesSizes(): Promise<TableSize[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_sizes')
      
      if (error) {
        console.warn('No se pudo obtener tamaños reales, usando datos simulados:', error)
        return this.getMockTableSizes()
      }

      if (data && Array.isArray(data)) {
        const totalSize = data.reduce((sum: number, table: any) => sum + (table.size_bytes || 0), 0)
        
        return data.map((table: any) => ({
          tableName: `${table.schema_name}.${table.table_name}`,
          size: table.size_bytes || 0,
          rowCount: table.row_count || 0,
          indexSize: Math.floor((table.size_bytes || 0) * 0.2), // Estimación de índices
          percentage: totalSize > 0 ? ((table.size_bytes || 0) / totalSize) * 100 : 0
        }))
      }

      return this.getMockTableSizes()
    } catch (error) {
      console.warn('Error obteniendo tamaños de tablas, usando datos simulados:', error)
      return this.getMockTableSizes()
    }
  }

  // Datos simulados para tamaños de tablas
  private getMockTableSizes(): TableSize[] {
    const tables = [
      { name: 'products', baseSize: 2.5, rows: 1250 },
      { name: 'customers', baseSize: 1.8, rows: 890 },
      { name: 'repairs', baseSize: 3.2, rows: 1680 },
      { name: 'product_movements', baseSize: 4.1, rows: 2340 },
      { name: 'pos_sales', baseSize: 2.9, rows: 1560 },
      { name: 'categories', baseSize: 0.3, rows: 45 },
      { name: 'suppliers', baseSize: 0.5, rows: 78 },
      { name: 'users', baseSize: 0.2, rows: 12 },
      { name: 'notifications', baseSize: 1.1, rows: 567 },
      { name: 'audit_logs', baseSize: 5.8, rows: 3240 }
    ]

    const totalSize = tables.reduce((sum, table) => sum + table.baseSize, 0)

    return tables.map(table => ({
      tableName: table.name,
      size: table.baseSize * 1024 * 1024, // Convertir a bytes
      rowCount: table.rows,
      indexSize: table.baseSize * 0.2 * 1024 * 1024, // 20% del tamaño para índices
      percentage: (table.baseSize / totalSize) * 100
    })).sort((a, b) => b.size - a.size)
  }

  // Obtener estadísticas de conexiones
  private async getConnectionStats(): Promise<ConnectionStats> {
    try {
      const { data, error } = await this.supabase.rpc('get_database_stats')
      
      if (error) {
        console.warn('No se pudieron obtener estadísticas de conexión, usando datos simulados:', error)
        return this.getMockConnectionStats()
      }

      if (data && Array.isArray(data)) {
        const stats = data.reduce((acc: any, stat: any) => {
          acc[stat.metric] = stat.value
          return acc
        }, {})

        return {
          activeConnections: parseInt(stats['Active Connections'] || '0'),
          maxConnections: 100, // Valor por defecto de Supabase
          connectionUsage: Math.min(100, (parseInt(stats['Active Connections'] || '0') / 100) * 100),
          avgConnectionTime: Math.floor(Math.random() * 200) + 50 // Simulado por ahora
        }
      }

      return this.getMockConnectionStats()
    } catch (error) {
      console.warn('Error obteniendo estadísticas de conexión:', error)
      return this.getMockConnectionStats()
    }
  }

  // Datos simulados para conexiones
  private getMockConnectionStats(): ConnectionStats {
    return {
      activeConnections: Math.floor(Math.random() * 15) + 5,
      maxConnections: 100,
      connectionUsage: Math.floor(Math.random() * 30) + 10,
      avgConnectionTime: Math.floor(Math.random() * 200) + 50
    }
  }

  // Obtener rendimiento de queries
  private async getQueryPerformance(): Promise<QueryPerformance> {
    try {
      const { data, error } = await this.supabase.rpc('get_query_performance')
      
      if (error) {
        console.warn('No se pudo obtener rendimiento de queries, usando datos simulados:', error)
        return this.getMockQueryPerformance()
      }

      return data || this.getMockQueryPerformance()
    } catch (error) {
      console.warn('Error obteniendo rendimiento de queries:', error)
      return this.getMockQueryPerformance()
    }
  }

  // Datos simulados para rendimiento de queries
  private getMockQueryPerformance(): QueryPerformance {
    const slowQueries: SlowQuery[] = [
      {
        query: 'SELECT * FROM repairs WHERE status = ? ORDER BY created_at DESC',
        duration: 1250,
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        frequency: 23
      },
      {
        query: 'SELECT p.*, pm.* FROM products p JOIN product_movements pm ON p.id = pm.product_id',
        duration: 890,
        timestamp: new Date(Date.now() - 1000 * 60 * 8),
        frequency: 12
      },
      {
        query: 'UPDATE customers SET last_activity = NOW() WHERE id IN (?)',
        duration: 650,
        timestamp: new Date(Date.now() - 1000 * 60 * 3),
        frequency: 45
      }
    ]

    return {
      slowQueries,
      avgQueryTime: Math.floor(Math.random() * 100) + 50,
      queriesPerSecond: Math.floor(Math.random() * 50) + 20,
      cacheHitRatio: Math.floor(Math.random() * 20) + 75
    }
  }

  // Obtener desglose de almacenamiento
  private async getStorageBreakdown(tablesSizes: TableSize[]): Promise<StorageBreakdown> {
    const tablesSize = tablesSizes.reduce((sum, table) => sum + table.size, 0)
    const indexesSize = tablesSizes.reduce((sum, table) => sum + table.indexSize, 0)
    
    return {
      tables: tablesSize,
      indexes: indexesSize,
      logs: tablesSize * 0.1, // 10% para logs
      temp: tablesSize * 0.05, // 5% para archivos temporales
      other: tablesSize * 0.03 // 3% para otros
    }
  }

  // Generar alertas basadas en métricas
  private async generateAlerts(
    totalSize: number, 
    tablesSizes: TableSize[], 
    connectionStats: ConnectionStats, 
    queryPerformance: QueryPerformance
  ): Promise<DatabaseAlert[]> {
    const alerts: DatabaseAlert[] = []
    const now = new Date()

    // Alerta por tamaño total de BD
    const totalSizeGB = totalSize / (1024 * 1024 * 1024)
    if (totalSizeGB > 0.5) { // 500MB threshold
      alerts.push({
        id: 'db-size-warning',
        type: 'size',
        severity: totalSizeGB > 1 ? 'high' : 'medium',
        title: 'Tamaño de base de datos elevado',
        description: `La base de datos ha alcanzado ${totalSizeGB.toFixed(2)}GB. Considera optimizar o limpiar datos antiguos.`,
        value: totalSizeGB,
        threshold: 0.5,
        timestamp: now,
        resolved: false
      })
    }

    // Alerta por uso de conexiones
    if (connectionStats.connectionUsage > 70) {
      alerts.push({
        id: 'connection-usage-high',
        type: 'connections',
        severity: connectionStats.connectionUsage > 90 ? 'critical' : 'high',
        title: 'Alto uso de conexiones',
        description: `Uso de conexiones al ${connectionStats.connectionUsage}%. Monitorea la carga del sistema.`,
        value: connectionStats.connectionUsage,
        threshold: 70,
        timestamp: now,
        resolved: false
      })
    }

    // Alerta por queries lentas
    if (queryPerformance.avgQueryTime > 500) {
      alerts.push({
        id: 'slow-queries-detected',
        type: 'performance',
        severity: queryPerformance.avgQueryTime > 1000 ? 'high' : 'medium',
        title: 'Queries lentas detectadas',
        description: `Tiempo promedio de query: ${queryPerformance.avgQueryTime}ms. Revisa índices y optimiza consultas.`,
        value: queryPerformance.avgQueryTime,
        threshold: 500,
        timestamp: now,
        resolved: false
      })
    }

    // Alerta por tabla muy grande
    const largestTable = tablesSizes[0]
    if (largestTable && largestTable.percentage > 40) {
      alerts.push({
        id: 'large-table-warning',
        type: 'storage',
        severity: largestTable.percentage > 60 ? 'high' : 'medium',
        title: 'Tabla con crecimiento excesivo',
        description: `La tabla '${largestTable.tableName}' representa el ${largestTable.percentage.toFixed(1)}% del total. Considera particionado o archivado.`,
        value: largestTable.percentage,
        threshold: 40,
        timestamp: now,
        resolved: false
      })
    }

    return alerts
  }

  // Obtener historial de crecimiento de la BD
  async getDatabaseGrowthHistory(days: number = 30): Promise<{ date: string; size: number }[]> {
    try {
      // En un entorno real, esto vendría de una tabla de métricas históricas
      const history = []
      const now = new Date()
      const baseSize = 20 // MB base
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const growth = Math.random() * 2 + (days - i) * 0.1 // Crecimiento simulado
        
        history.push({
          date: date.toISOString().split('T')[0],
          size: baseSize + growth
        })
      }
      
      return history
    } catch (error) {
      console.error('Error obteniendo historial de crecimiento:', error)
      return []
    }
  }

  // Obtener recomendaciones de optimización
  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations = [
      'Considera crear índices en las columnas más consultadas de la tabla "repairs"',
      'La tabla "audit_logs" está creciendo rápidamente. Implementa rotación de logs',
      'Optimiza las consultas que unen "products" y "product_movements"',
      'Revisa la configuración de cache para mejorar el hit ratio',
      'Considera archivar registros antiguos de "notifications" (>6 meses)',
      'Implementa paginación en las consultas de listado de productos',
      'Revisa los índices no utilizados para liberar espacio',
      'Considera usar VACUUM ANALYZE para optimizar el rendimiento'
    ]

    // En un entorno real, estas recomendaciones serían generadas dinámicamente
    // basándose en el análisis de las métricas actuales
    return recommendations.slice(0, Math.floor(Math.random() * 4) + 3)
  }

  // Obtener métricas rápidas para dashboard
  async getQuickMetrics(): Promise<{ 
    success: boolean; 
    data?: {
      totalSize: string;
      totalSizeBytes: number;
      activeConnections: number;
      avgQueryTime: number;
      cacheHitRatio: number;
      alertsCount: number;
      status: 'good' | 'warning' | 'critical';
    };
    error?: string;
  }> {
    try {
      const metrics = await this.getDatabaseMetrics()
      
      if (!metrics.success || !metrics.data) {
        return {
          success: false,
          error: metrics.error || 'No se pudieron obtener las métricas'
        }
      }

      const data = metrics.data
      const activeAlerts = data.alerts.filter(alert => !alert.resolved)
      
      // Determinar estado general
      let status: 'good' | 'warning' | 'critical' = 'good'
      if (activeAlerts.some(alert => alert.severity === 'critical')) {
        status = 'critical'
      } else if (activeAlerts.some(alert => alert.severity === 'high') || activeAlerts.length > 3) {
        status = 'warning'
      }

      return {
        success: true,
        data: {
          totalSize: this.formatBytes(data.totalSize),
          totalSizeBytes: data.totalSize,
          activeConnections: data.connectionStats.activeConnections,
          avgQueryTime: data.queryPerformance.avgQueryTime,
          cacheHitRatio: data.queryPerformance.cacheHitRatio,
          alertsCount: activeAlerts.length,
          status
        }
      }
    } catch (error) {
      console.error('Error obteniendo métricas rápidas:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  // Método helper para formatear bytes (público)
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export const databaseMonitoringService = new DatabaseMonitoringService()