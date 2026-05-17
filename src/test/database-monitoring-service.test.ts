import { describe, expect, it } from 'vitest'
import {
  buildOptimizationRecommendations,
  buildQuickMetrics,
  isUnusedIndexReviewCandidate,
  type DatabaseMetrics,
  type IndexStats,
} from '@/services/database-monitoring-service'

const indexStats: IndexStats[] = [
  {
    tableName: 'public.products',
    indexName: 'products_search_idx',
    sizeBytes: 20 * 1024,
    scans: 0,
    reads: 0,
    isUnused: true,
    isPrimary: false,
    isUnique: false,
    isConstraintBacked: false,
    statsResetAt: '2026-01-01T00:00:00.000Z',
  },
]

const metrics: DatabaseMetrics = {
  collectedAt: '2026-01-01T00:00:00.000Z',
  overallStatus: 'partial',
  sources: [],
  missingMetrics: [],
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
    relations: 420 * 1024 * 1024,
    indexes: 60 * 1024 * 1024,
    unclassified: 5 * 1024 * 1024,
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
      timestamp: '2026-01-01T00:00:00.000Z',
      resolved: false,
    },
  ],
  indexStats,
  growthHistory: [],
}

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
      status: 'partial',
    })
  })

  it('builds deterministic recommendations from current metrics', () => {
    const first = buildOptimizationRecommendations(metrics, indexStats)
    const second = buildOptimizationRecommendations(metrics, indexStats)

    expect(first).toEqual(second)
    expect(first.some((message) => message.includes('Connection pressure is high'))).toBe(true)
    expect(first.some((message) => message.includes('audit_log'))).toBe(true)
    expect(first.some((message) => message.includes('large non-constraint indexes show zero scans'))).toBe(false)
  })

  it('only flags non-constraint indexes with enough observation window', () => {
    const candidate: IndexStats = {
      tableName: 'public.repairs',
      indexName: 'repairs_status_created_at_idx',
      sizeBytes: 8 * 1024 * 1024,
      scans: 0,
      reads: 0,
      isUnused: true,
      isPrimary: false,
      isUnique: false,
      isConstraintBacked: false,
      statsResetAt: '2026-01-01T00:00:00.000Z',
    }
    const primaryKey: IndexStats = {
      ...candidate,
      indexName: 'repairs_pkey',
      isPrimary: true,
    }
    const smallIndex: IndexStats = {
      ...candidate,
      indexName: 'repairs_small_idx',
      sizeBytes: 64 * 1024,
    }

    expect(isUnusedIndexReviewCandidate(candidate, new Date('2026-02-01T00:00:00.000Z'))).toBe(true)
    expect(isUnusedIndexReviewCandidate(primaryKey, new Date('2026-02-01T00:00:00.000Z'))).toBe(false)
    expect(isUnusedIndexReviewCandidate(smallIndex, new Date('2026-02-01T00:00:00.000Z'))).toBe(false)
  })
})
