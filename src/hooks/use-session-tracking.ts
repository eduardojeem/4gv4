'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionIdFromAccessToken } from '@/lib/session-id'

interface SessionInfo {
  userAgent: string
  deviceType: 'mobile' | 'tablet' | 'desktop'
  browser: string
  os: string
  country?: string
  city?: string
}

const REGISTERED_SESSION_STORAGE_KEY = 'dashboard-registered-session-id'
const activeSessionRegistrations = new Set<string>()

const detectDeviceType = (userAgent: string): 'mobile' | 'tablet' | 'desktop' => {
  if (/mobile/i.test(userAgent)) return 'mobile'
  if (/tablet|ipad/i.test(userAgent)) return 'tablet'
  return 'desktop'
}

const detectBrowser = (userAgent: string): string => {
  if (/edg/i.test(userAgent)) return 'Edge'
  if (/chrome/i.test(userAgent)) return 'Chrome'
  if (/firefox/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent)) return 'Safari'
  if (/opera|opr/i.test(userAgent)) return 'Opera'
  return 'Unknown'
}

const detectOS = (userAgent: string): string => {
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/mac/i.test(userAgent)) return 'macOS'
  if (/linux/i.test(userAgent)) return 'Linux'
  if (/android/i.test(userAgent)) return 'Android'
  if (/ios|iphone|ipad/i.test(userAgent)) return 'iOS'
  return 'Unknown'
}

const getGeolocation = async (): Promise<{ country?: string; city?: string }> => {
  try {
    const response = await fetch('/api/geoip', {
      signal: AbortSignal.timeout(4000),
    })

    if (!response.ok) return {}

    const data = await response.json() as { country?: string | null; city?: string | null }
    return {
      country: data.country ?? undefined,
      city: data.city ?? undefined,
    }
  } catch {
    return {}
  }
}

const getSessionInfo = async (): Promise<SessionInfo> => {
  const userAgent = navigator.userAgent
  const location = await getGeolocation()

  return {
    userAgent,
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
    country: location.country,
    city: location.city
  }
}

export function useSessionTracking() {
  const supabase = useMemo(() => createClient(), [])
  const lastActivityRef = useRef(0)

  const registerSession = useCallback(async () => {
    let sessionId: string | null = null

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const sessionInfo = await getSessionInfo()
      sessionId = await getSessionIdFromAccessToken(session.access_token)
      if (!sessionId) return

      if (typeof window !== 'undefined' && sessionStorage.getItem(REGISTERED_SESSION_STORAGE_KEY) === sessionId) {
        return
      }

      if (activeSessionRegistrations.has(sessionId)) {
        return
      }

      activeSessionRegistrations.add(sessionId)

      const sessionData = {
        user_id: session.user.id,
        session_id: sessionId,
        user_agent: sessionInfo.userAgent,
        device_type: sessionInfo.deviceType,
        browser: sessionInfo.browser,
        os: sessionInfo.os,
        country: sessionInfo.country,
        city: sessionInfo.city,
        is_active: true,
        last_activity: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_sessions')
        .upsert(sessionData, {
          onConflict: 'session_id'
        })

      if (error) {
        const message = error.message || JSON.stringify(error) || 'Unknown error'
        console.warn('Error registering session:', message)
        return
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(REGISTERED_SESSION_STORAGE_KEY, sessionId)
      }
    } catch (error) {
      console.error('Error in registerSession:', error)
    } finally {
      if (sessionId) {
        activeSessionRegistrations.delete(sessionId)
      }
    }
  }, [supabase])

  const updateSessionActivity = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const sessionId = await getSessionIdFromAccessToken(session.access_token)
      if (!sessionId) return

      await supabase
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('is_active', true)
    } catch (error) {
      console.error('Error updating session activity:', error)
    }
  }, [supabase])

  const closeSession = useCallback(async (sessionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const { data, error } = await supabase.rpc('close_user_session', {
        p_session_id: sessionId,
        p_user_id: session.user.id
      })

      if (error) throw error
      if (typeof data === 'object' && data !== null && 'success' in (data as Record<string, unknown>)) {
        return Boolean((data as Record<string, unknown>).success)
      }
      return Boolean(data)
    } catch (error) {
      console.error('Error closing session:', error)
      return false
    }
  }, [supabase])

  const closeAllOtherSessions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return 0

      const currentSessionId = await getSessionIdFromAccessToken(session.access_token)
      if (!currentSessionId) return 0

      const { data, error } = await supabase.rpc('close_all_user_sessions_except_current', {
        p_user_id: session.user.id,
        p_current_session_id: currentSessionId
      })

      if (error) throw error
      return data as number
    } catch (error) {
      console.error('Error closing all sessions:', error)
      return 0
    }
  }, [supabase])

  useEffect(() => {
    void registerSession()
  }, [registerSession])

  useEffect(() => {
    const interval = setInterval(() => {
      void updateSessionActivity()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [updateSessionActivity])

  useEffect(() => {
    const throttledActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current <= 60000) {
        return
      }

      lastActivityRef.current = now
      void updateSessionActivity()
    }

    const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'scroll', 'mousemove']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, throttledActivity, { passive: true }))

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, throttledActivity))
    }
  }, [updateSessionActivity])

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const sessionId = await getSessionIdFromAccessToken(session.access_token)
      if (!sessionId) return

      navigator.sendBeacon(
        '/api/close-session',
        JSON.stringify({ sessionId })
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [supabase])

  return {
    registerSession,
    updateSessionActivity,
    closeSession,
    closeAllOtherSessions
  }
}
