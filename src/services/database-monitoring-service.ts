import { createClient } from '@/lib/supabase/client'

export interface DatabaseMetrics {
  totalSize: number
  tablesSizes: TableSize[]
  connectionStats: ConnectionStats
  queryPerformance: QueryPerformance
  storageBreakdown: StorageBreakdown
  alerts: DatabaseAlert[]
  isMockData?: boolean
}

export interface TableSize {
  tableName: string
  size: number
  rowCount: number
  indexSize: number
  percentage: number
  isMock?: boolean
}

export interface ConnectionStats {
  activeConnections: number
  maxConnections: number
  connectionUsage: number
  avgConnectionTime: number
  isMock?: boolean
}

export interface QueryPerformance {
  slowQueries: SlowQuery[]
  avgQueryTime: number
  queriesPerSecond: number
  cacheHitRatio: number
  isMock?: boolean
}

export interface SlowQuery {
  query: string
  duration: number
  timestamp: Date
  frequency: number
}

export interface IndexStats {
  tableName: string
  indexName: string
  sizeBytes: number
  scans: number
  reads: number
  isUnused: boolean
  isMock?: boolean
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

export interface DatabaseGrowthPoint {
  date: string
  size: number
}

export interface QuickDatabaseMetrics {
  totalSize: string
  totalSizeBytes: number
  activeConnections: number
  connectionUsage: number
  avgQueryTime: number
  cacheHitRatio: number
  alertsCount: number
  status: 'good' | 'warning' | 'critical'
}

export type MaintenanceTask = 'reset_stats' | 'clear_logs' | 'rotate_logs'

export interface MaintenanceTaskParams {
  days?: number
}

interface DatabaseSizeInfoRow {
  total_size_bytes?: number
  total_size_mb?: number
  total_size_gb?: number
}

interface TableSizeRow {
  schema_name?: string
  table_name?: string
  size_bytes?: number
  row_count?: number
}

interface DatabaseStatRow {
  metric?: string
  value?: number | string
}

interface IndexStatsRow {
  table_name?: string
  index_name?: string
  size_bytes?: number
  idx_scan?: number
  idx_tup_read?: number
}

interface GrowthHistoryRow {
  date?: string
  snapshot_date?: string
  recorded_at?: string
  size_mb?: number
  total_size_mb?: number
  total_size_bytes?: number
}

export function buildQuickMetrics(metrics: DatabaseMetrics): QuickDatabaseMetrics {
  const activeAlerts = metrics.alerts.filter(alert => !alert.resolved)

  let status: 'good' | 'warning' | 'critical' = 'good'
  if (activeAlerts.some(alert => alert.severity === 'critical')) {
    status = 'critical'
  } else if (activeAlerts.some(alert => alert.severity === 'high') || activeAlerts.length > 3) {
    status = 'warning'
  }

  return {
    totalSize: formatBytes(metrics.totalSize),
    totalSizeBytes: metrics.totalSize,
    activeConnections: metrics.connectionStats.activeConnections,
    connectionUsage: metrics.connectionStats.connectionUsage,
    avgQueryTime: metrics.queryPerformance.avgQueryTime,
    cacheHitRatio: metrics.queryPerformance.cacheHitRatio,
    alertsCount: activeAlerts.length,
    status
  }
}

export function buildOptimizationRecommendations(metrics: DatabaseMetrics, indexStats: IndexStats[]): string[] {
  const recommendations: string[] = []
  const unusedIndexes = indexStats.filter(idx => idx.isUnused)
  const largestTable = metrics.tablesSizes[0]
  const auditLogTable = metrics.tablesSizes.find(table => table.tableName.endsWith('audit_log') || table.tableName === 'audit_log')

  if (metrics.queryPerformance.avgQueryTime > 500) {
    recommendations.push('Revisa las consultas lentas e incorpora índices en los filtros más frecuentes para bajar la latencia promedio.')
  }

  if (metrics.queryPerformance.cacheHitRatio < 80) {
    recommendations.push('El cache hit ratio está por debajo del objetivo. Ajusta lecturas repetitivas y revisa patrones que evitan reutilizar caché.')
  }

  if (metrics.connectionStats.connectionUsage > 70) {
    recommendations.push('El uso de conexiones está elevado. Revisa pooling, conexiones largas y tareas concurrentes en segundo plano.')
  }

  if (largestTable && largestTable.percentage > 40) {
    recommendations.push(`La tabla ${largestTable.tableName} concentra ${largestTable.percentage.toFixed(1)}% del almacenamiento. Evalúa archivado, particionado o limpieza dirigida.`)
  }

  if (auditLogTable && auditLogTable.percentage > 15) {
    recommendations.push('La tabla audit_log ya tiene peso relevante. Define una retención estable y automatiza la rotación de logs.')
  }

  if (unusedIndexes.length > 0) {
    recommendations.push(`Se detectaron ${unusedIndexes.length} índices sin uso. Valida si se pueden eliminar para recuperar espacio y reducir costo de escritura.`)
  }

  if (metrics.totalSize > 0.5 * 1024 * 1024 * 1024) {
    recommendations.push('El tamaño total de la base superó el umbral operativo. Revisa datos históricos, adjuntos y tablas transaccionales de alto crecimiento.')
  }

  if (recommendations.length === 0) {
    recommendations.push('No se detectaron señales críticas con las métricas actuales. Mantén la revisión periódica de índices, crecimiento y retención de logs.')
  }

  return recommendations
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
        alerts,
        isMockData: totalSizeInfo.isMock || tablesSizes.some(t => t.isMock) || connectionStats.isMock || queryPerformance.isMock,
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
  private async getDatabaseSizeInfo(): Promise<{ totalSize: number; sizeGB: number; sizeMB: number; isMock?: boolean }> {
    try {
      const { data, error } = await this.supabase.rpc('get_database_size_info')
      
      if (error) {
        console.warn('No se pudo obtener tamaño de BD, usando estimación:', error)
        const estimatedSize = 25 * 1024 * 1024 // 25MB estimado
        return {
          totalSize: estimatedSize,
          sizeMB: 25,
          sizeGB: 0.025,
          isMock: true
        }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const dbInfo = data[0] as DatabaseSizeInfoRow
        return {
          totalSize: dbInfo.total_size_bytes || 0,
          sizeMB: dbInfo.total_size_mb || 0,
          sizeGB: dbInfo.total_size_gb || 0,
          isMock: false
        }
      }

      // Fallback a estimación
      const estimatedSize = 25 * 1024 * 1024
      return {
        totalSize: estimatedSize,
        sizeMB: 25,
        sizeGB: 0.025,
        isMock: true
      }
    } catch (error) {
      console.warn('Error obteniendo tamaño de BD:', error)
      const estimatedSize = 25 * 1024 * 1024
      return {
        totalSize: estimatedSize,
        sizeMB: 25,
        sizeGB: 0.025,
        isMock: true
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
        const rows = data as TableSizeRow[]
        const totalSize = rows.reduce((sum, table) => sum + (table.size_bytes || 0), 0)
        
        return rows.map((table) => ({
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
      { name: 'audit_log', baseSize: 5.8, rows: 3240 }
    ]

    const totalSize = tables.reduce((sum, table) => sum + table.baseSize, 0)

    return tables.map(table => ({
      tableName: table.name,
      size: table.baseSize * 1024 * 1024, // Convertir a bytes
      rowCount: table.rows,
      indexSize: table.baseSize * 0.2 * 1024 * 1024, // 20% del tamaño para índices
      percentage: (table.baseSize / totalSize) * 100,
      isMock: true
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
        const stats = (data as DatabaseStatRow[]).reduce<Record<string, number | string>>((acc, stat) => {
          if (stat.metric) {
            acc[stat.metric] = stat.value ?? 0
          }
          return acc
        }, {})

        const activeConnections = Number(stats['Active Connections'] ?? 0)
        const avgConnectionTime = Number(stats['Average Connection Time'] ?? stats['Avg Connection Time'] ?? 0)

        return {
          activeConnections,
          maxConnections: 100, // Valor por defecto de Supabase
          connectionUsage: Math.min(100, (activeConnections / 100) * 100),
          avgConnectionTime,
          isMock: avgConnectionTime === 0
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
      activeConnections: 12,
      maxConnections: 100,
      connectionUsage: 12,
      avgConnectionTime: 80,
      isMock: true
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
      avgQueryTime: 120,
      queriesPerSecond: 32,
      cacheHitRatio: 88,
      isMock: true
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

  // Obtener estadísticas de índices
  async getIndexStats(): Promise<IndexStats[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_index_stats')
      
      if (error) {
        console.warn('No se pudo obtener estadísticas de índices, usando datos simulados:', error)
        return this.getMockIndexStats()
      }

      if (data && Array.isArray(data)) {
        return (data as IndexStatsRow[]).map((idx) => ({
          tableName: idx.table_name,
          indexName: idx.index_name,
          sizeBytes: idx.size_bytes || 0,
          scans: idx.idx_scan || 0,
          reads: idx.idx_tup_read || 0,
          isUnused: (idx.idx_scan || 0) === 0,
          isMock: false
        }))
      }

      return this.getMockIndexStats()
    } catch (error) {
      console.warn('Error obteniendo estadísticas de índices:', error)
      return this.getMockIndexStats()
    }
  }

  // Datos simulados para índices
  private getMockIndexStats(): IndexStats[] {
    return [
      { tableName: 'products', indexName: 'products_pkey', sizeBytes: 1024 * 500, scans: 15000, reads: 50000, isUnused: false, isMock: true },
      { tableName: 'products', indexName: 'products_category_id_idx', sizeBytes: 1024 * 200, scans: 4500, reads: 12000, isUnused: false, isMock: true },
      { tableName: 'users', indexName: 'users_email_idx', sizeBytes: 1024 * 50, scans: 0, reads: 0, isUnused: true, isMock: true }, // Unused
      { tableName: 'repairs', indexName: 'repairs_customer_id_idx', sizeBytes: 1024 * 300, scans: 8900, reads: 23000, isUnused: false, isMock: true },
      { tableName: 'audit_log', indexName: 'audit_log_created_at_idx', sizeBytes: 1024 * 800, scans: 120, reads: 500, isUnused: false, isMock: true },
      { tableName: 'inventory', indexName: 'inventory_sku_idx', sizeBytes: 1024 * 100, scans: 0, reads: 0, isUnused: true, isMock: true } // Unused
    ]
  }

  // Obtener historial de crecimiento de la BD
  async getDatabaseGrowthHistory(days: number = 30): Promise<DatabaseGrowthPoint[]> {
    try {
      // En un entorno real, esto vendría de una tabla de métricas históricas
      const { data, error } = await this.supabase.rpc('get_database_growth_history', { days_back: days })

      if (error) {
        console.warn('No se pudo obtener histÃ³rico real de crecimiento:', error)
        return []
      }

      if (!data || !Array.isArray(data)) {
        return []
      }

      return (data as GrowthHistoryRow[])
        .map((point) => {
          const date = point.date || point.snapshot_date || point.recorded_at?.split('T')[0] || ''
          const size = point.size_mb || point.total_size_mb || ((point.total_size_bytes || 0) / (1024 * 1024))

          return { date, size }
        })
        .filter(point => point.date.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      console.error('Error obteniendo historial de crecimiento:', error)
      return []
    }
  }

  // Obtener recomendaciones de optimización
  getOptimizationRecommendations(metrics: DatabaseMetrics, indexStats: IndexStats[]): string[] {
    const recommendations = [
      'Considera crear índices en las columnas más consultadas de la tabla "repairs"',
      'La tabla "audit_log" está creciendo rápidamente. Implementa rotación de logs',
      'Optimiza las consultas que unen "products" y "product_movements"',
      'Revisa la configuración de cache para mejorar el hit ratio',
      'Considera archivar registros antiguos de "notifications" (>6 meses)',
      'Implementa paginación en las consultas de listado de productos',
      'Revisa los índices no utilizados para liberar espacio',
      'Considera usar VACUUM ANALYZE para optimizar el rendimiento'
    ]

    // En un entorno real, estas recomendaciones serían generadas dinámicamente
    // basándose en el análisis de las métricas actuales
    void recommendations
    return buildOptimizationRecommendations(metrics, indexStats)
  }

  // Obtener métricas rápidas para dashboard
  async getQuickMetrics(): Promise<{ 
    success: boolean; 
    data?: QuickDatabaseMetrics;
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

      return {
        success: true,
        data: buildQuickMetrics(metrics.data)
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
    return formatBytes(bytes)
  }

  // Realizar tarea de mantenimiento (usa el API del servidor para mayor seguridad)
  async performMaintenanceTask(task: MaintenanceTask, params?: MaintenanceTaskParams): Promise<{ success: boolean; message: string }> {
    try {
      const apiTask = task === 'rotate_logs' ? 'rotate_audit_logs' : task
      
      const response = await fetch('/api/admin/database/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: apiTask, params })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error en el servidor')
      }

      return await response.json()
    } catch (error) {
      console.error('Error en tarea de mantenimiento:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Error al realizar el mantenimiento'
      }
    }
  }

  // Rotar logs de auditoría
  async rotateAuditLogs(days: number): Promise<{ success: boolean; message: string }> {
    return this.performMaintenanceTask('rotate_logs', { days })
  }
}

export const databaseMonitoringService = new DatabaseMonitoringService()
