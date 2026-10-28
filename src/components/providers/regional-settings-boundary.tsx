'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { setRegionalFormatConfig } from '@/lib/currency'

interface SharedSettingsResponse {
  success?: boolean
  data?: {
    currency?: string | null
    language?: string | null
    locale?: string | null
    country_code?: string | null
  }
}

export function RegionalSettingsBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [revision, setRevision] = useState(0)
  const userId = user?.id ?? null

  useEffect(() => {
    if (loading) return
    if (!userId) {
      setRegionalFormatConfig({ currency: null, language: null, locale: null, countryCode: null })
      return
    }

    let activeRequest: AbortController | null = null

    async function synchronize() {
      activeRequest?.abort()
      activeRequest = new AbortController()
      const request = activeRequest
      setRegionalFormatConfig({ currency: null, language: null, locale: null, countryCode: null })
      try {
        const response = await fetch('/api/settings/shared', {
          cache: 'no-store',
          signal: request.signal,
        })
        const payload = await response.json().catch(() => ({})) as SharedSettingsResponse
        if (request.signal.aborted || !response.ok || !payload.success || !payload.data) return

        setRegionalFormatConfig({
          currency: payload.data.currency,
          language: payload.data.language,
          locale: payload.data.locale,
          countryCode: payload.data.country_code,
        })

        // Existing formatCurrency() consumers read the shared runtime config.
        // One remount applies it to screens that do not subscribe to settings.
        setRevision((current) => current + 1)
      } catch (error) {
        if (!request.signal.aborted) console.error('Failed to synchronize regional settings', error)
      }
    }

    void synchronize()
    window.addEventListener('organization:changed', synchronize)
    return () => {
      activeRequest?.abort()
      window.removeEventListener('organization:changed', synchronize)
    }
  }, [loading, userId])

  return <Fragment key={`${userId ?? 'guest'}:${revision}`}>{children}</Fragment>
}
