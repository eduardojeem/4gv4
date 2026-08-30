'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ActiveOrganizationPayload } from '@/app/api/organization-context/route'

type ActiveOrganizationContextValue = {
  organization: ActiveOrganizationPayload | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | null>(null)

export function ActiveOrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<ActiveOrganizationPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/organization-context', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = await response.json().catch(() => null) as {
        activeOrganization?: ActiveOrganizationPayload
        error?: string
      } | null

      if (!response.ok || !payload?.activeOrganization) {
        if (response.status === 401 || response.status === 403) {
          setOrganization(null)
        }
        throw new Error(payload?.error || 'No se pudo cargar la organización activa')
      }

      setOrganization(payload.activeOrganization)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la organización activa')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const handleOrganizationChange = () => void refresh()
    window.addEventListener('organization:changed', handleOrganizationChange)
    return () => window.removeEventListener('organization:changed', handleOrganizationChange)
  }, [refresh])

  const value = useMemo(
    () => ({ organization, isLoading, error, refresh }),
    [organization, isLoading, error, refresh],
  )

  return (
    <ActiveOrganizationContext.Provider value={value}>
      {children}
    </ActiveOrganizationContext.Provider>
  )
}

export function useActiveOrganization() {
  const context = useContext(ActiveOrganizationContext)
  if (!context) {
    throw new Error('useActiveOrganization debe usarse dentro de ActiveOrganizationProvider')
  }
  return context
}
