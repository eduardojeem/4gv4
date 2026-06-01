import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { WebsiteSettings } from '@/types/website-settings'
import { createSupabaseClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'

type FetchError = Error & { status?: number }
type RealtimeClient = ReturnType<typeof createSupabaseClient>
type RealtimeChannel = ReturnType<RealtimeClient['channel']>

let publicRealtimeRefCount = 0
let publicRealtimeSupabase: RealtimeClient | null = null
let publicRealtimeChannel: RealtimeChannel | null = null

let adminRealtimeRefCount = 0
let adminRealtimeSupabase: RealtimeClient | null = null
let adminRealtimeChannel: RealtimeChannel | null = null

const WEBSITE_SETTINGS_CACHE_KEY = '/api/public/website/settings'
const ADMIN_WEBSITE_SETTINGS_CACHE_KEY = '/api/admin/website/settings'

function ensurePublicWebsiteSettingsRealtime() {
  if (publicRealtimeChannel) return

  if (!publicRealtimeSupabase) {
    publicRealtimeSupabase = createSupabaseClient()
  }

  publicRealtimeChannel = publicRealtimeSupabase
    .channel('realtime:website_settings_public')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'website_settings'
      },
      async () => {
        await mutate(WEBSITE_SETTINGS_CACHE_KEY)
      }
    )
    .subscribe()
}

function releasePublicWebsiteSettingsRealtime() {
  if (!publicRealtimeSupabase || !publicRealtimeChannel) return

  publicRealtimeSupabase.removeChannel(publicRealtimeChannel)
  publicRealtimeChannel = null
}

function ensureAdminWebsiteSettingsRealtime() {
  if (adminRealtimeChannel) return

  if (!adminRealtimeSupabase) {
    adminRealtimeSupabase = createSupabaseClient()
  }

  adminRealtimeChannel = adminRealtimeSupabase
    .channel('realtime:website_settings_admin')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'website_settings'
      },
      async () => {
        await mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY)
      }
    )
    .subscribe()
}

function releaseAdminWebsiteSettingsRealtime() {
  if (!adminRealtimeSupabase || !adminRealtimeChannel) return

  adminRealtimeSupabase.removeChannel(adminRealtimeChannel)
  adminRealtimeChannel = null
}

export function useWebsiteSettings() {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantSlug =
    pathSegments.length > 1 && ['inicio', 'productos', 'mis-reparaciones', 'track', 'carrito', 'cliente', 'perfil'].includes(pathSegments[1])
      ? pathSegments[0]
      : ''
  const cacheKey = tenantSlug ? `${WEBSITE_SETTINGS_CACHE_KEY}?org=${encodeURIComponent(tenantSlug)}` : WEBSITE_SETTINGS_CACHE_KEY

  const fetcher = useMemo(() => async () => {
    const res = await fetch(cacheKey)
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const statusText = res.statusText || 'Error'
      const message = errBody?.error || statusText
      const err: FetchError = new Error(message)
      err.status = res.status
      throw err
    }
    const data = await res.json()
    return data.data as WebsiteSettings
  }, [cacheKey])

  const { data, error, isLoading } = useSWR<WebsiteSettings>(cacheKey, fetcher)

  // Share a single realtime subscription across all consumers of this hook.
  useEffect(() => {
    publicRealtimeRefCount += 1
    try {
      ensurePublicWebsiteSettingsRealtime()
    } catch {
      // Supabase not configured; skip realtime
    }

    return () => {
      publicRealtimeRefCount = Math.max(0, publicRealtimeRefCount - 1)
      if (publicRealtimeRefCount === 0) {
        releasePublicWebsiteSettingsRealtime()
      }
    }
  }, [])

  return { settings: data ?? null, isLoading, error: error ? (error as Error).message : null }
}

export function useAdminWebsiteSettings() {
  const [isSaving, setIsSaving] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  const fetcher = useMemo(() => async () => {
    const adminRes = await fetch(ADMIN_WEBSITE_SETTINGS_CACHE_KEY)
    if (adminRes.ok) {
      const adminData = await adminRes.json()
      return adminData.data as WebsiteSettings
    }

    const errBody = await adminRes.json().catch(() => ({}))
    const statusText = adminRes.statusText || 'Error'
    const message = errBody?.error || statusText
    const err: FetchError = new Error(message)
    err.status = adminRes.status
    throw err
  }, [])

  const { data, error, isLoading } = useSWR<WebsiteSettings>(ADMIN_WEBSITE_SETTINGS_CACHE_KEY, fetcher)

  // Optimistic update helper
  const updateSetting = async <K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) => {
    const previous = data

    try {
      setIsSaving(true)

      // Optimistically update cache
      await mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY, (current?: WebsiteSettings) => {
        if (!current) return current ?? null
        return { ...current, [key]: value } as WebsiteSettings
      }, false)

      const res = await fetch(`${ADMIN_WEBSITE_SETTINGS_CACHE_KEY}/${key}`, {
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
      await mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY)
      return { success: true }
    } catch (err) {
      // Rollback on error
      if (previous) await mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY, previous, false)
      const message = err instanceof Error ? err.message : 'Failed to update setting'
      return { success: false, error: message }
    } finally {
      setIsSaving(false)
    }
  }

  const initializeMissingSettings = async () => {
    try {
      setIsInitializing(true)

      const res = await fetch('/api/admin/website/settings', {
        method: 'POST'
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        const message = body?.error || res.statusText || 'Failed to initialize settings'
        throw new Error(message)
      }

      await mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY)
      return {
        success: true,
        insertedCount: Number(body?.insertedCount || 0),
        insertedKeys: Array.isArray(body?.insertedKeys) ? body.insertedKeys : []
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize settings'
      return { success: false, error: message, insertedCount: 0, insertedKeys: [] as string[] }
    } finally {
      setIsInitializing(false)
    }
  }

  // Realtime subscription: reflect changes done by other admins
  useEffect(() => {
    adminRealtimeRefCount += 1
    try {
      ensureAdminWebsiteSettingsRealtime()
    } catch {
      // Supabase not configured; skip realtime
      adminRealtimeRefCount = Math.max(0, adminRealtimeRefCount - 1)
      return
    }

    return () => {
      adminRealtimeRefCount = Math.max(0, adminRealtimeRefCount - 1)
      if (adminRealtimeRefCount === 0) {
        releaseAdminWebsiteSettingsRealtime()
      }
    }
  }, [])

  return {
    settings: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    isSaving,
    isInitializing,
    updateSetting,
    initializeMissingSettings,
    refetch: () => mutate(ADMIN_WEBSITE_SETTINGS_CACHE_KEY)
  }
}
