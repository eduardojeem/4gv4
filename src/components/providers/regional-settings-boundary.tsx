'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { isSupportedCurrency, setRegionalFormatConfig } from '@/lib/currency'

interface SharedSettingsResponse {
  success?: boolean
  data?: {
    currency?: string
    language?: string
  }
}

export function RegionalSettingsBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (loading || !user) return

    const controller = new AbortController()

    async function synchronize() {
      try {
        const response = await fetch('/api/settings/shared', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({})) as SharedSettingsResponse
        if (!response.ok || !payload.success || !payload.data) return

        const currency = payload.data.currency
        const language = payload.data.language
        setRegionalFormatConfig({ currency, language })

        // Existing formatCurrency() consumers read the shared runtime config.
        // One remount applies it to screens that do not subscribe to settings.
        if (currency && isSupportedCurrency(currency)) setRevision((current) => current + 1)
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to synchronize regional settings', error)
      }
    }

    void synchronize()
    return () => controller.abort()
  }, [loading, user])

  return <Fragment key={`${user?.id ?? 'guest'}:${revision}`}>{children}</Fragment>
}
