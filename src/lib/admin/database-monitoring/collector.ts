import { createClient } from '@/lib/supabase/server'
import type {
  ConnectionStats,
  DatabaseAlert,
  DatabaseGrowthPoint,
  DatabaseMetrics,
  IndexStats,
  MonitoringSource,
  MonitoringSourceId,
  MonitoringStatus,
  QueryPerformance,
  StorageBreakdown,
  TableSize,
} from '@/lib/admin/database-monitoring/contracts'

interface DatabaseSizeInfoRow {
  total_size_bytes?: number
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

interface SlowQueryRow {
  query?: string
  duration?: number
  timestamp?: string
  frequency?: number
}

interface QueryPerformanceRow {
  avgQueryTime?: number
  avg_query_time?: number
  queriesPerSecond?: number
  queries_per_second?: number
  cacheHitRatio?: number
  cache_hit_ratio?: number
  slowQueries?: SlowQueryRow[]
  slow_queries?: SlowQueryRow[]
}

interface IndexStatsRow {
  table_name?: string
  index_name?: string
  size_bytes?: number
  idx_scan?: number
  idx_tup_read?: number
  is_primary?: boolean
  is_unique?: boolean
  is_constraint_backed?: boolean
  stats_reset_at?: string
}

interface GrowthHistoryRow {
  date?: string
  snapshot_date?: string
  recorded_at?: string
  size_mb?: number
  total_size_mb?: number
  total_size_bytes?: number
}

interface SourceResult<T> {
  source: MonitoringSource
  data: T | null
}

type MonitoringSupabaseClient = Awaited<ReturnType<typeof createClient>>

function createSource(
  id: MonitoringSourceId,
  label: string,
  status: MonitoringStatus,
  collectedAt: string,
  error?: string
): MonitoringSource {
  return {
    id,
    label,
    status,
    source: `rpc:${id}`,
    collectedAt,
    error,
  }
}

function formatRpcError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Unknown monitoring error'
}

async function collectDatabaseSize(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<number>> {
  try {
    const { data, error } = await supabase.rpc('get_database_size_info')

    if (error) {
      return {
        source: createSource('database_size', 'Database size', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    const row = Array.isArray(data) ? (data[0] as DatabaseSizeInfoRow | undefined) : undefined
    const totalSize = row?.total_size_bytes ?? null

    if (typeof totalSize !== 'number') {
      return {
        source: createSource('database_size', 'Database size', 'unavailable', collectedAt, 'RPC returned no size data'),
        data: null,
      }
    }

    return {
      source: createSource('database_size', 'Database size', 'ok', collectedAt),
      data: totalSize,
    }
  } catch (error) {
    return {
      source: createSource('database_size', 'Database size', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

async function collectTableSizes(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<TableSize[]>> {
  try {
    const { data, error } = await supabase.rpc('get_table_sizes')

    if (error) {
      return {
        source: createSource('table_sizes', 'Table sizes', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        source: createSource('table_sizes', 'Table sizes', 'unavailable', collectedAt, 'RPC returned no table sizes'),
        data: null,
      }
    }

    const rows = data as TableSizeRow[]
    const totalSize = rows.reduce((sum, row) => sum + (row.size_bytes ?? 0), 0)

    return {
      source: createSource('table_sizes', 'Table sizes', 'ok', collectedAt),
      data: rows.map((row) => {
        const size = row.size_bytes ?? 0
        const schemaName = row.schema_name ?? 'public'
        const tableName = row.table_name ?? 'unknown'

        return {
          tableName: `${schemaName}.${tableName}`,
          size,
          rowCount: row.row_count ?? 0,
          indexSize: 0,
          percentage: totalSize > 0 ? (size / totalSize) * 100 : 0,
        }
      }),
    }
  } catch (error) {
    return {
      source: createSource('table_sizes', 'Table sizes', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

async function collectConnectionStats(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<ConnectionStats>> {
  try {
    const { data, error } = await supabase.rpc('get_database_stats')

    if (error) {
      return {
        source: createSource('connection_stats', 'Connection stats', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        source: createSource('connection_stats', 'Connection stats', 'unavailable', collectedAt, 'RPC returned no connection stats'),
        data: null,
      }
    }

    const stats = (data as DatabaseStatRow[]).reduce<Record<string, number>>((acc, row) => {
      if (row.metric) {
        acc[row.metric] = Number(row.value ?? 0)
      }

      return acc
    }, {})

    const activeConnections = Number(stats['Active Connections'] ?? 0)
    const totalConnections = Number(stats['Total Connections'] ?? 0)
    const avgConnectionTime = Number(stats['Average Connection Time'] ?? stats['Avg Connection Time'] ?? NaN)
    const hasKnownLimit = totalConnections > 0

    return {
      source: createSource('connection_stats', 'Connection stats', hasKnownLimit ? 'ok' : 'partial', collectedAt),
      data: {
        activeConnections,
        maxConnections: hasKnownLimit ? totalConnections : null,
        connectionUsage: hasKnownLimit ? Math.min(100, (activeConnections / totalConnections) * 100) : null,
        avgConnectionTime: Number.isFinite(avgConnectionTime) && avgConnectionTime > 0 ? avgConnectionTime : null,
      },
    }
  } catch (error) {
    return {
      source: createSource('connection_stats', 'Connection stats', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

async function collectQueryPerformance(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<QueryPerformance>> {
  try {
    const { data, error } = await supabase.rpc('get_query_performance')

    if (error) {
      return {
        source: createSource('query_performance', 'Query performance', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    if (!data || typeof data !== 'object') {
      return {
        source: createSource('query_performance', 'Query performance', 'unavailable', collectedAt, 'RPC returned no performance payload'),
        data: null,
      }
    }

    const payload = data as QueryPerformanceRow
    const rawSlowQueries = payload.slowQueries ?? payload.slow_queries ?? []
    const avgQueryTime = payload.avgQueryTime ?? payload.avg_query_time ?? null
    const queriesPerSecond = payload.queriesPerSecond ?? payload.queries_per_second ?? null
    const cacheHitRatio = payload.cacheHitRatio ?? payload.cache_hit_ratio ?? null

    const slowQueries = Array.isArray(rawSlowQueries)
      ? rawSlowQueries
          .filter((row) => typeof row.query === 'string' && row.query.length > 0)
          .map((row) => ({
            query: row.query as string,
            duration: Number(row.duration ?? 0),
            timestamp: row.timestamp ?? collectedAt,
            frequency: Number(row.frequency ?? 0),
          }))
      : []

    const hasLatencyData = typeof avgQueryTime === 'number' && avgQueryTime > 0
    const hasThroughputData = typeof queriesPerSecond === 'number' && queriesPerSecond > 0
    const hasCacheData = typeof cacheHitRatio === 'number' && cacheHitRatio >= 0
    const status: MonitoringStatus =
      hasLatencyData || hasThroughputData || slowQueries.length > 0
        ? 'ok'
        : hasCacheData
          ? 'partial'
          : 'unavailable'

    return {
      source: createSource(
        'query_performance',
        'Query performance',
        status,
        collectedAt,
        status === 'partial' ? 'RPC only returned cache ratio data' : status === 'unavailable' ? 'RPC returned no actionable performance data' : undefined
      ),
      data: {
        slowQueries,
        avgQueryTime: hasLatencyData ? avgQueryTime : null,
        queriesPerSecond: hasThroughputData ? queriesPerSecond : null,
        cacheHitRatio: hasCacheData ? cacheHitRatio : null,
      },
    }
  } catch (error) {
    return {
      source: createSource('query_performance', 'Query performance', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

async function collectIndexStats(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<IndexStats[]>> {
  try {
    const { data, error } = await supabase.rpc('get_index_stats')

    if (error) {
      return {
        source: createSource('index_stats', 'Index stats', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    if (!Array.isArray(data)) {
      return {
        source: createSource('index_stats', 'Index stats', 'unavailable', collectedAt, 'RPC returned no index stats'),
        data: null,
      }
    }

    return {
      source: createSource('index_stats', 'Index stats', 'ok', collectedAt),
      data: (data as IndexStatsRow[]).map((row) => ({
        tableName: row.table_name ?? 'unknown',
        indexName: row.index_name ?? 'unknown',
        sizeBytes: row.size_bytes ?? 0,
        scans: row.idx_scan ?? 0,
        reads: row.idx_tup_read ?? 0,
        isUnused: (row.idx_scan ?? 0) === 0,
        isPrimary: row.is_primary ?? false,
        isUnique: row.is_unique ?? false,
        isConstraintBacked: row.is_constraint_backed ?? false,
        statsResetAt: row.stats_reset_at ?? null,
      })),
    }
  } catch (error) {
    return {
      source: createSource('index_stats', 'Index stats', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

async function collectGrowthHistory(supabase: MonitoringSupabaseClient, collectedAt: string): Promise<SourceResult<DatabaseGrowthPoint[]>> {
  let recordError: string | undefined

  try {
    const recordResult = await supabase.rpc('record_database_growth_snapshot')
    if (recordResult.error) {
      recordError = recordResult.error.message
    }

    const { data, error } = await supabase.rpc('get_database_growth_history', { days_back: 30 })

    if (error) {
      return {
        source: createSource('growth_history', 'Growth history', 'unavailable', collectedAt, error.message),
        data: null,
      }
    }

    if (!Array.isArray(data)) {
      return {
        source: createSource('growth_history', 'Growth history', 'unavailable', collectedAt, 'RPC returned no growth history'),
        data: null,
      }
    }

    return {
      source: createSource('growth_history', 'Growth history', recordError ? 'partial' : 'ok', collectedAt, recordError),
      data: (data as GrowthHistoryRow[])
        .map((row) => {
          const date = row.date ?? row.snapshot_date ?? row.recorded_at?.split('T')[0] ?? ''
          const size = row.size_mb ?? row.total_size_mb ?? ((row.total_size_bytes ?? 0) / (1024 * 1024))

          return {
            date,
            size,
          }
        })
        .filter((row) => row.date.length > 0)
        .sort((left, right) => left.date.localeCompare(right.date)),
    }
  } catch (error) {
    return {
      source: createSource('growth_history', 'Growth history', 'unavailable', collectedAt, formatRpcError(error)),
      data: null,
    }
  }
}

function buildStorageBreakdown(totalSize: number | null, tables: TableSize[], indexes: IndexStats[]): StorageBreakdown | null {
  if (typeof totalSize !== 'number' || tables.length === 0) {
    return null
  }

  const totalRelationSize = tables.reduce((sum, row) => sum + row.size, 0)
  const totalIndexSize = indexes.reduce((sum, row) => sum + row.sizeBytes, 0)
  const relations = Math.max(totalRelationSize - totalIndexSize, 0)
  const unclassified = Math.max(totalSize - relations - totalIndexSize, 0)

  return {
    relations,
    indexes: totalIndexSize,
    unclassified,
  }
}

function buildAlerts(metrics: {
  collectedAt: string
  totalSize: number | null
  tablesSizes: TableSize[]
  connectionStats: ConnectionStats | null
  queryPerformance: QueryPerformance | null
  missingMetrics: MonitoringSourceId[]
}): DatabaseAlert[] {
  const alerts: DatabaseAlert[] = []
  const timestamp = metrics.collectedAt

  if (metrics.missingMetrics.length > 0) {
    alerts.push({
      id: 'telemetry-coverage-partial',
      type: 'availability',
      severity: 'high',
      title: 'Monitoring coverage is partial',
      description: `Unavailable sources: ${metrics.missingMetrics.join(', ')}`,
      timestamp,
      resolved: false,
    })
  }

  if (typeof metrics.totalSize === 'number') {
    const totalSizeGb = metrics.totalSize / (1024 * 1024 * 1024)
    if (totalSizeGb > 1) {
      alerts.push({
        id: 'db-size-high',
        type: 'size',
        severity: totalSizeGb > 3 ? 'critical' : 'high',
        title: 'Database size is growing fast',
        description: `Current database size is ${totalSizeGb.toFixed(2)} GB.`,
        value: totalSizeGb,
        threshold: 1,
        timestamp,
        resolved: false,
      })
    }
  }

  if (metrics.connectionStats?.connectionUsage !== null && metrics.connectionStats?.connectionUsage !== undefined) {
    if (metrics.connectionStats.connectionUsage > 80) {
      alerts.push({
        id: 'connections-high',
        type: 'connections',
        severity: metrics.connectionStats.connectionUsage > 95 ? 'critical' : 'high',
        title: 'Connection usage is elevated',
        description: `Current connection usage is ${metrics.connectionStats.connectionUsage.toFixed(1)}%.`,
        value: metrics.connectionStats.connectionUsage,
        threshold: 80,
        timestamp,
        resolved: false,
      })
    }
  }

  if (metrics.queryPerformance?.avgQueryTime !== null && metrics.queryPerformance?.avgQueryTime !== undefined) {
    if (metrics.queryPerformance.avgQueryTime > 500) {
      alerts.push({
        id: 'query-latency-high',
        type: 'performance',
        severity: metrics.queryPerformance.avgQueryTime > 1000 ? 'high' : 'medium',
        title: 'Average query latency is elevated',
        description: `Average query time is ${metrics.queryPerformance.avgQueryTime.toFixed(0)} ms.`,
        value: metrics.queryPerformance.avgQueryTime,
        threshold: 500,
        timestamp,
        resolved: false,
      })
    }
  }

  const largestTable = metrics.tablesSizes[0]
  if (largestTable && largestTable.percentage > 40) {
    alerts.push({
      id: 'largest-table-dominates',
      type: 'storage',
      severity: largestTable.percentage > 60 ? 'high' : 'medium',
      title: 'One table dominates storage usage',
      description: `${largestTable.tableName} holds ${largestTable.percentage.toFixed(1)}% of tracked relation size.`,
      value: largestTable.percentage,
      threshold: 40,
      timestamp,
      resolved: false,
    })
  }

  return alerts
}

export async function collectDatabaseMonitoringSnapshot(): Promise<DatabaseMetrics> {
  const collectedAt = new Date().toISOString()
  const supabase = await createClient()
  const [
    databaseSizeResult,
    tableSizesResult,
    connectionStatsResult,
    queryPerformanceResult,
    indexStatsResult,
    growthHistoryResult,
  ] = await Promise.all([
    collectDatabaseSize(supabase, collectedAt),
    collectTableSizes(supabase, collectedAt),
    collectConnectionStats(supabase, collectedAt),
    collectQueryPerformance(supabase, collectedAt),
    collectIndexStats(supabase, collectedAt),
    collectGrowthHistory(supabase, collectedAt),
  ])

  const sources = [
    databaseSizeResult.source,
    tableSizesResult.source,
    connectionStatsResult.source,
    queryPerformanceResult.source,
    indexStatsResult.source,
    growthHistoryResult.source,
  ]

  const missingMetrics = sources
    .filter((source) => source.status === 'unavailable')
    .map((source) => source.id)

  const overallStatus: MonitoringStatus =
    sources.every((source) => source.status === 'unavailable')
      ? 'unavailable'
      : sources.some((source) => source.status !== 'ok')
        ? 'partial'
        : 'ok'

  const tablesSizes = tableSizesResult.data ?? []
  const connectionStats = connectionStatsResult.data
  const queryPerformance = queryPerformanceResult.data
  const indexStats = indexStatsResult.data ?? []
  const growthHistory = growthHistoryResult.data ?? []
  const totalSize = databaseSizeResult.data
  const storageBreakdown = buildStorageBreakdown(totalSize, tablesSizes, indexStats)

  return {
    collectedAt,
    overallStatus,
    sources,
    missingMetrics,
    totalSize,
    tablesSizes,
    connectionStats,
    queryPerformance,
    storageBreakdown,
    alerts: buildAlerts({
      collectedAt,
      totalSize,
      tablesSizes,
      connectionStats,
      queryPerformance,
      missingMetrics,
    }),
    indexStats,
    growthHistory,
  }
}
