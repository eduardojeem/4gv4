/**
 * useOfflineMode Hook
 * 
 * Hook para gestionar el modo offline del POS
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { offlineManager, type OfflineStats, type SyncResult } from '../lib/offline-manager'

export interface UseOfflineModeReturn {
  // State
  isOnline: boolean
  isInitialized: boolean
  stats: OfflineStats | null
  isSyncing: boolean
  lastSyncResult: SyncResult | null

  // Actions
  initialize: () => Promise<void>
  syncNow: () => Promise<SyncResult>
  clearCache: () => Promise<void>
  refreshStats: () => Promise<void>
}

export function useOfflineMode(): UseOfflineModeReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [stats, setStats] = useState<OfflineStats | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  /**
   * Initialize offline manager
   */
  const initialize = useCallback(async () => {
    try {
      await offlineManager.initialize()
      setIsInitialized(true)

      // Get initial stats
      const initialStats = await offlineManager.getStats()
      setStats(initialStats)
      setIsOnline(initialStats.isOnline)
    } catch (error) {
      console.error('Failed to initialize offline mode:', error)
      throw error
    }
  }, [])

  /**
   * Sync pending sales now
   */
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true)

    try {
      const result = await offlineManager.syncPendingSales()
      setLastSyncResult(result)

      // Refresh stats after sync
      const newStats = await offlineManager.getStats()
      setStats(newStats)

      return result
    } catch (error) {
      console.error('Sync failed:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [])

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(async () => {
    await offlineManager.clearAll()

    // Refresh stats
    const newStats = await offlineManager.getStats()
    setStats(newStats)
  }, [])

  /**
   * Refresh statistics
   */
  const refreshStats = useCallback(async () => {
    const newStats = await offlineManager.getStats()
    setStats(newStats)
  }, [])

  /**
   * Setup connectivity listener
   */
  useEffect(() => {
    if (!isInitialized) return

    const unsubscribe = offlineManager.addConnectivityListener((online) => {
      setIsOnline(online)

      // Refresh stats when connectivity changes
      refreshStats()
    })

    return unsubscribe
  }, [isInitialized, refreshStats])

  /**
   * Periodic stats refresh
   */
  useEffect(() => {
    if (!isInitialized) return

    const interval = setInterval(() => {
      refreshStats()
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [isInitialized, refreshStats])

  return {
    isOnline,
    isInitialized,
    stats,
    isSyncing,
    lastSyncResult,
    initialize,
    syncNow,
    clearCache,
    refreshStats,
  }
}
