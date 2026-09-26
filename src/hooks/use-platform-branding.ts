'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_PLATFORM_BRANDING,
  type PlatformBranding,
  normalizePlatformBranding,
} from '@/lib/platform/branding'

export function usePlatformBranding(initialBranding?: PlatformBranding) {
  const [branding, setBranding] = useState<PlatformBranding>(initialBranding ?? DEFAULT_PLATFORM_BRANDING)

  useEffect(() => {
    let cancelled = false

    async function loadBranding() {
      try {
        const response = await fetch('/api/public/platform-branding', { cache: 'no-store' })
        const payload = await response.json().catch(() => null) as { branding?: unknown } | null
        if (!cancelled && response.ok && payload?.branding) {
          setBranding(normalizePlatformBranding(payload.branding))
        }
      } catch {
        // Keep the server-provided identity (or neutral placeholder) when offline.
      }
    }

    loadBranding()

    return () => {
      cancelled = true
    }
  }, [])

  return { branding }
}
