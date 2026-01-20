'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SessionInfo {
  userAgent: string
  deviceType: 'mobile' | 'tablet' | 'desktop'
  browser: string
  os: string
  country?: string
  city?: string
}

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
    // Use ipapi.co for free IP geolocation (no API key required)
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch geolocation')
    }

    const data = await response.json()
    return {
      country: data.country_name || undefined,
      city: data.city || undefined
    }
  } catch (error) {
    console.warn('Could not fetch geolocation:', error)
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
  const supabase = createClient()

  const registerSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('⚠️ No session found, skipping registration')
        return
      }

      console.log('📝 Registering session for user:', session.user.id)

      const sessionInfo = await getSessionInfo()
      console.log('🌍 Session info:', sessionInfo)

      // Registrar o actualizar la sesión en la base de datos
      const sessionData = {
        user_id: session.user.id,
        session_id: session.access_token.substring(0, 50), // Usar parte del token como ID único
        user_agent: sessionInfo.userAgent,
        device_type: sessionInfo.deviceType,
        browser: sessionInfo.browser,
        os: sessionInfo.os,
        country: sessionInfo.country,
        city: sessionInfo.city,
        is_active: true,
        last_activity: new Date().toISOString()
      }

      console.log('💾 Attempting to save session:', sessionData)

      const { error } = await supabase
        .from('user_sessions')
        .upsert(sessionData, {
          onConflict: 'session_id'
        })

      if (error) {
        console.error('❌ Error registering session:', error)
      } else {
        console.log('✅ Session registered successfully!')
      }
    } catch (error) {
      console.error('Error in registerSession:', error)
    }
  }, [supabase])

  const updateSessionActivity = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const sessionId = session.access_token.substring(0, 50)

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
      return data as boolean
    } catch (error) {
      console.error('Error closing session:', error)
      return false
    }
  }, [supabase])

  const closeAllOtherSessions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return 0

      const currentSessionId = session.access_token.substring(0, 50)

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

  // Registrar sesión al montar el componente
  useEffect(() => {
    registerSession()
  }, [registerSession])

  // Actualizar actividad cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      updateSessionActivity()
    }, 5 * 60 * 1000) // 5 minutos

    return () => clearInterval(interval)
  }, [updateSessionActivity])

  // Actualizar actividad en eventos de usuario
  useEffect(() => {
    const handleActivity = () => {
      updateSessionActivity()
    }

    // Eventos que indican actividad del usuario
    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('mousemove', handleActivity)

    // Throttle para no actualizar demasiado frecuentemente
    let lastUpdate = Date.now()
    const throttledActivity = () => {
      const now = Date.now()
      if (now - lastUpdate > 60000) { // 1 minuto
        handleActivity()
        lastUpdate = now
      }
    }

    window.addEventListener('click', throttledActivity)

    return () => {
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('click', throttledActivity)
    }
  }, [updateSessionActivity])

  // Cerrar sesión al cerrar la ventana/pestaña
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const sessionId = session.access_token.substring(0, 50)

      // Usar sendBeacon para enviar la petición de forma asíncrona
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
