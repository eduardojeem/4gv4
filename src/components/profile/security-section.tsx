'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Shield,
  ShieldCheck,
  Key,
  Smartphone,
  Monitor,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Trash2,
  RefreshCw,
  Bell,
  Mail,
  Laptop,
  Check,
  Sparkles,
  Globe,
  Compass,
  Filter,
  Info,
} from 'lucide-react'
import { ChangePasswordDialog } from './change-password-dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { getSessionIdFromAccessToken, isSessionRegistered, markSessionRegistered } from '@/lib/session-id'

interface SessionRecord {
  id: string
  session_id: string
  user_agent: string
  ip_address: string
  device_type: string
  browser: string
  os: string
  created_at: string
  last_activity: string
  is_active: boolean
  is_current?: boolean
  country?: string
  city?: string
}

interface SecuritySectionProps {
  userId: string | null
  role: string | null
}

function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Chrome'
  if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'
  else if (ua.includes('Brave')) browser = 'Brave'
  else if (ua.includes('Chrome/')) browser = 'Chrome'

  let os = 'Windows'
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux')) os = 'Linux'

  let deviceType = 'desktop'
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = 'mobile'
  else if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet'

  return { browser, os, deviceType }
}

export function SecuritySection({ userId, role }: SecuritySectionProps) {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [sessionView, setSessionView] = useState<'all' | 'current' | 'others'>('all')
  const [selectedBrowser, setSelectedBrowser] = useState<string>('all')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [closingBrowser, setClosingBrowser] = useState<string | null>(null)
  const [closingOthers, setClosingOthers] = useState(false)
  const [closingEverywhere, setClosingEverywhere] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)

  const getEffectiveUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? userId
  }, [supabase, userId])

  const loadSessions = useCallback(async () => {
    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      setLoadingSessions(true)
      setSessionsError(null)

      logger.session('Loading sessions for user', { userId: effectiveUserId })

      let rows: Array<Record<string, unknown>> = []
      let loadError: unknown = null

      const authSessionResult = await supabase.auth.getSession()
      const currentToken = authSessionResult.data.session?.access_token
      const currentSessionId = await getSessionIdFromAccessToken(currentToken)

      // 1. Intentar consulta RPC optimizada get_user_active_sessions
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_active_sessions', {
          p_user_id: effectiveUserId,
        })

        if (!rpcError && Array.isArray(rpcData)) {
          rows = rpcData
        } else if (rpcError) {
          loadError = rpcError
          console.warn('RPC get_user_active_sessions no disponible o con error, intentando consulta directa:', rpcError.message || rpcError)
        }
      } catch (err) {
        loadError = err
        console.warn('Excepción al ejecutar get_user_active_sessions RPC:', err)
      }

      // 2. Si el RPC falló o no devolvió filas, consultar la tabla user_sessions directamente
      if (rows.length === 0) {
        try {
          const { data: tableData, error: tableError } = await supabase
            .from('user_sessions')
            .select('*')
            .eq('user_id', effectiveUserId)
            .eq('is_active', true)
            .order('last_activity', { ascending: false })

          if (!tableError && Array.isArray(tableData)) {
            rows = tableData
            loadError = null
          } else if (tableError) {
            loadError = tableError
          }
        } catch (tableErr) {
          loadError = tableErr
        }
      }

      if (loadError && rows.length === 0) {
        setSessionsError('No se pudieron cargar las sesiones activas en este momento')
        setSessions([])
        return
      }

      let mapped: SessionRecord[] = rows.map((row) => ({
        id: String(row.id || ''),
        session_id: String(row.session_id || ''),
        user_agent: String(row.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')),
        ip_address: String(row.ip_address || 'IP no disponible'),
        device_type: String(row.device_type || 'desktop'),
        browser: String(row.browser || 'Navegador desconocido'),
        os: String(row.os || 'Sistema desconocido'),
        created_at: String(row.created_at || ''),
        last_activity: String(row.last_activity || ''),
        is_active: Boolean(row.is_active),
        country: row.country ? String(row.country) : undefined,
        city: row.city ? String(row.city) : undefined,
        is_current: Boolean(currentSessionId && row.session_id === currentSessionId),
      }))

      // Asegurar que si la sesión actual no está explícitamente en la base de datos, se detecta y muestra
      const hasCurrent = mapped.some((s) => s.is_current)
      if (!hasCurrent && typeof navigator !== 'undefined') {
        const clientInfo = parseUserAgent(navigator.userAgent)
        const currentSyntheticSession: SessionRecord = {
          id: currentSessionId ? `curr-${currentSessionId.slice(0, 12)}` : 'current-device',
          session_id: currentSessionId || 'local-current-session',
          user_agent: navigator.userAgent,
          ip_address: 'Este equipo (conexión actual)',
          device_type: clientInfo.deviceType,
          browser: clientInfo.browser,
          os: clientInfo.os,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          is_active: true,
          is_current: true,
          city: 'Sesión local',
          country: 'Activa ahora',
        }

        // Registrar en segundo plano en user_sessions si aún no ha sido registrada
        if (effectiveUserId && currentSessionId && !isSessionRegistered(currentSessionId)) {
          void Promise.resolve(
            supabase
              .from('user_sessions')
              .upsert({
                user_id: effectiveUserId,
                session_id: currentSessionId,
                user_agent: navigator.userAgent,
                device_type: clientInfo.deviceType,
                browser: clientInfo.browser,
                os: clientInfo.os,
                ip_address: 'Conexión activa',
                is_active: true,
                last_activity: new Date().toISOString(),
              }, { onConflict: 'session_id' })
          )
            .then(() => markSessionRegistered(currentSessionId))
            .catch((err: unknown) => console.warn('No se pudo persistir la sesión actual:', err))
        }

        mapped = [currentSyntheticSession, ...mapped.filter((s) => s.session_id !== currentSessionId)]
      }

      setSessions(mapped)
      setLastSyncAt(new Date())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Error recuperando sesiones de usuario:', message)
      setSessionsError('No se pudieron cargar las sesiones activas en este momento')
    } finally {
      setLoadingSessions(false)
    }
  }, [getEffectiveUserId, supabase])

  const loadSecuritySettings = useCallback(async () => {
    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setTwoFactorEnabled(Boolean(data.two_factor_enabled))
        setEmailNotifications(Boolean(data.email_notifications ?? true))
        setLoginAlerts(Boolean(data.login_alerts ?? true))
      }
    } catch (error) {
      logger.error('Error loading security settings', { error })
    }
  }, [getEffectiveUserId, supabase])

  useEffect(() => {
    loadSessions()
    loadSecuritySettings()
  }, [loadSessions, loadSecuritySettings])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadSessions()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadSessions])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !closingEverywhere &&
        !closingOthers
      ) {
        loadSessions()
      }
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [closingEverywhere, closingOthers, loadSessions])

  const saveSecuritySettings = async (settings: Partial<{
    two_factor_enabled: boolean
    email_notifications: boolean
    login_alerts: boolean
  }>) => {
    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return false

    try {
      setSavingSettings(true)
      const { error } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: effectiveUserId,
          ...settings,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      toast.success('Configuración de seguridad guardada')
      return true
    } catch (error) {
      logger.error('Error saving security settings', { error })
      toast.error('No se pudo guardar la configuración de seguridad')
      return false
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSecuritySettingChange = async (
    setting: 'email_notifications' | 'login_alerts',
    checked: boolean,
  ) => {
    const saved = await saveSecuritySettings({ [setting]: checked })
    if (!saved) return

    if (setting === 'email_notifications') setEmailNotifications(checked)
    if (setting === 'login_alerts') setLoginAlerts(checked)
  }

  // 1. Cerrar una sesión individual específica
  const handleLogoutSession = async (session: SessionRecord) => {
    if (session.is_current) {
      toast.info('Para salir de esta sesión actual, utiliza la opción de Cerrar sesión del menú principal.')
      return
    }

    if (!window.confirm(`¿Deseas cerrar la sesión remota en ${session.browser} (${session.os})?`)) {
      return
    }

    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      setRevokingSessionId(session.id)

      // Intentar RPC close_user_session
      try {
        await supabase.rpc('close_user_session', {
          p_session_id: session.session_id,
          p_user_id: effectiveUserId,
        })
      } catch (rpcErr) {
        console.warn('RPC close_user_session no disponible:', rpcErr)
      }

      // Actualizar tabla directamente
      try {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, last_activity: new Date().toISOString() })
          .eq('user_id', effectiveUserId)
          .or(`id.eq.${session.id},session_id.eq.${session.session_id}`)
      } catch {
        // Fallback ignorado si la tabla no está disponible
      }

      // Actualización optimista de estado local
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      toast.success(`Sesión en ${session.browser} cerrada correctamente`)
    } catch (error) {
      logger.error('Error closing session', { error })
      toast.error('Error al revocar la sesión remota')
    } finally {
      setRevokingSessionId(null)
    }
  }

  // 2. Cerrar sesiones de un navegador específico
  const handleLogoutBrowser = async (browserName: string) => {
    const browserSessions = sessions.filter((s) => (s.browser || 'Desconocido') === browserName)
    const remoteSessions = browserSessions.filter((s) => !s.is_current)

    if (remoteSessions.length === 0) {
      toast.info(`Solo este dispositivo está conectado en ${browserName}. Para salir, utiliza la opción de Cerrar sesión del menú.`)
      return
    }

    if (!window.confirm(`¿Deseas revocar las ${remoteSessions.length} sesiones remotas activas en ${browserName}?`)) {
      return
    }

    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      setClosingBrowser(browserName)

      for (const s of remoteSessions) {
        try {
          await supabase.rpc('close_user_session', {
            p_session_id: s.session_id,
            p_user_id: effectiveUserId,
          })
        } catch {}
      }

      try {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, last_activity: new Date().toISOString() })
          .eq('user_id', effectiveUserId)
          .eq('browser', browserName)
          .neq('is_current', true)
      } catch {}

      setSessions((prev) => prev.filter((s) => s.is_current || (s.browser || 'Desconocido') !== browserName))
      toast.success(`Se revocaron las sesiones remotas de ${browserName}`)
    } catch (error) {
      logger.error('Error closing browser sessions', { error })
      toast.error(`Error al cerrar sesiones en ${browserName}`)
    } finally {
      setClosingBrowser(null)
    }
  }

  // 3. Cerrar sesiones en otros navegadores diferentes al actual
  const handleLogoutOtherBrowsers = async () => {
    const currentBrowser = sessions.find((s) => s.is_current)?.browser
    const otherBrowserSessions = sessions.filter((s) => !s.is_current && (!currentBrowser || s.browser !== currentBrowser))

    if (otherBrowserSessions.length === 0) {
      toast.info('No hay sesiones activas en otros navegadores distintos al actual.')
      return
    }

    if (!window.confirm(`¿Deseas cerrar las ${otherBrowserSessions.length} sesiones activas en otros navegadores?`)) {
      return
    }

    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      setClosingOthers(true)

      for (const s of otherBrowserSessions) {
        try {
          await supabase.rpc('close_user_session', {
            p_session_id: s.session_id,
            p_user_id: effectiveUserId,
          })
        } catch {}
      }

      try {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, last_activity: new Date().toISOString() })
          .eq('user_id', effectiveUserId)
          .neq('browser', currentBrowser || '')
      } catch {}

      setSessions((prev) => prev.filter((s) => s.is_current || s.browser === currentBrowser))
      toast.success('Se cerraron las sesiones en otros navegadores')
    } catch (error) {
      logger.error('Error closing other browsers', { error })
      toast.error('Error al cerrar sesiones en otros navegadores')
    } finally {
      setClosingOthers(false)
    }
  }

  // 4. Cerrar todas las otras sesiones (mantener sólo este dispositivo)
  const handleLogoutAllSessions = async () => {
    if (!window.confirm('¿Deseas cerrar todas las otras sesiones activas y mantener solo este dispositivo?')) return

    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    try {
      setClosingOthers(true)

      // Revocar mediante Supabase Auth
      try {
        await supabase.auth.signOut({ scope: 'others' })
      } catch (authErr) {
        console.warn('Error en supabase.auth.signOut others:', authErr)
      }

      // Sincronizar en base de datos mediante RPC
      const authSessionResult = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(authSessionResult.data.session?.access_token)

      if (currentSessionId) {
        try {
          await supabase.rpc('close_all_user_sessions_except_current', {
            p_user_id: effectiveUserId,
            p_current_session_id: currentSessionId,
          })
        } catch (rpcErr) {
          console.warn('Error en RPC close_all_user_sessions_except_current:', rpcErr)
        }

        try {
          await supabase
            .from('user_sessions')
            .update({ is_active: false, last_activity: new Date().toISOString() })
            .eq('user_id', effectiveUserId)
            .neq('session_id', currentSessionId)
        } catch {}
      }

      // Actualizar estado local inmediatamente
      setSessions((prev) => prev.filter((s) => s.is_current))
      toast.success('Las otras sesiones fueron revocadas. Este dispositivo sigue conectado.')
      await loadSessions()
    } catch (error) {
      logger.error('Error closing all other sessions', { error })
      toast.error('Error al cerrar las sesiones remotas')
    } finally {
      setClosingOthers(false)
    }
  }

  // 5. Cerrar todas las sesiones globalmente (incluida la actual)
  const handleLogoutEverywhere = async () => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar todas las sesiones, incluida esta? Tendrás que volver a iniciar sesión.')) return

    const effectiveUserId = await getEffectiveUserId()

    try {
      setClosingEverywhere(true)

      if (effectiveUserId) {
        try {
          await supabase
            .from('user_sessions')
            .update({ is_active: false, last_activity: new Date().toISOString() })
            .eq('user_id', effectiveUserId)
        } catch {}
      }

      await supabase.auth.signOut({ scope: 'global' })
      toast.success('Todas las sesiones fueron cerradas. Redirigiendo al login...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 800)
    } catch (error) {
      logger.error('Error closing all sessions', { error })
      toast.error('Error al cerrar todas las sesiones')
    } finally {
      setClosingEverywhere(false)
    }
  }

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.is_current) return -1
      if (b.is_current) return 1
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    })
  }, [sessions])

  const visibleSessions = useMemo(() => {
    let list = sortedSessions
    if (sessionView === 'current') list = list.filter((s) => s.is_current)
    if (sessionView === 'others') list = list.filter((s) => !s.is_current)
    if (selectedBrowser !== 'all') {
      list = list.filter((s) => (s.browser || 'Desconocido') === selectedBrowser)
    }
    return list
  }, [sortedSessions, sessionView, selectedBrowser])

  const stats = useMemo(() => ({
    total: sessions.length,
    desktop: sessions.filter((s) => s.device_type === 'desktop').length,
    mobile: sessions.filter((s) => s.device_type === 'mobile').length,
    tablet: sessions.filter((s) => s.device_type === 'tablet').length,
  }), [sessions])

  const browserStats = useMemo(() => {
    const counter = sessions.reduce<Record<string, { count: number; hasCurrent: boolean }>>((acc, session) => {
      const key = session.browser || 'Desconocido'
      if (!acc[key]) {
        acc[key] = { count: 0, hasCurrent: false }
      }
      acc[key].count += 1
      if (session.is_current) {
        acc[key].hasCurrent = true
      }
      return acc
    }, {})

    return Object.entries(counter)
      .map(([browser, data]) => ({
        browser,
        count: data.count,
        hasCurrent: data.hasCurrent,
      }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const securityOverview = useMemo(() => {
    let score = 40
    if (emailNotifications) score += 20
    if (loginAlerts) score += 20
    if (twoFactorEnabled) score += 20
    if (stats.total <= 1) score += 20
    else if (stats.total <= 3) score += 10
    score = Math.min(100, score)

    const level = score >= 80 ? 'Protección Alta' : score >= 60 ? 'Protección Moderada' : 'Protección Básica'
    const variantColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
    const textColor = score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

    return {
      score,
      level,
      variantColor,
      textColor,
      hasMultipleSessions: stats.total > 1,
    }
  }, [emailNotifications, loginAlerts, twoFactorEnabled, stats.total])

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile') return Smartphone
    if (deviceType === 'tablet') return Smartphone
    return Laptop
  }

  const getDeviceLabel = (deviceType: string) => {
    if (deviceType === 'mobile') return 'Teléfono Móvil'
    if (deviceType === 'tablet') return 'Tablet'
    return 'Computadora'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'En línea ahora'
    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  }

  return (
    <div className="space-y-6">
      {/* ── 1. BANNER PRINCIPAL DE SEGURIDAD ── */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Seguridad de la Cuenta</CardTitle>
                <CardDescription>
                  Monitorea el estado de protección, credenciales y dispositivos autorizados en tiempo real.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-1 px-2.5 font-normal gap-1.5 bg-background/60">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>
                  {lastSyncAt ? `Sincronizado ${formatDate(lastSyncAt.toISOString())}` : 'Cargando...'}
                </span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSessions}
                className="h-8 px-2.5 text-xs gap-1.5"
                disabled={loadingSessions}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loadingSessions && 'animate-spin')} />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Métricas de Diagnóstico Ejecutivo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Card 1: Score */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nivel de protección</p>
                <Shield className={cn('h-4 w-4', securityOverview.textColor)} />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                  {securityOverview.score}%
                </span>
                <span className={cn('text-xs font-bold', securityOverview.textColor)}>
                  {securityOverview.level}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full transition-all duration-700 rounded-full', securityOverview.variantColor)}
                  style={{ width: `${securityOverview.score}%` }}
                />
              </div>
            </div>

            {/* Card 2: Sesiones */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sesiones activas</p>
                <Laptop className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2.5 text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {stats.total} <span className="text-sm font-normal text-muted-foreground">{stats.total === 1 ? 'dispositivo' : 'dispositivos'}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {securityOverview.hasMultipleSessions
                  ? `${browserStats.length} navegadores detectados simultáneamente`
                  : 'Solo este dispositivo tiene acceso activo'}
              </p>
            </div>

            {/* Card 3: Alertas */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas de acceso</p>
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2.5 text-2xl font-bold tracking-tight text-foreground">
                {loginAlerts && emailNotifications ? 'Monitoreo activo' : 'Configuración parcial'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loginAlerts ? 'Avisos ante inicios de sesión sospechosos' : 'Alertas desactivadas'}
              </p>
            </div>
          </div>

          {/* Checklist y Recomendaciones */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Estado de las medidas de protección
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-foreground font-medium">Contraseña gestionada por Supabase Auth con cifrado seguro</span>
              </div>
              <div className="flex items-center gap-2">
                {emailNotifications ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className="text-foreground">Notificaciones por correo electrónico</span>
              </div>
              <div className="flex items-center gap-2">
                {loginAlerts ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className="text-foreground">Preferencia de avisos de acceso</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-foreground">Aislamiento estricto de datos multi-inquilino</span>
              </div>
            </div>

            {securityOverview.score < 100 && (
              <div className="mt-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>
                  Sugerencia: Para alcanzar el 100%, activa las alertas de correo y revoca las sesiones remotas que no estés utilizando.
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. CREDENCIALES Y AUTENTICACIÓN ── */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Credenciales de Acceso</CardTitle>
              <CardDescription>Gestiona tu contraseña y los métodos de validación de identidad.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Bloque de Contraseña */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between bg-card">
            <div className="flex items-start gap-3.5">
              <div className="rounded-lg bg-muted p-2.5 mt-0.5">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground">Contraseña de la cuenta</p>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800">
                    Activa y cifrada
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tu contraseña se gestiona con Supabase Auth y nunca se almacena en texto plano.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <ChangePasswordDialog />
              {stats.total > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogoutAllSessions}
                  disabled={closingOthers || closingEverywhere}
                  className="text-xs gap-1.5"
                >
                  {closingOthers ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Cerrar otras sesiones
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Bloque 2FA */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between bg-card">
            <div className="flex items-start gap-3.5">
              <div className="rounded-lg bg-purple-500/10 p-2.5 mt-0.5 text-purple-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground">Autenticación en dos pasos (2FA)</p>
                  <Badge variant="secondary" className="text-[10px]">
                    Próximamente
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta opción añadirá un segundo factor mediante TOTP o código seguro al iniciar sesión.
                </p>
              </div>
            </div>
            <div className="flex items-center sm:shrink-0">
              <Switch disabled checked={twoFactorEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. ALERTAS DE SEGURIDAD ── */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Alertas y Notificaciones de Seguridad</CardTitle>
              <CardDescription>Decide qué eventos críticos deben notificarte de forma inmediata.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3.5 transition-colors hover:bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 mt-0.5">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Notificaciones por email</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recibe avisos por correo cuando se detecten cambios de seguridad en tu cuenta.
                </p>
              </div>
            </div>
            <Switch
              disabled={savingSettings}
              checked={emailNotifications}
              onCheckedChange={(checked) => void handleSecuritySettingChange('email_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3.5 transition-colors hover:bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 mt-0.5">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Alertas de inicio de sesión</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recibe alertas instantáneas cada vez que un nuevo navegador o equipo acceda a tu cuenta.
                </p>
              </div>
            </div>
            <Switch
              disabled={savingSettings}
              checked={loginAlerts}
              onCheckedChange={(checked) => void handleSecuritySettingChange('login_alerts', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 4. SESIONES Y DISPOSITIVOS ── */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Sesiones y Dispositivos</CardTitle>
                <CardDescription>
                  Visualiza los navegadores y equipos donde tu cuenta está actualmente conectada.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal">
                {stats.desktop} Computadoras
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                {stats.mobile} Móviles
              </Badge>
              {stats.tablet > 0 && (
                <Badge variant="outline" className="text-xs font-normal">
                  {stats.tablet} Tablets
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {loadingSessions && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          )}

          {!loadingSessions && sessionsError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error al cargar sesiones</AlertTitle>
              <AlertDescription>{sessionsError}</AlertDescription>
            </Alert>
          )}

          {!loadingSessions && !sessionsError && stats.total === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center">
              <Monitor className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No se encontraron sesiones registradas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Haz clic en actualizar para sincronizar con el servidor.
              </p>
            </div>
          )}

          {!loadingSessions && !sessionsError && stats.total > 0 && (
            <>
              {/* Detección de Sesiones Abiertas por Navegador */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Sesiones detectadas por navegador
                    </h4>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Filtra o revoca sesiones agrupadas por navegador.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                  {browserStats.map((item) => {
                    const isSelected = selectedBrowser === item.browser
                    const isCurrent = item.hasCurrent
                    const hasRemoteSessions = item.count > 1 || !item.hasCurrent

                    return (
                      <div
                        key={item.browser}
                        className={cn(
                          'rounded-lg border p-3 transition-all flex flex-col justify-between gap-2.5',
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border/60 bg-card hover:border-border'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {item.browser}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                                Actual
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs font-mono font-bold">
                            {item.count} {item.count === 1 ? 'sesión' : 'sesiones'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={() => setSelectedBrowser(isSelected ? 'all' : item.browser)}
                          >
                            <Filter className="h-3 w-3 mr-1" />
                            {isSelected ? 'Quitar filtro' : 'Ver sesiones'}
                          </Button>

                          {hasRemoteSessions && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900 px-2"
                              disabled={closingBrowser === item.browser}
                              onClick={() => handleLogoutBrowser(item.browser)}
                              title={`Cerrar sesiones remotas en ${item.browser}`}
                            >
                              {closingBrowser === item.browser ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <LogOut className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedBrowser !== 'all' && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground">
                      Filtrando por: <strong className="text-foreground">{selectedBrowser}</strong>
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-6 p-0 text-xs text-primary"
                      onClick={() => setSelectedBrowser('all')}
                    >
                      Mostrar todos los navegadores
                    </Button>
                  </div>
                )}
              </div>

              {/* Filtros de Vistas (Todas / Este dispositivo / Otras) */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={sessionView === 'all' ? 'default' : 'outline'}
                    onClick={() => setSessionView('all')}
                    disabled={loadingSessions}
                    className="h-8 text-xs"
                  >
                    Todas ({stats.total})
                  </Button>
                  <Button
                    size="sm"
                    variant={sessionView === 'current' ? 'default' : 'outline'}
                    onClick={() => setSessionView('current')}
                    disabled={loadingSessions}
                    className="h-8 text-xs"
                  >
                    Este dispositivo ({stats.total > 0 ? 1 : 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={sessionView === 'others' ? 'default' : 'outline'}
                    onClick={() => setSessionView('others')}
                    disabled={loadingSessions}
                    className="h-8 text-xs"
                  >
                    Otras ({Math.max(0, stats.total - (stats.total > 0 ? 1 : 0))})
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Mostrando <strong>{visibleSessions.length}</strong> de {stats.total} sesiones
                </div>
              </div>

              {/* Aviso si hay múltiples sesiones */}
              {securityOverview.hasMultipleSessions && (
                <Alert className="border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                    Se detectaron {stats.total} sesiones activas simultáneamente en {browserStats.length} navegadores. Si no reconoces algún acceso, puedes cerrarlo individualmente o usar las acciones de cierre masivo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Lista de Sesiones Detalladas */}
              <div className="space-y-3">
                {visibleSessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.device_type)
                  const isCurrentSession = session.is_current

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'rounded-xl border p-4 transition-all duration-200',
                        isCurrentSession
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-400/20'
                          : 'border-border/60 bg-card hover:border-border hover:shadow-xs'
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3.5">
                          <div className={cn(
                            'rounded-xl p-2.5 mt-0.5',
                            isCurrentSession
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            <DeviceIcon className="h-5 w-5" />
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {session.browser} en {getDeviceLabel(session.device_type)}
                              </span>
                              {isCurrentSession ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] gap-1 py-0.5 px-2">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Este dispositivo (Sesión actual)
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] font-normal text-muted-foreground bg-muted/60">
                                  Sesión remota registrada
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 text-xs text-muted-foreground pt-1">
                              <div className="flex items-center gap-1.5">
                                <Monitor className="h-3 w-3 text-muted-foreground/70" />
                                <span>Sistema: {session.os}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Globe className="h-3 w-3 text-muted-foreground/70" />
                                <span>IP: {session.ip_address}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground/70" />
                                <span>
                                  {session.country && session.city
                                    ? `${session.city}, ${session.country}`
                                    : session.country || session.city || 'Ubicación local'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-muted-foreground/70" />
                                <span>Última actividad: {formatDate(session.last_activity)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botón individual de cierre para sesiones remotas */}
                        {!isCurrentSession && (
                          <div className="flex items-center sm:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 gap-1.5"
                              disabled={revokingSessionId === session.id}
                              onClick={() => handleLogoutSession(session)}
                            >
                              {revokingSessionId === session.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              <span>Cerrar sesión</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botones de Gestión Global de Sesiones */}
              {stats.total > 1 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Acciones masivas de cierre</h4>
                      <p className="text-xs text-muted-foreground">
                        Revoca accesos en lote para proteger tu cuenta inmediatamente.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                    {/* Botón 1: Cerrar otras sesiones */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-xs font-medium justify-center gap-2 hover:bg-background border-border/70"
                      onClick={handleLogoutAllSessions}
                      disabled={closingOthers || closingEverywhere}
                    >
                      {closingOthers ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 text-amber-600" />}
                      <div className="text-left leading-tight">
                        <div className="font-semibold text-foreground">Cerrar otras sesiones</div>
                        <div className="text-[10px] text-muted-foreground font-normal">Mantener solo este equipo</div>
                      </div>
                    </Button>

                    {/* Botón 2: Cerrar otros navegadores */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-xs font-medium justify-center gap-2 hover:bg-background border-border/70"
                      onClick={handleLogoutOtherBrowsers}
                      disabled={closingOthers || closingEverywhere}
                    >
                      <Compass className="h-4 w-4 text-blue-600" />
                      <div className="text-left leading-tight">
                        <div className="font-semibold text-foreground">Cerrar otros navegadores</div>
                        <div className="text-[10px] text-muted-foreground font-normal">Mantener navegador actual</div>
                      </div>
                    </Button>

                    {/* Botón 3: Cerrar todas las sesiones */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-11 text-xs font-medium justify-center gap-2"
                      onClick={handleLogoutEverywhere}
                      disabled={closingEverywhere || closingOthers}
                    >
                      {closingEverywhere ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <div className="text-left leading-tight">
                        <div className="font-semibold">Cerrar todas las sesiones</div>
                        <div className="text-[10px] opacity-90 font-normal">Requiere volver a ingresar</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 5. ZONA ADMINISTRATIVA EXCLUSIVA ── */}
      {role === 'super_admin' && (
        <Card className="border-border/60 bg-muted/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Zona Administrativa de Seguridad</CardTitle>
                <CardDescription className="text-xs">
                  Herramientas avanzadas para auditoría de tokens y sesiones multi-empresa.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Como Super Administrador, tus sesiones registran auditoría de clave maestra y accesos cross-tenant. Las directivas de retención de tokens se aplican automáticamente cada 24 horas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
