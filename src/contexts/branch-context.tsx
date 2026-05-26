'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAppState } from '@/contexts/app-state-context'
import type { BranchRecord } from '@/lib/branches/types'

const ACTIVE_BRANCH_CACHE_KEY = 'active_branch_id'

interface BranchContextValue {
  branches: BranchRecord[]
  selectedBranchId: string | null
  selectedBranch: BranchRecord | null
  loading: boolean
  setSelectedBranchId: (branchId: string | null) => void
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | null>(null)

function normalizeCachedBranchId(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { state, dispatch } = useAppState()
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    normalizeCachedBranchId(state.cache[ACTIVE_BRANCH_CACHE_KEY])
  )
  const [loading, setLoading] = useState(false)
  const hasFetchedRef = useRef(false)

  // Extract the cached value to use as a stable dependency
  const cachedBranchId = normalizeCachedBranchId(state.cache[ACTIVE_BRANCH_CACHE_KEY])

  const setSelectedBranchId = useCallback((branchId: string | null) => {
    setSelectedBranchIdState(branchId)
    dispatch({
      type: 'SET_CACHE',
      key: ACTIVE_BRANCH_CACHE_KEY,
      value: branchId,
    })
  }, [dispatch])

  const refreshBranches = useCallback(async () => {
    if (!user?.id) {
      setBranches([])
      setSelectedBranchIdState(null)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/branches', { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { branches?: BranchRecord[]; error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las sucursales')
      }

      const branchRows = (payload?.branches ?? []).filter((branch) => branch.is_active) as BranchRecord[]
      setBranches(branchRows)

      const currentBranchId = selectedBranchId ?? cachedBranchId
      const hasCurrentBranch = currentBranchId
        ? branchRows.some((branch) => branch.id === currentBranchId)
        : false

      if (hasCurrentBranch) {
        if (currentBranchId !== selectedBranchId) {
          setSelectedBranchIdState(currentBranchId)
        }
        return
      }

      const preferredBranch = branchRows.find((branch) => branch.is_default) ?? branchRows[0] ?? null
      setSelectedBranchId(preferredBranch?.id ?? null)
    } catch (error) {
      console.error('[branch-context] Error loading branches:', error)
      setBranches([])
      setSelectedBranchIdState(null)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, setSelectedBranchId, cachedBranchId, user?.id])

  // Sync from cache only on mount or when the specific cached value changes
  useEffect(() => {
    if (cachedBranchId !== selectedBranchId) {
      setSelectedBranchIdState(cachedBranchId)
    }
  }, [cachedBranchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch branches once when user is available
  useEffect(() => {
    if (user?.id && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      void refreshBranches()
    }
    if (!user?.id) {
      hasFetchedRef.current = false
    }
  }, [user?.id, refreshBranches])

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  )

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    selectedBranchId,
    selectedBranch,
    loading,
    setSelectedBranchId,
    refreshBranches,
  }), [branches, loading, refreshBranches, selectedBranch, selectedBranchId, setSelectedBranchId])

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) {
    throw new Error('useBranch debe usarse dentro de BranchProvider')
  }

  return context
}
