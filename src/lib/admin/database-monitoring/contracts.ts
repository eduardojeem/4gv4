export type MonitoringStatus = 'ok' | 'partial' | 'unavailable'

export type MonitoringSourceId =
  | 'database_size'
  | 'table_sizes'
  | 'connection_stats'
  | 'query_performance'
  | 'index_stats'
  | 'growth_history'

export interface MonitoringSource {
  id: MonitoringSourceId
  label: string
  status: MonitoringStatus
  source: string
  collectedAt: string
  error?: string
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
  maxConnections: number | null
  connectionUsage: number | null
  avgConnectionTime: number | null
}

export interface SlowQuery {
  query: string
  duration: number
  timestamp: string
  frequency: number
}

export interface QueryPerformance {
  slowQueries: SlowQuery[]
  avgQueryTime: number | null
  queriesPerSecond: number | null
  cacheHitRatio: number | null
}

export interface IndexStats {
  tableName: string
  indexName: string
  sizeBytes: number
  scans: number
  reads: number
  isUnused: boolean
  isPrimary: boolean
  isUnique: boolean
  isConstraintBacked: boolean
  statsResetAt: string | null
}

export interface StorageBreakdown {
  relations: number
  indexes: number
  unclassified: number
}

export interface DatabaseAlert {
  id: string
  type: 'size' | 'performance' | 'connections' | 'storage' | 'availability'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  value?: number
  threshold?: number
  timestamp: string
  resolved: boolean
}

export interface DatabaseGrowthPoint {
  date: string
  size: number
}

export interface DatabaseMetrics {
  collectedAt: string
  overallStatus: MonitoringStatus
  sources: MonitoringSource[]
  missingMetrics: MonitoringSourceId[]
  totalSize: number | null
  tablesSizes: TableSize[]
  connectionStats: ConnectionStats | null
  queryPerformance: QueryPerformance | null
  storageBreakdown: StorageBreakdown | null
  alerts: DatabaseAlert[]
  indexStats: IndexStats[]
  growthHistory: DatabaseGrowthPoint[]
}

export interface QuickDatabaseMetrics {
  totalSize: string
  totalSizeBytes: number | null
  activeConnections: number | null
  connectionUsage: number | null
  avgQueryTime: number | null
  cacheHitRatio: number | null
  alertsCount: number
  status: MonitoringStatus
}

export type MaintenanceTask = 'reset_stats' | 'rotate_logs'

export interface MaintenanceTaskParams {
  days?: number
}

export interface MaintenanceResponse {
  success: boolean
  message: string
  task: MaintenanceTask
  executedAt: string
  retentionDays?: number
  deletedCount?: number
}
