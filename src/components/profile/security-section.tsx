'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Shield, 
  Key, 
  Smartphone, 
  Monitor, 
  Clock, 
  MapPin, 
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { ChangePasswordDialog } from './change-password-dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Session {
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
}

interface SecuritySectionProps {
  userId: string | null
  role: string | null
}

export function SecuritySection({ userId, role }: SecuritySectionProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
    loadSecuritySettings()
  }, [userId])

  const loadSessions = async () => {
    if (!userId) return
    
    try {
      setLoadingSessions(true)
      
      // Obtener sesiones activas desde la base de datos
      const { data, error } = await supabase.rpc('get_user_active_sessions', {
        p_user_id: userId
      })

      if (error) throw error

      // Obtener la sesión actual para marcarla
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const currentSessionId = currentSession?.access_token.substring(0, 50)

      const sessionsData: Session[] = (data || []).map((s: any) => ({
        id: s.id,
        session_id: s.session_id,
        user_agent: s.user_agent || navigator.userAgent,
        ip_address: s.ip_address || 'IP no disponible',
        device_type: s.device_type || 'desktop',
        browser: s.browser || 'Desconocido',
        os: s.os || 'Desconocido',
        created_at: s.created_at,
        last_activity: s.last_activity,
        is_active: s.is_active,
        is_current: s.session_id === currentSessionId
      }))

      setSessions(sessionsData)
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessionsError('No se pudieron cargar las sesiones')
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadSecuritySettings = async () => {
    if (!userId) return
    
    try {
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        setTwoFactorEnabled(data.two_factor_enabled || false)
        setEmailNotifications(data.email_notifications || true)
        setLoginAlerts(data.login_alerts || true)
      }
    } catch (error) {
      console.error('Error loading security settings:', error)
    }
  }

  const saveSecuritySettings = async (settings: Partial<{
    two_factor_enabled: boolean
    email_notifications: boolean
    login_alerts: boolean
  }>) => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success('Configuración actualizada')
    } catch (error) {
      console.error('Error saving security settings:', error)
      toast.error('Error al guardar configuración')
    }
  }

  const handleLogoutSession = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.rpc('close_user_session', {
        p_session_id: sessionId,
        p_user_id: userId
      })

      if (error) throw error

      if (data) {
        toast.success('Sesión cerrada correctamente')
        loadSessions()
      } else {
        toast.error('No se pudo cerrar la sesión')
      }
    } catch (error) {
      console.error('Error closing session:', error)
      toast.error('Error al cerrar sesión')
    }
  }

  const handleLogoutAllSessions = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return

      const currentSessionId = currentSession.access_token.substring(0, 50)

      const { data, error } = await supabase.rpc('close_all_user_sessions_except_current', {
        p_user_id: userId,
        p_current_session_id: currentSessionId
      })

      if (error) throw error

      const closedCount = data as number
      if (closedCount > 0) {
        toast.success(`${closedCount} sesión(es) cerrada(s)`)
        loadSessions()
      } else {
        toast.info('No hay otras sesiones activas')
      }
    } catch (error) {
      console.error('Error closing all sessions:', error)
      toast.error('Error al cerrar sesiones')
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile') return Smartphone
    if (deviceType === 'tablet') return Smartphone
    return Monitor
  }

  const getDeviceType = (deviceType: string) => {
    if (deviceType === 'mobile') return 'Móvil'
    if (deviceType === 'tablet') return 'Tablet'
    return 'Escritorio'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora mismo'
    if (minutes < 60) return `Hace ${minutes} min`
    if (hours < 24) return `Hace ${hours} h`
    if (days < 7) return `Hace ${days} días`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Acceso y Contraseña */}
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
                Protege tu cuenta con contraseñas seguras y autenticación adicional
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 relative z-10">
          {/* Cambiar Contraseña */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Contraseña</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Cambia tu contraseña periódicamente para mayor seguridad
                </p>
              </div>
            </div>
            <ChangePasswordDialog />
          </div>

          <Separator />

          {/* Autenticación de 2 Factores */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 opacity-60">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Autenticación en 2 Pasos (2FA)
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Próximamente disponible
                </p>
              </div>
            </div>
            <Switch disabled checked={twoFactorEnabled} />
          </div>

          <Separator />

          {/* Alertas de Seguridad */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas de Seguridad
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">Notificaciones por email</p>
                  <p className="text-xs text-muted-foreground">
                    Recibe alertas de actividad sospechosa
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked)
                    saveSecuritySettings({ email_notifications: checked })
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">Alertas de inicio de sesión</p>
                  <p className="text-xs text-muted-foreground">
                    Notificación cuando inicies sesión desde un nuevo dispositivo
                  </p>
                </div>
                <Switch
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

      {/* Sesiones Activas */}
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
                  Administra dónde tienes sesiones activas
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSessions}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
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

          {!loadingSessions && !sessionsError && sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron sesiones activas</p>
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length > 0 && (
            <>
              <div className="space-y-3">
                {sessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.device_type)
                  const deviceType = getDeviceType(session.device_type)
                  const browser = session.browser
                  const isCurrentSession = session.is_current

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200",
                        isCurrentSession
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-500/50"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={cn(
                            "p-2 rounded-lg",
                            isCurrentSession
                              ? "bg-green-100 dark:bg-green-900/50"
                              : "bg-slate-200 dark:bg-slate-700"
                          )}>
                            <DeviceIcon className={cn(
                              "h-5 w-5",
                              isCurrentSession
                                ? "text-green-600 dark:text-green-400"
                                : "text-slate-600 dark:text-slate-400"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-sm">
                                {browser} • {deviceType}
                              </p>
                              {isCurrentSession && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Sesión actual
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
                                <span>{session.ip_address}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span>Última actividad: {formatDate(session.last_activity)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {!isCurrentSession && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLogoutSession(session.session_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {sessions.length > 1 && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={handleLogoutAllSessions}
                  >
                    <Trash2 className="h-4 w-4" />
                    Cerrar todas las sesiones
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Zona Administrativa (solo para super_admin) */}
      {role === 'super_admin' && (
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 shadow-xl">
          <CardHeader className="border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-orange-700 dark:text-orange-400">
                  Zona Administrativa
                </CardTitle>
                <CardDescription>
                  Configuraciones avanzadas de seguridad
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert className="border-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm">
                Como super administrador, tienes acceso a configuraciones avanzadas de seguridad.
                Usa estas herramientas con precaución.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
