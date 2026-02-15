import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { WebsiteSettings } from '@/types/website-settings'
import { createSupabaseClient } from '@/lib/supabase/client'

export function useWebsiteSettings() {
  const fetcher = useMemo(() => async () => {
    const res = await fetch('/api/public/website/settings')
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const statusText = res.statusText || 'Error'
      const message = errBody?.error || statusText
      const err: any = new Error(message)
      err.status = res.status
      throw err
    }
    const data = await res.json()
    return data.data as WebsiteSettings
  }, [])

  const { data, error, isLoading } = useSWR<WebsiteSettings>('/api/public/website/settings', fetcher)

  // Realtime subscription to reflect public changes instantly
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseClient> | null = null
    try {
      supabase = createSupabaseClient()
    } catch {
      // Supabase not configured; skip realtime
      return
    }

    const channel = supabase
      .channel('realtime:website_settings_public')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'website_settings'
      }, async () => {
        // Revalidate on any change
        await mutate('/api/public/website/settings')
      })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  return { settings: data ?? null, isLoading, error: error ? (error as Error).message : null }
}

export function useAdminWebsiteSettings() {
  const [isSaving, setIsSaving] = useState(false)
  const fetcher = useMemo(() => async () => {
    // Intentar endpoint admin
    const adminRes = await fetch('/api/admin/website/settings')
    if (adminRes.ok) {
      const adminData = await adminRes.json()
      return adminData.data as WebsiteSettings
    }
    // Fallback: cargar datos públicos si falla admin (403/401/500)
    const publicRes = await fetch('/api/public/website/settings')
    if (publicRes.ok) {
      const publicData = await publicRes.json()
      return publicData.data as WebsiteSettings
    }
    const errBody = await adminRes.json().catch(() => ({}))
    const statusText = adminRes.statusText || 'Error'
    const message = errBody?.error || statusText
    const err: any = new Error(message)
    err.status = adminRes.status
    throw err
  }, [])

  const { data, error, isLoading } = useSWR<WebsiteSettings>('/api/admin/website/settings', fetcher)

  // Optimistic update helper
  const updateSetting = async (key: keyof WebsiteSettings, value: any) => {
    const cacheKey = '/api/admin/website/settings'
    const previous = data
    try {
      setIsSaving(true)
      // Optimistically update cache
      await mutate(cacheKey, (current?: WebsiteSettings) => {
        if (!current) return current ?? null
        return { ...current, [key]: value } as WebsiteSettings
      }, false)

      const res = await fetch(`/api/admin/website/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        const msg = body?.error || res.statusText || 'Failed to update setting'
        throw new Error(msg)
      }

      // Revalidate to ensure server truth
      await mutate(cacheKey)
      return { success: true }
    } catch (err) {
      // Rollback on error
      if (previous) await mutate(cacheKey, previous, false)
      const message = err instanceof Error ? err.message : 'Failed to update setting'
      return { success: false, error: message }
    } finally {
      setIsSaving(false)
    }
  }

  // Realtime subscription: reflect changes done by other admins
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseClient> | null = null
    try {
      supabase = createSupabaseClient()
    } catch {
      // Supabase not configured; skip realtime
      return
    }

    const channel = supabase
      .channel('realtime:website_settings_admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'website_settings'
      }, async () => {
        await mutate('/api/admin/website/settings')
      })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  return {
    settings: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    isSaving,
    updateSetting,
    refetch: () => mutate('/api/admin/website/settings')
  }
}
