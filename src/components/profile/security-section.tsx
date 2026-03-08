'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
} from 'lucide-react'
import { ChangePasswordDialog } from './change-password-dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { getSessionIdFromAccessToken } from '@/lib/session-id'

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

export function SecuritySection({ userId, role }: SecuritySectionProps) {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [sessionView, setSessionView] = useState<'all' | 'current' | 'others'>('all')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  const [closingSessionId, setClosingSessionId] = useState<string | null>(null)
  const [closingOthers, setClosingOthers] = useState(false)
  const [closingOtherBrowsers, setClosingOtherBrowsers] = useState(false)
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

      const [rpcResult, authSessionResult] = await Promise.all([
        supabase.rpc('get_user_active_sessions', { p_user_id: effectiveUserId }),
        supabase.auth.getSession(),
      ])

      if (rpcResult.error) {
        throw rpcResult.error
      }

      const currentSessionId = await getSessionIdFromAccessToken(authSessionResult.data.session?.access_token)

      const rows = (rpcResult.data || []) as Array<Record<string, any>>
      const mapped: SessionRecord[] = rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        user_agent: row.user_agent || navigator.userAgent,
        ip_address: row.ip_address || 'IP not available',
        device_type: row.device_type || 'desktop',
        browser: row.browser || 'Unknown',
        os: row.os || 'Unknown',
        created_at: row.created_at,
        last_activity: row.last_activity,
        is_active: row.is_active,
        country: row.country || undefined,
        city: row.city || undefined,
        is_current: Boolean(currentSessionId && row.session_id === currentSessionId),
      }))

      setSessions(mapped)
      setLastSyncAt(new Date())
    } catch (error) {
      logger.error('Error loading sessions', { error })
      setSessionsError('No se pudieron cargar las sesiones activas')
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
        !closingOthers &&
        !closingOtherBrowsers &&
        !closingSessionId
      ) {
        loadSessions()
      }
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [closingEverywhere, closingOthers, closingOtherBrowsers, closingSessionId, loadSessions])

  const saveSecuritySettings = async (settings: Partial<{
    two_factor_enabled: boolean
    email_notifications: boolean
    login_alerts: boolean
  }>) => {
    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

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
      toast.success('Configuracion de seguridad actualizada')
    } catch (error) {
      logger.error('Error saving security settings', { error })
      toast.error('No se pudo guardar la configuracion de seguridad')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLogoutSession = async (sessionId: string) => {
    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      const current = sessions.find((s) => s.session_id === sessionId)
      if (current?.is_current) {
        toast.error('No puedes cerrar la sesion actual desde esta accion')
        return
      }

      const confirmClose = window.confirm('Deseas cerrar esta sesion remota?')
      if (!confirmClose) return

      setClosingSessionId(sessionId)
      const { data, error } = await supabase.rpc('close_user_session', {
        p_session_id: sessionId,
        p_user_id: effectiveUserId,
      })

      if (error) throw error

      if (data?.success) {
        toast.success(data.message || 'Sesion cerrada')
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
        setLastSyncAt(new Date())
      } else {
        toast.error(data?.message || 'No se pudo cerrar la sesion')
        await loadSessions()
      }
    } catch (error) {
      logger.error('Error closing session', { error })
      toast.error('Error al cerrar la sesion')
    } finally {
      setClosingSessionId(null)
    }
  }

  const handleLogoutAllSessions = async () => {
    if (!window.confirm('Vas a cerrar todas las otras sesiones activas. Continuar?')) return

    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(currentSession?.access_token)
      if (!currentSessionId) {
        toast.error('No se pudo identificar la sesion actual')
        return
      }

      setClosingOthers(true)
      const { data, error } = await supabase.rpc('close_all_user_sessions_except_current', {
        p_user_id: effectiveUserId,
        p_current_session_id: currentSessionId,
      })

      if (error) throw error

      const closedCount = Number(data || 0)
      toast.success(closedCount > 0 ? `${closedCount} sesiones cerradas` : 'No hay otras sesiones activas')
      await loadSessions()
    } catch (error) {
      logger.error('Error closing all other sessions', { error })
      toast.error('Error al cerrar las sesiones')
    } finally {
      setClosingOthers(false)
    }
  }

  const handleLogoutOtherBrowsers = async () => {
    const currentBrowser = sessions.find((s) => s.is_current)?.browser
    const targets = sessions.filter((s) => !s.is_current && (!currentBrowser || s.browser !== currentBrowser))

    if (targets.length === 0) {
      toast.info('No hay sesiones abiertas en otros navegadores')
      return
    }

    if (!window.confirm(`Se cerraran ${targets.length} sesiones en otros navegadores. Continuar?`)) return

    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      setClosingOtherBrowsers(true)
      const results = await Promise.allSettled(
        targets.map((target) =>
          supabase.rpc('close_user_session', {
            p_session_id: target.session_id,
            p_user_id: effectiveUserId,
          }),
        ),
      )

      const closedCount = results.filter((result) => {
        if (result.status !== 'fulfilled') return false
        const rpcResult = result.value
        return Boolean(!rpcResult.error && rpcResult.data?.success)
      }).length

      if (closedCount > 0) {
        toast.success(`${closedCount} sesiones cerradas en otros navegadores`)
      } else {
        toast.error('No se pudieron cerrar sesiones en otros navegadores')
      }

      await loadSessions()
    } catch (error) {
      logger.error('Error closing sessions in other browsers', { error })
      toast.error('Error al cerrar sesiones en otros navegadores')
    } finally {
      setClosingOtherBrowsers(false)
    }
  }

  const handleLogoutEverywhere = async () => {
    if (!window.confirm('Vas a cerrar todas las sesiones, incluida esta. Continuar?')) return

    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(currentSession?.access_token)
      if (!currentSessionId) {
        toast.error('No se pudo identificar la sesion actual')
        return
      }

      setClosingEverywhere(true)

      const closeOthersResult = await supabase.rpc('close_all_user_sessions_except_current', {
        p_user_id: effectiveUserId,
        p_current_session_id: currentSessionId,
      })
      if (closeOthersResult.error) throw closeOthersResult.error

      const closeCurrentResult = await supabase.rpc('close_user_session', {
        p_session_id: currentSessionId,
        p_user_id: effectiveUserId,
      })
      if (closeCurrentResult.error) throw closeCurrentResult.error

      await supabase.auth.signOut({ scope: 'global' })

      toast.success('Sesiones cerradas. Redirigiendo...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 1200)
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
    if (sessionView === 'current') return sortedSessions.filter((s) => s.is_current)
    if (sessionView === 'others') return sortedSessions.filter((s) => !s.is_current)
    return sortedSessions
  }, [sortedSessions, sessionView])

  const stats = useMemo(() => ({
    total: sessions.length,
    desktop: sessions.filter((s) => s.device_type === 'desktop').length,
    mobile: sessions.filter((s) => s.device_type === 'mobile').length,
    tablet: sessions.filter((s) => s.device_type === 'tablet').length,
  }), [sessions])

  const browserStats = useMemo(() => {
    const counter = sessions.reduce<Record<string, number>>((acc, session) => {
      const key = session.browser || 'Desconocido'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return Object.entries(counter)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const otherBrowserSessionsCount = useMemo(() => {
    const currentBrowser = sessions.find((s) => s.is_current)?.browser
    return sessions.filter((s) => !s.is_current && (!currentBrowser || s.browser !== currentBrowser)).length
  }, [sessions])

  const securityOverview = useMemo(() => {
    let score = 35
    if (emailNotifications) score += 15
    if (loginAlerts) score += 15
    if (twoFactorEnabled) score += 20
    if (stats.total <= 1) score += 15
    else if (stats.total <= 3) score += 5
    score = Math.min(100, score)

    const level = score >= 80 ? 'Alto' : score >= 60 ? 'Medio' : 'Bajo'
    const variant = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'

    return {
      score,
      level,
      variant,
      hasMultipleSessions: stats.total > 1,
    }
  }, [emailNotifications, loginAlerts, twoFactorEnabled, stats.total])

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile' || deviceType === 'tablet') return Smartphone
    return Monitor
  }

  const getDeviceType = (deviceType: string) => {
    if (deviceType === 'mobile') return 'Movil'
    if (deviceType === 'tablet') return 'Tablet'
    return 'Computadora'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Sin fecha'
    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  }

  const formatAbsoluteDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Sin fecha'
    return date.toLocaleString('es-PY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-red-400/20 via-orange-400/20 to-yellow-400/20 rounded-full blur-3xl" />
        <CardHeader className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border-b border-red-200/50 dark:border-red-800/50 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Seguridad de la Cuenta
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Protege tu cuenta y administra sesiones activas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 relative z-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">Nivel de seguridad</p>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{securityOverview.score}/100</p>
              <Badge variant="outline" className="mt-2">{securityOverview.level}</Badge>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sesiones activas</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {securityOverview.hasMultipleSessions ? 'Revisa dispositivos no reconocidos' : 'Solo tu sesion actual'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ultima sincronizacion</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {lastSyncAt ? formatDate(lastSyncAt.toISOString()) : 'Sin datos'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={cn('h-full transition-all', securityOverview.variant)} style={{ width: `${securityOverview.score}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 dark:border-blue-800/60 dark:from-blue-950/30 dark:to-cyan-950/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/50">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Contrasena</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Actualiza tu contrasena y luego cierra sesiones antiguas para reforzar la seguridad.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <ChangePasswordDialog />
              {stats.total > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleLogoutAllSessions}
                  disabled={closingOthers || closingOtherBrowsers || closingEverywhere || Boolean(closingSessionId)}
                >
                  {closingOthers ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Cerrar otras sesiones
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 opacity-60">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Autenticacion 2FA</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Disponible proximamente</p>
              </div>
            </div>
            <Switch disabled checked={twoFactorEnabled} />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas de Seguridad
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">Notificaciones por email</p>
                  <p className="text-xs text-muted-foreground">Recibe alertas de actividad sospechosa</p>
                </div>
                <Switch
                  disabled={savingSettings}
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked)
                    saveSecuritySettings({ email_notifications: checked })
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">Alertas de inicio de sesion</p>
                  <p className="text-xs text-muted-foreground">Notifica cuando inicies sesion en un dispositivo nuevo</p>
                </div>
                <Switch
                  disabled={savingSettings}
                  checked={loginAlerts}
                  onCheckedChange={(checked) => {
                    setLoginAlerts(checked)
                    saveSecuritySettings({ login_alerts: checked })
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl relative">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-400/20 via-emerald-400/20 to-teal-400/20 rounded-full blur-3xl" />
        <CardHeader className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border-b border-green-200/50 dark:border-green-800/50 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-lg">
                <Monitor className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Sesiones y Dispositivos
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Administra accesos activos y cierra dispositivos que no reconozcas.
                </CardDescription>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ultima sincronizacion:{' '}
                  {lastSyncAt ? formatAbsoluteDate(lastSyncAt.toISOString()) : 'sin datos'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSessions}
              className="gap-2"
              disabled={loadingSessions || closingOthers || closingOtherBrowsers || closingEverywhere}
            >
              <RefreshCw className={cn('h-4 w-4', loadingSessions && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6 relative z-10">
          {loadingSessions && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loadingSessions && sessionsError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{sessionsError}</AlertDescription>
            </Alert>
          )}

          {!loadingSessions && !sessionsError && stats.total === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron sesiones activas</p>
            </div>
          )}

          {!loadingSessions && !sessionsError && stats.total > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Sesiones activas</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800">
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.desktop}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Computadoras</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.mobile}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Moviles</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.tablet}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">Tablets</p>
                </div>
              </div>

              {securityOverview.hasMultipleSessions && (
                <Alert className="mb-4 border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Detectamos multiples sesiones activas. Si hay un dispositivo desconocido, cierra esa sesion de inmediato.
                  </AlertDescription>
                </Alert>
              )}

              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={sessionView === 'all' ? 'default' : 'outline'}
                  onClick={() => setSessionView('all')}
                  disabled={loadingSessions}
                >
                  Todas ({stats.total})
                </Button>
                <Button
                  size="sm"
                  variant={sessionView === 'current' ? 'default' : 'outline'}
                  onClick={() => setSessionView('current')}
                  disabled={loadingSessions}
                >
                  Actual ({stats.total > 0 ? 1 : 0})
                </Button>
                <Button
                  size="sm"
                  variant={sessionView === 'others' ? 'default' : 'outline'}
                  onClick={() => setSessionView('others')}
                  disabled={loadingSessions}
                >
                  Otras ({Math.max(0, stats.total - (stats.total > 0 ? 1 : 0))})
                </Button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {browserStats.map((item) => (
                  <Badge key={item.browser} variant="secondary">
                    {item.browser}: {item.count}
                  </Badge>
                ))}
              </div>

              <div className="space-y-3">
                {visibleSessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.device_type)
                  const isCurrentSession = session.is_current

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md',
                        isCurrentSession
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-500/50 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={cn('p-2 rounded-lg', isCurrentSession ? 'bg-green-100 dark:bg-green-900/50' : 'bg-slate-200 dark:bg-slate-700')}>
                            <DeviceIcon className={cn('h-5 w-5', isCurrentSession ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-sm">{session.browser} - {getDeviceType(session.device_type)}</p>
                              {isCurrentSession && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Sesion actual
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Monitor className="h-3 w-3" />
                                <span>{session.os}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {session.country && session.city
                                    ? `${session.city}, ${session.country}`
                                    : session.country || session.city || session.ip_address}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span>Ultima actividad: {formatDate(session.last_activity)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span>Inicio: {formatAbsoluteDate(session.created_at)}</span>
                              </div>
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                Sesion ID: {session.session_id}
                              </p>
                            </div>
                          </div>
                        </div>

                        {!isCurrentSession && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLogoutSession(session.session_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-2 px-3 shrink-0"
                            title="Cerrar esta sesion"
                            disabled={Boolean(closingSessionId) || closingOthers || closingOtherBrowsers || closingEverywhere}
                          >
                            {closingSessionId === session.session_id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
                            <span className="text-xs font-medium">Cerrar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {stats.total > 1 && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Multiples sesiones detectadas</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">Si detectas un dispositivo no reconocido, cierra la sesion de inmediato.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full gap-2 border-2 border-orange-300 hover:bg-orange-50 hover:border-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/30 dark:hover:border-orange-600 transition-all duration-200"
                        onClick={handleLogoutAllSessions}
                        disabled={closingOthers || closingOtherBrowsers || closingEverywhere || Boolean(closingSessionId)}
                      >
                        {closingOthers ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                        <div className="text-left">
                          <div className="font-semibold">Cerrar otras sesiones</div>
                          <div className="text-xs opacity-75">Mantener solo esta sesion</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full gap-2 border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:border-blue-600 transition-all duration-200"
                        onClick={handleLogoutOtherBrowsers}
                        disabled={closingOtherBrowsers || closingOthers || closingEverywhere || Boolean(closingSessionId)}
                      >
                        {closingOtherBrowsers ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Monitor className="h-5 w-5" />}
                        <div className="text-left">
                          <div className="font-semibold">Cerrar otros navegadores</div>
                          <div className="text-xs opacity-75">{otherBrowserSessionsCount} sesiones detectadas</div>
                        </div>
                      </Button>

                      <Button
                        variant="destructive"
                        size="lg"
                        className="w-full gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-200"
                        onClick={handleLogoutEverywhere}
                        disabled={closingEverywhere || closingOtherBrowsers || closingOthers || Boolean(closingSessionId)}
                      >
                        {closingEverywhere ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                        <div className="text-left">
                          <div className="font-semibold">Cerrar todas</div>
                          <div className="text-xs opacity-90">Incluida esta sesion</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {role === 'super_admin' && (
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 shadow-xl">
          <CardHeader className="border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-orange-700 dark:text-orange-400">Zona Administrativa</CardTitle>
                <CardDescription>Configuraciones avanzadas de seguridad</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert className="border-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm">Utiliza estas herramientas con cuidado.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


