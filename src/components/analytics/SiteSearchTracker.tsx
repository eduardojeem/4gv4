'use client'

import { useEffect } from 'react'
import { trackSiteSearch } from '@/lib/site-analytics/client'

// Espera a que el usuario deje de escribir: la URL cambia con cada tecla.
const SETTLE_MS = 1500

export function SiteSearchTracker({ term, resultsCount }: { term: string; resultsCount: number }) {
  useEffect(() => {
    if (!term.trim()) return
    const timer = setTimeout(() => trackSiteSearch(term, resultsCount), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [term, resultsCount])

  return null
}
