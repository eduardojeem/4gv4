import { describe, expect, it } from 'vitest'
import {
  buildOptimizationRecommendations,
  buildQuickMetrics,
  type DatabaseMetrics,
  type IndexStats,
} from '@/services/database-monitoring-service'

const metrics: DatabaseMetrics = {
  totalSize: 900 * 1024 * 1024,
  tablesSizes: [
    { tableName: 'public.audit_log', size: 300 * 1024 * 1024, rowCount: 12000, indexSize: 40 * 1024 * 1024, percentage: 48 },
    { tableName: 'public.products', size: 120 * 1024 * 1024, rowCount: 2500, indexSize: 20 * 1024 * 1024, percentage: 20 },
  ],
  connectionStats: {
    activeConnections: 82,
    maxConnections: 100,
    connectionUsage: 82,
    avgConnectionTime: 140,
  },
  queryPerformance: {
    slowQueries: [],
    avgQueryTime: 640,
    queriesPerSecond: 40,
    cacheHitRatio: 72,
  },
  storageBreakdown: {
    tables: 420 * 1024 * 1024,
    indexes: 60 * 1024 * 1024,
    logs: 40 * 1024 * 1024,
    temp: 10 * 1024 * 1024,
    other: 5 * 1024 * 1024,
  },
  alerts: [
    {
      id: 'critical-1',
      type: 'connections',
      severity: 'critical',
      title: 'Uso alto',
      description: 'Pool saturado',
      value: 82,
      threshold: 70,
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      resolved: false,
    },
  ],
}

const indexStats: IndexStats[] = [
  {
    tableName: 'public.products',
    indexName: 'products_search_idx',
    sizeBytes: 20 * 1024,
    scans: 0,
    reads: 0,
    isUnused: true,
  },
]

describe('database monitoring helpers', () => {
  it('builds quick metrics from loaded metrics', () => {
    expect(buildQuickMetrics(metrics)).toEqual({
      totalSize: '900 MB',
      totalSizeBytes: 943718400,
      activeConnections: 82,
      connectionUsage: 82,
      avgQueryTime: 640,
      cacheHitRatio: 72,
      alertsCount: 1,
      status: 'critical',
    })
  })

  it('builds deterministic recommendations from current metrics', () => {
    const first = buildOptimizationRecommendations(metrics, indexStats)
    const second = buildOptimizationRecommendations(metrics, indexStats)

    expect(first).toEqual(second)
    expect(first.some(message => message.includes('índices sin uso'))).toBe(true)
    expect(first.some(message => message.includes('uso de conexiones'))).toBe(true)
    expect(first.some(message => message.includes('audit_log'))).toBe(true)
  })
})
