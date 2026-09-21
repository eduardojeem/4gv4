'use client'

import { useState, useEffect, useCallback } from 'react'

export const MAX_WEBSITE_MEDIA_LIMIT = 20

export function useWebsiteMediaQuota() {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/website/media')
      const data = await res.json()
      if (res.ok && data.success) {
        setCount(data.count ?? 0)
      }
    } catch {
      // Ignore network errors on passive quota check
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuota()

    const handleUpdate = () => {
      fetchQuota()
    }

    window.addEventListener('website-media-updated', handleUpdate)
    return () => {
      window.removeEventListener('website-media-updated', handleUpdate)
    }
  }, [fetchQuota])

  const isAtLimit = count >= MAX_WEBSITE_MEDIA_LIMIT
  const isNearLimit = count >= 16 && !isAtLimit

  return {
    count,
    limit: MAX_WEBSITE_MEDIA_LIMIT,
    isAtLimit,
    isNearLimit,
    isLoading,
    refresh: fetchQuota,
  }
}
