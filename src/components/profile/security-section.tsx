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
  Filter
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
  const [selectedBrowser, setSelectedBrowser] = useState<string>('all')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  const [closingSessionId, setClosingSessionId] = useState<string | null>(null)
  const [closingBrowser, setClosingBrowser] = useState<string | null>(null)
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

      let rows: Array<Record<string, any>> = []
      let loadError: any = null

      const authSessionResult = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(authSessionResult.data.session?.access_token)

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

      const mapped: SessionRecord[] = rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        user_agent: row.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        ip_address: row.ip_address || 'IP no disponible',
        device_type: row.device_type || 'desktop',
        browser: row.browser || 'Navegador desconocido',
        os: row.os || 'Sistema desconocido',
        created_at: row.created_at,
        last_activity: row.last_activity,
        is_active: row.is_active,
        country: row.country || undefined,
        city: row.city || undefined,
        is_current: Boolean(currentSessionId && row.session_id === currentSessionId),
      }))

      setSessions(mapped)
      setLastSyncAt(new Date())

      if (rows.length === 0 && loadError) {
        const errMsg = loadError?.message || 'Error de sincronización'
        console.warn('Aviso al sincronizar sesiones:', errMsg)
      }
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
        !closingOthers &&
        !closingOtherBrowsers &&
        !closingSessionId &&
        !closingBrowser
      ) {
        loadSessions()
      }
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [closingEverywhere, closingOthers, closingOtherBrowsers, closingSessionId, closingBrowser, loadSessions])

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
      toast.success('Configuración de seguridad guardada')
    } catch (error) {
      logger.error('Error saving security settings', { error })
      toast.error('No se pudo guardar la configuración de seguridad')
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
        toast.error('No puedes cerrar la sesión actual desde esta acción')
        return
      }

      const confirmClose = window.confirm('¿Deseas cerrar esta sesión remota?')
      if (!confirmClose) return

      setClosingSessionId(sessionId)
      const { data, error } = await supabase.rpc('close_user_session', {
        p_session_id: sessionId,
        p_user_id: effectiveUserId,
      })

      if (error) throw error

      if (data?.success) {
        toast.success(data.message || 'Sesión remota finalizada correctamente')
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
        setLastSyncAt(new Date())
      } else {
        toast.error(data?.message || 'No se pudo cerrar la sesión')
        await loadSessions()
      }
    } catch (error) {
      logger.error('Error closing session', { error })
      toast.error('Error al cerrar la sesión remota')
    } finally {
      setClosingSessionId(null)
    }
  }

  const handleLogoutAllSessions = async () => {
    if (!window.confirm('¿Deseas cerrar todas las otras sesiones activas y mantener solo este dispositivo?')) return

    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(currentSession?.access_token)
      if (!currentSessionId) {
        toast.error('No se pudo identificar la sesión actual')
        return
      }

      setClosingOthers(true)
      const { data, error } = await supabase.rpc('close_all_user_sessions_except_current', {
        p_user_id: effectiveUserId,
        p_current_session_id: currentSessionId,
      })

      if (error) throw error

      const closedCount = Number(data || 0)
      toast.success(closedCount > 0 ? `${closedCount} sesiones remotas cerradas` : 'No hay otras sesiones activas')
      await loadSessions()
    } catch (error) {
      logger.error('Error closing all other sessions', { error })
      toast.error('Error al cerrar las sesiones remotas')
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

    if (!window.confirm(`Se cerrarán ${targets.length} sesiones en otros navegadores. ¿Continuar?`)) return

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

  const handleLogoutBrowser = async (targetBrowser: string) => {
    const effectiveUserId = await getEffectiveUserId()
    if (!effectiveUserId) return

    const currentSessionId = sessions.find((s) => s.is_current)?.session_id
    const targets = sessions.filter(
      (s) => (s.browser || 'Desconocido') === targetBrowser && s.session_id !== currentSessionId
    )

    if (targets.length === 0) {
      toast.info(`No hay sesiones remotas abiertas en ${targetBrowser}`)
      return
    }

    if (!window.confirm(`¿Deseas cerrar las ${targets.length} sesiones abiertas en ${targetBrowser}?`)) return

    try {
      setClosingBrowser(targetBrowser)
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
        toast.success(`${closedCount} sesiones cerradas en ${targetBrowser}`)
      } else {
        toast.error(`No se pudieron cerrar sesiones en ${targetBrowser}`)
      }

      await loadSessions()
    } catch (error) {
      logger.error(`Error closing sessions for browser ${targetBrowser}`, { error })
      toast.error(`Error al cerrar sesiones en ${targetBrowser}`)
    } finally {
      setClosingBrowser(null)
    }
  }

  const handleLogoutEverywhere = async () => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar todas las sesiones, incluida esta? Tendrás que volver a iniciar sesión.')) return

    try {
      const effectiveUserId = await getEffectiveUserId()
      if (!effectiveUserId) return

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const currentSessionId = await getSessionIdFromAccessToken(currentSession?.access_token)
      if (!currentSessionId) {
        toast.error('No se pudo identificar la sesión actual')
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

      toast.success('Todas las sesiones fueron cerradas. Redirigiendo al login...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
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

  const currentBrowser = useMemo(() => {
    return sessions.find((s) => s.is_current)?.browser || 'Desconocido'
  }, [sessions])

  const browserStats = useMemo(() => {
    const counter = sessions.reduce<Record<string, { count: number; hasCurrent: boolean; remoteCount: number }>>((acc, session) => {
      const key = session.browser || 'Desconocido'
      if (!acc[key]) {
        acc[key] = { count: 0, hasCurrent: false, remoteCount: 0 }
      }
      acc[key].count += 1
      if (session.is_current) {
        acc[key].hasCurrent = true
      } else {
        acc[key].remoteCount += 1
      }
      return acc
    }, {})

    return Object.entries(counter)
      .map(([browser, data]) => ({
        browser,
        count: data.count,
        hasCurrent: data.hasCurrent,
        remoteCount: data.remoteCount
      }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const otherBrowserSessionsCount = useMemo(() => {
    return sessions.filter((s) => !s.is_current && (!currentBrowser || s.browser !== currentBrowser)).length
  }, [sessions, currentBrowser])

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
    const textColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'

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
    if (Number.isNaN(date.getTime())) return 'Sin fecha registrada'
    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal de Seguridad */}
      <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Seguridad de la Cuenta</CardTitle>
                <CardDescription>
                  Monitorea el estado de protección, credenciales y dispositivos autorizados.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-1 px-2.5 font-normal gap-1.5">
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
        <CardContent className="space-y-6">
          {/* Métricas de Diagnóstico Ejecutivo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Nivel de protección</p>
                <Shield className={cn('h-4 w-4', securityOverview.textColor)} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {securityOverview.score}%
                </span>
                <span className={cn('text-xs font-semibold', securityOverview.textColor)}>
                  {securityOverview.level}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full transition-all duration-500 rounded-full', securityOverview.variantColor)}
                  style={{ width: `${securityOverview.score}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Sesiones activas</p>
                <Laptop className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {stats.total} {stats.total === 1 ? 'dispositivo' : 'dispositivos'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {securityOverview.hasMultipleSessions
                  ? `${browserStats.length} navegadores detectados`
                  : 'Solo este dispositivo tiene acceso activo'}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Alertas de acceso</p>
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {loginAlerts && emailNotifications ? 'Monitoreo 24/7' : 'Parcial'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loginAlerts ? 'Avisos en tiempo real por nuevo inicio' : 'Alertas desactivadas'}
              </p>
            </div>
          </div>

          {/* Checklist de Seguridad */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Estado de las medidas de protección
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-foreground font-medium">Contraseña encriptada con Bcrypt/Argon2</span>
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
                <span className="text-foreground">Detección de dispositivos no habituales</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-foreground">Aislamiento estricto de datos multi-inquilino</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credenciales y Autenticacion */}
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
                  Tu contraseña nunca se guarda en texto plano. Se almacena con hash irreversible.
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
                  disabled={closingOthers || closingOtherBrowsers || closingEverywhere || Boolean(closingSessionId)}
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
                  Requerirá un código de verificación desde Google Authenticator o Authy al iniciar sesión.
                </p>
              </div>
            </div>
            <div className="flex items-center sm:shrink-0">
              <Switch disabled checked={twoFactorEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Seguridad */}
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
                  Recibe avisos en tu correo sobre cambios de contraseña o accesos desde ciudades nuevas.
                </p>
              </div>
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

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3.5 transition-colors hover:bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 mt-0.5">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Alertas de inicio de sesión</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Genera una notificación en el panel de control cuando tu cuenta sea iniciada en otro dispositivo.
                </p>
              </div>
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
        </CardContent>
      </Card>

      {/* Sesiones y Dispositivos */}
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
                    Haz clic en un navegador para filtrar o cerrarlo
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                  {browserStats.map((item) => {
                    const isSelected = selectedBrowser === item.browser
                    const isCurrent = item.hasCurrent

                    return (
                      <div
                        key={item.browser}
                        className={cn(
                          'rounded-lg border p-3 transition-all flex flex-col justify-between gap-2',
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

                          {item.remoteCount > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                              title={`Cerrar las sesiones abiertas en ${item.browser}`}
                              onClick={() => handleLogoutBrowser(item.browser)}
                              disabled={closingBrowser === item.browser || closingOthers || closingOtherBrowsers || closingEverywhere}
                            >
                              {closingBrowser === item.browser ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <LogOut className="h-3 w-3 mr-1" />
                              )}
                              Cerrar
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
                    Se detectaron {stats.total} sesiones activas simultáneamente en {browserStats.length} navegadores. Si no reconoces alguno de los accesos remotos, ciérralo inmediatamente por precaución.
                  </AlertDescription>
                </Alert>
              )}

              {/* Lista de Sesiones */}
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
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-400/20'
                          : 'border-border/60 bg-card hover:border-border hover:shadow-sm'
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
                                  Navegador reconocido · Sesión remota
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

                            <p className="text-[10px] font-mono text-muted-foreground/60 pt-0.5">
                              ID de sesión: {session.session_id}
                            </p>
                          </div>
                        </div>

                        {!isCurrentSession && (
                          <div className="sm:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLogoutSession(session.session_id)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 text-xs h-8 gap-1.5"
                              disabled={Boolean(closingSessionId) || closingOthers || closingOtherBrowsers || closingEverywhere}
                            >
                              {closingSessionId === session.session_id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <LogOut className="h-3.5 w-3.5" />
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
                        Finaliza accesos en segundo plano para garantizar que solo tú tengas control.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-xs font-medium justify-center gap-2 hover:bg-background"
                      onClick={handleLogoutAllSessions}
                      disabled={closingOthers || closingOtherBrowsers || closingEverywhere || Boolean(closingSessionId)}
                    >
                      {closingOthers ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 text-amber-600" />}
                      <div className="text-left leading-tight">
                        <div>Cerrar otras sesiones</div>
                        <div className="text-[10px] text-muted-foreground font-normal">Mantener solo este equipo</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-xs font-medium justify-center gap-2 hover:bg-background"
                      onClick={handleLogoutOtherBrowsers}
                      disabled={closingOtherBrowsers || closingOthers || closingEverywhere || Boolean(closingSessionId)}
                    >
                      {closingOtherBrowsers ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4 text-blue-600" />}
                      <div className="text-left leading-tight">
                        <div>Cerrar otros navegadores</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{otherBrowserSessionsCount} sesiones detectadas</div>
                      </div>
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-10 text-xs font-medium justify-center gap-2"
                      onClick={handleLogoutEverywhere}
                      disabled={closingEverywhere || closingOtherBrowsers || closingOthers || Boolean(closingSessionId)}
                    >
                      {closingEverywhere ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <div className="text-left leading-tight">
                        <div>Cerrar todas las sesiones</div>
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

      {/* Zona Administrativa Exclusiva */}
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
