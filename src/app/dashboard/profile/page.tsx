'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import type { ColorScheme } from '@/contexts/theme-context'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useTheme } from '@/contexts/theme-context'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { 
  Mail, Phone, User, LogOut, Palette, Shield, Bell, Building2, MapPin, 
  Save, RefreshCw, Settings, Key, Eye, Globe, 
  Smartphone, Monitor, Sun, Moon, Zap, X, Copy,
  Activity, Clock, Calendar, Award, TrendingUp,
  AlertCircle, CheckCircle, Briefcase, ChevronRight
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton-loader'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { StorageDiagnostics } from '@/components/admin/storage-diagnostics'
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Validaciones con Zod (mismo esquema)
const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().max(500, 'Máximo 500 caracteres').optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  timezone: z.string(),
  socialLinks: z.object({
    twitter: z.string().url('URL inválida').optional().or(z.literal('')),
    linkedin: z.string().url('URL inválida').optional().or(z.literal('')),
    github: z.string().url('URL inválida').optional().or(z.literal(''))
  }).optional()
})

type UserProfile = z.infer<typeof profileSchema>

interface ProfilePreferences {
  notifications: boolean
  compactMode: boolean
  language: string
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
  autoSave: boolean
  darkModeSchedule: boolean
}

interface ProfileStats {
  totalSales: number
  completedTasks: number
  loginStreak: number
  lastActivity: string
}

interface UserSessionInfo {
  id: string
  startedAt: string
  endedAt?: string
  ipAddress: string | null
  status: 'active' | 'closed'
}

export default function UserProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeSection, setActiveSection] = useState('profile') // 'profile', 'preferences', 'security'
  
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
    department: '',
    jobTitle: '',
    location: '',
    bio: '',
    website: '',
    timezone: 'America/Asuncion',
    socialLinks: { twitter: '', linkedin: '', github: '' }
  })
  
  const [initialProfile, setInitialProfile] = useState<UserProfile>(profile)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isDirty, setIsDirty] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  
  const [prefs, setPrefs] = useState<ProfilePreferences>({
    notifications: true,
    compactMode: false,
    language: 'es',
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    autoSave: true,
    darkModeSchedule: false
  })
  const [initialPrefs, setInitialPrefs] = useState<ProfilePreferences>(prefs)
  const [isDirtyPrefs, setIsDirtyPrefs] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  const [stats, setStats] = useState<ProfileStats>({
    totalSales: 0,
    completedTasks: 0,
    loginStreak: 0,
    lastActivity: 'Hace 5 minutos'
  })

  const [sessions, setSessions] = useState<UserSessionInfo[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)

  // Cargar usuario actual y preferencias
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          const baseProfile: UserProfile = {
            name: (user.user_metadata?.full_name as string) || 'Usuario',
            email: user.email || '',
            phone: (user.user_metadata?.phone as string) || '',
            avatarUrl: (user.user_metadata?.avatar_url as string) || '',
            department: '',
            jobTitle: '',
            location: '',
            bio: '',
            website: '',
            timezone: 'America/Asuncion',
            socialLinks: { twitter: '', linkedin: '', github: '' }
          }
          
          setProfile(baseProfile)
          setInitialProfile(baseProfile)

          try {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle()
              
            if (profileRow) {
              const mergedProfile = {
                ...baseProfile,
                name: profileRow.name ?? baseProfile.name,
                avatarUrl: profileRow.avatar_url ?? baseProfile.avatarUrl,
                phone: profileRow.phone ?? baseProfile.phone,
                department: profileRow.department ?? baseProfile.department,
                jobTitle: profileRow.job_title ?? baseProfile.jobTitle,
                location: profileRow.location ?? baseProfile.location,
                bio: profileRow.bio ?? baseProfile.bio,
                website: profileRow.website ?? baseProfile.website,
                timezone: profileRow.timezone ?? baseProfile.timezone,
                socialLinks: {
                  ...baseProfile.socialLinks,
                  ...(profileRow.social_links || {})
                }
              }
              setProfile(mergedProfile)
              setInitialProfile(mergedProfile)
            }
          } catch (e) {
            console.error('Error loading profile row', e)
          }

          try {
            const { data: roleRow } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .maybeSingle()
            if (roleRow?.role) setRole(roleRow.role)
          } catch {}

          if (config.supabase.isConfigured) {
            try {
              const now = new Date()
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const thirtyDaysAgo = new Date(now)
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

              const [salesResult, activityResult] = await Promise.all([
                supabase
                  .from('sales')
                  .select('id,created_at,user_id')
                  .eq('user_id', user.id)
                  .gte('created_at', thirtyDaysAgo.toISOString()),
                supabase.rpc('get_user_activity', {
                  p_user_id: user.id,
                  p_limit: 500
                })
              ])

              const salesRows = (salesResult.data || []) as Array<{ id: string; created_at?: string | null }>
              const activityRows = (activityResult.data || []) as Array<{
                id: string
                action: string
                created_at: string
                details?: any
              }>

              const totalSales = salesRows.length

              const thirtyDaysAgoMs = thirtyDaysAgo.getTime()
              const taskActions = new Set([
                'create',
                'update',
                'delete',
                'bulk_operation',
                'data_export',
                'password_change',
                'role_change'
              ])

              const tasksInPeriod = activityRows.filter(row => {
                const createdTime = new Date(row.created_at).getTime()
                if (Number.isNaN(createdTime) || createdTime < thirtyDaysAgoMs) return false
                if (!row.action) return false
                if (row.action === 'login' || row.action === 'login_failed') return false
                if (taskActions.has(row.action)) return true
                if (row.action.startsWith('create_') || row.action.startsWith('update_') || row.action.startsWith('delete_')) {
                  return true
                }
                return false
              })

              const loginEvents = activityRows.filter(
                row => row.action === 'login' || row.action === 'sign_in'
              )
              const loginDays = new Set(
                loginEvents.map(row => {
                  const d = new Date(row.created_at)
                  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
                }).filter((v): v is string => v !== null)
              )

              let loginStreak = 0
              const cursor = new Date(todayStart)
              while (true) {
                const key = cursor.toISOString().slice(0, 10)
                if (loginDays.has(key)) {
                  loginStreak += 1
                  cursor.setDate(cursor.getDate() - 1)
                } else {
                  break
                }
              }

              const lastSaleTime = salesRows.reduce<number | null>((acc, row) => {
                if (!row.created_at) return acc
                const t = new Date(row.created_at).getTime()
                if (Number.isNaN(t)) return acc
                if (acc === null || t > acc) return t
                return acc
              }, null)

              const lastActivityTime = activityRows.reduce<number | null>((acc, row) => {
                const t = new Date(row.created_at).getTime()
                if (Number.isNaN(t)) return acc
                if (acc === null || t > acc) return t
                return acc
              }, null)

              const latestTs = [lastSaleTime, lastActivityTime].reduce<number | null>((acc, value) => {
                if (value === null) return acc
                if (acc === null || value > acc) return value
                return acc
              }, null)

              let lastActivityLabel = 'Sin actividad reciente'
              if (latestTs !== null) {
                const lastDate = new Date(latestTs)
                lastActivityLabel = `Hace ${formatDistanceToNow(lastDate, { addSuffix: false, locale: es })}`
              }

              setStats({
                totalSales,
                completedTasks: tasksInPeriod.length,
                loginStreak,
                lastActivity: lastActivityLabel
              })
            } catch (error) {
              console.error('Error loading profile stats', error)
            }
          }
        }
      } catch (e) {
        console.error('Error loading user', e)
      } finally { 
        setLoadingUser(false) 
      }
    }

    const loadPrefs = () => {
      try {
        const raw = localStorage.getItem('profile-preferences')
        if (raw) {
          const parsed = JSON.parse(raw)
          setPrefs({ ...prefs, ...parsed })
          setInitialPrefs({ ...prefs, ...parsed })
        }
      } catch {}
    }

    loadUser()
    loadPrefs()
  }, [supabase])

  useEffect(() => {
    if (!userId || !config.supabase.isConfigured) return

    const loadSessions = async () => {
      try {
        setLoadingSessions(true)
        setSessionsError(null)

        const { data, error } = await supabase.rpc('get_user_activity', {
          p_user_id: userId,
          p_limit: 200
        })

        if (error) {
          console.warn('get_user_activity RPC error while loading sessions', error)
          setSessions([])
          return
        }

        const rows = (data || []) as Array<{
          id: string
          action: string
          created_at: string
          ip_address?: string | null
        }>

        const authEvents = rows
          .filter(row =>
            row.action === 'login' ||
            row.action === 'logout' ||
            row.action === 'login_failed' ||
            row.action === 'account_locked' ||
            row.action === 'sign_in' ||
            row.action === 'sign_out'
          )
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        const sessionsList: UserSessionInfo[] = []
        const openStack: UserSessionInfo[] = []

        for (const ev of authEvents) {
          const isLogin = ev.action === 'login' || ev.action === 'sign_in'
          const isLogout = ev.action === 'logout' || ev.action === 'sign_out'

          if (isLogin) {
            const session: UserSessionInfo = {
              id: ev.id,
              startedAt: ev.created_at,
              ipAddress: ev.ip_address ?? null,
              status: 'active'
            }
            sessionsList.push(session)
            openStack.push(session)
          } else if (isLogout) {
            const lastOpen = openStack.pop()
            if (lastOpen) {
              lastOpen.status = 'closed'
              lastOpen.endedAt = ev.created_at
            }
          }
        }

        setSessions(sessionsList)
      } catch (error) {
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as any).message)
            : String(error)
        console.error('Error loading user sessions', message)
        setSessionsError('No se pudieron cargar las sesiones')
      } finally {
        setLoadingSessions(false)
      }
    }

    loadSessions()
  }, [userId, supabase])

  // Detectar cambios
  useEffect(() => {
    setIsDirty(JSON.stringify(profile) !== JSON.stringify(initialProfile))
  }, [profile, initialProfile])

  useEffect(() => {
    setIsDirtyPrefs(JSON.stringify(prefs) !== JSON.stringify(initialPrefs))
  }, [prefs, initialPrefs])

  const validate = useCallback(() => {
    try {
      profileSchema.parse(profile)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          const path = err.path.join('.')
          newErrors[path] = err.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }, [profile])

  const savePrefs = useCallback(() => {
    try {
      localStorage.setItem('profile-preferences', JSON.stringify(prefs))
      toast.success('Preferencias guardadas')
      setInitialPrefs(prefs)
      setIsDirtyPrefs(false)
    } catch {
      toast.error('Error al guardar preferencias')
    }
  }, [prefs])

  const handleUpdateProfile = useCallback(async () => {
    if (!validate()) {
      toast.error('Por favor, corrige los errores.')
      return
    }
    setLoading(true)
    try {
      if (config.supabase.isConfigured && 'updateUser' in supabase.auth) {
        await supabase.auth.updateUser({
          data: {
            full_name: profile.name,
            phone: profile.phone,
            avatar_url: profile.avatarUrl
          }
        })
      }

      if (userId) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name: profile.name,
            avatar_url: profile.avatarUrl,
            phone: profile.phone,
            department: profile.department,
            job_title: profile.jobTitle,
            location: profile.location,
            bio: profile.bio,
            website: profile.website,
            timezone: profile.timezone,
            social_links: profile.socialLinks
          })
        if (upsertError) throw upsertError
      }
      toast.success('Perfil actualizado')
      setInitialProfile(profile)
      setIsDirty(false)
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }, [profile, userId, supabase, validate])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      toast.success('Sesión cerrada')
      router.push('/login')
      router.refresh()
    } catch (error) {
      toast.error('Error al cerrar sesión')
    } finally {
      setLoading(false)
    }
  }

  const saveAll = useCallback(async () => {
    const tasks: Promise<void>[] = []
    if (isDirty) {
      if (!validate()) {
        toast.error('Corrige los errores antes de guardar.')
      } else {
        tasks.push(handleUpdateProfile())
      }
    }
    if (isDirtyPrefs) {
      savePrefs()
    }
    if (!isDirty && !isDirtyPrefs) {
      toast.info('No hay cambios para guardar')
    }
    await Promise.all(tasks)
  }, [isDirty, isDirtyPrefs, validate, handleUpdateProfile, savePrefs])

  // Navegación lateral
  const navItems = [
    { id: 'profile', label: 'Mi Perfil', icon: User },
    { id: 'preferences', label: 'Preferencias', icon: Settings },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'activity', label: 'Actividad', icon: Activity },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-purple-950/20">
      {/* Efectos de fondo decorativos */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-400/20 via-teal-400/20 to-emerald-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container max-w-7xl py-8 mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header ultra moderno con glassmorphism */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-2xl" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-2xl shadow-blue-500/10">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
                Configuración de Cuenta
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
                Administra tu información personal y preferencias del sistema.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {(isDirty || isDirtyPrefs) && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full backdrop-blur-sm">
                  <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Cambios sin guardar</span>
                </div>
              )}
              {(isDirty || isDirtyPrefs) && (
                <Button 
                  onClick={saveAll} 
                  disabled={loading} 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
                >
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar Cambios
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          {/* Sidebar de Navegación ultra moderno */}
          <div className="space-y-6">
            {/* Card de perfil con glassmorphism y gradiente vibrante */}
            <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 opacity-50" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/30 to-pink-400/30 rounded-full blur-2xl" />
              <CardContent className="p-6 relative z-10">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse" />
                    <Avatar className="relative h-24 w-24 border-4 border-white dark:border-slate-900 shadow-2xl ring-4 ring-blue-500/30">
                      <AvatarImage src={profile.avatarUrl || ''} />
                      <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
                        {profile.name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-7 w-7 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center">
                      <div className="h-3 w-3 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <p className="font-bold text-xl truncate bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      {profile.name || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">{profile.email}</p>
                    {role && (
                      <Badge className="mt-2 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none shadow-lg">
                        {role === 'super_admin' ? '👑 Super Admin' : role}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navegación con efectos modernos */}
            <Card className="border-none shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
              <CardContent className="p-3">
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 group",
                        activeSection === item.id 
                          ? "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-blue-500/30 scale-[1.02]" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-950/50 dark:hover:to-purple-950/50 hover:text-slate-900 dark:hover:text-white hover:scale-[1.01]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-all duration-300",
                          activeSection === item.id 
                            ? "bg-white/20" 
                            : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
                        )}>
                          <item.icon className={cn(
                            "h-5 w-5 transition-transform duration-300",
                            activeSection === item.id && "scale-110"
                          )} />
                        </div>
                        {item.label}
                      </div>
                      {activeSection === item.id && (
                        <ChevronRight className="h-5 w-5 animate-pulse" />
                      )}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
            
            {/* Botón de cerrar sesión con estilo moderno */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 backdrop-blur-xl hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-3">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/50 transition-all duration-300 hover:scale-[1.02] group"
                >
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                    <LogOut className="h-5 w-5" />
                  </div>
                  Cerrar Sesión
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Contenido Principal con animaciones mejoradas */}
          <div className="space-y-6">
            {activeSection === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
                {/* Información Pública con glassmorphism */}
                <Card className="border-none shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl relative">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
                  <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-b border-blue-200/50 dark:border-blue-800/50 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          Información Pública
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                          Esta información será visible para otros usuarios.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6 relative z-10">
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="flex-shrink-0">
                        <AvatarUpload
                          currentAvatarUrl={profile.avatarUrl}
                          userName={profile.name}
                          userId={userId}
                          userEmail={profile.email}
                          onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                          size="lg"
                        />
                      </div>
                      <div className="grid gap-5 flex-1 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                              <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            Nombre Completo
                          </Label>
                          <Input 
                            value={profile.name} 
                            onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                            placeholder="Tu nombre" 
                            className="border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded">
                              <Briefcase className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            Cargo / Título
                          </Label>
                          <Input 
                            value={profile.jobTitle} 
                            onChange={(e) => setProfile(p => ({ ...p, jobTitle: e.target.value }))}
                            placeholder="Ej. Desarrollador" 
                            className="border-2 border-slate-200 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-11"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Biografía</Label>
                          <Textarea 
                            value={profile.bio} 
                            onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                            placeholder="Escribe algo sobre ti..." 
                            rows={3}
                            className="resize-none border-2 border-slate-200 dark:border-slate-700 focus:border-pink-500 dark:focus:border-pink-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                          />
                          <p className="text-xs text-right text-slate-500 dark:text-slate-400 font-medium">
                            {profile.bio?.length || 0}/500
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Información de Contacto con colores vibrantes */}
                <Card className="border-none shadow-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl relative">
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-400/20 via-teal-400/20 to-emerald-400/20 rounded-full blur-3xl" />
                  <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-emerald-500/10 border-b border-cyan-200/50 dark:border-cyan-800/50 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-xl shadow-lg">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-2xl bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                        Información de Contacto
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-5 sm:grid-cols-2 pt-6 relative z-10">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                          <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Email
                      </Label>
                      <Input 
                        value={profile.email} 
                        disabled 
                        className="bg-slate-100/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 backdrop-blur-sm h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                          <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        Teléfono
                      </Label>
                      <Input 
                        value={profile.phone} 
                        onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+595..." 
                        className="border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded">
                          <MapPin className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        Ubicación
                      </Label>
                      <Input 
                        value={profile.location} 
                        onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))}
                        placeholder="Ciudad, País" 
                        className="border-2 border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded">
                          <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        Sitio Web
                      </Label>
                      <Input 
                        value={profile.website} 
                        onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                        placeholder="https://..." 
                        className="border-2 border-slate-200 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-11"
                      />
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}

            {activeSection === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
                {/* Apariencia */}
                <Card className="border-none shadow-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-500/10 rounded-lg">
                        <Palette className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Apariencia</CardTitle>
                        <CardDescription>Personaliza cómo se ve la aplicación.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Tema</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'light', icon: Sun, label: 'Claro', color: 'from-yellow-400 to-orange-400' },
                            { value: 'dark', icon: Moon, label: 'Oscuro', color: 'from-indigo-600 to-purple-600' },
                            { value: 'system', icon: Monitor, label: 'Auto', color: 'from-blue-500 to-cyan-500' }
                          ].map((m) => (
                            <button
                              key={m.value}
                              onClick={() => setTheme(m.value as any)}
                              className={cn(
                                "relative p-4 rounded-xl border-2 text-sm font-medium transition-all duration-200 overflow-hidden group",
                                theme === m.value 
                                  ? "border-primary shadow-lg shadow-primary/25 scale-105" 
                                  : "border-border hover:border-primary/50 hover:scale-102"
                              )}
                            >
                              <div className={cn(
                                "absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity",
                                m.color
                              )} />
                              <div className="relative flex flex-col items-center gap-2">
                                <m.icon className={cn(
                                  "h-6 w-6",
                                  theme === m.value ? "text-primary" : "text-muted-foreground"
                                )} />
                                <span className={cn(
                                  "text-xs",
                                  theme === m.value ? "text-primary font-bold" : "text-muted-foreground"
                                )}>
                                  {m.label}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Color de Énfasis</Label>
                        <Select value={colorScheme} onValueChange={(v: any) => setColorScheme(v)}>
                          <SelectTrigger className="border-2 h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">🎨 Por defecto</SelectItem>
                            <SelectItem value="blue">💙 Azul</SelectItem>
                            <SelectItem value="green">💚 Verde</SelectItem>
                            <SelectItem value="purple">💜 Violeta</SelectItem>
                            <SelectItem value="orange">🧡 Naranja</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notificaciones */}
                <Card className="border-none shadow-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Bell className="h-5 w-5 text-amber-600" />
                      </div>
                      <CardTitle className="text-xl">Notificaciones</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {[
                      { key: 'notifications', label: 'Notificaciones en la app', icon: Bell, color: 'text-blue-600' },
                      { key: 'emailNotifications', label: 'Recibir emails', icon: Mail, color: 'text-green-600' },
                      { key: 'pushNotifications', label: 'Notificaciones push', icon: Smartphone, color: 'text-purple-600' },
                      { key: 'marketingEmails', label: 'Correos de marketing', icon: Mail, color: 'text-orange-600' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg bg-muted", item.color)}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <Label className="cursor-pointer font-medium" htmlFor={item.key}>{item.label}</Label>
                        </div>
                        <Switch 
                          id={item.key}
                          checked={(prefs as any)[item.key]} 
                          onCheckedChange={(c) => setPrefs(p => ({ ...p, [item.key]: c }))}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Regional */}
                <Card className="border-none shadow-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Globe className="h-5 w-5 text-emerald-600" />
                      </div>
                      <CardTitle className="text-xl">Regional</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Idioma</Label>
                      <Select value={prefs.language} onValueChange={(v) => setPrefs(p => ({ ...p, language: v }))}>
                        <SelectTrigger className="border-2 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">🇪🇸 Español</SelectItem>
                          <SelectItem value="en">🇺🇸 English</SelectItem>
                          <SelectItem value="pt">🇧🇷 Português</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Zona Horaria</Label>
                      <Select value={profile.timezone} onValueChange={(v) => setProfile(p => ({ ...p, timezone: v }))}>
                        <SelectTrigger className="border-2 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Asuncion">🇵🇾 Asunción (GMT-4)</SelectItem>
                          <SelectItem value="America/Buenos_Aires">🇦🇷 Buenos Aires (GMT-3)</SelectItem>
                          <SelectItem value="UTC">🌍 UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Acceso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Contraseña</p>
                      <p className="text-sm text-muted-foreground">Cambia tu contraseña periódicamente</p>
                    </div>
                    <ChangePasswordDialog />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between opacity-50">
                    <div>
                      <p className="font-medium">Autenticación en 2 Pasos (2FA)</p>
                      <p className="text-sm text-muted-foreground">Próximamente disponible</p>
                    </div>
                    <Switch disabled />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sesiones y dispositivos</CardTitle>
                  <CardDescription>Revisa dónde tienes sesiones activas actualmente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingSessions && (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  )}
                  {!loadingSessions && sessionsError && (
                    <Alert variant="destructive">
                      <AlertDescription>{sessionsError}</AlertDescription>
                    </Alert>
                  )}
                  {!loadingSessions && !sessionsError && (
                    <>
                      {(() => {
                        const activeSessions = sessions.filter(s => s.status === 'active')
                        const closedSessions = sessions.filter(s => s.status === 'closed').slice(-5)
                        const latestActiveId = activeSessions.length ? activeSessions[activeSessions.length - 1].id : null

                        if (activeSessions.length === 0 && closedSessions.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground">
                              No se encontraron sesiones recientes para tu cuenta.
                            </p>
                          )
                        }

                        return (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium">Sesiones abiertas</p>
                                <Badge variant="outline">
                                  {activeSessions.length} {activeSessions.length === 1 ? 'sesión' : 'sesiones'}
                                </Badge>
                              </div>
                              {activeSessions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No hay sesiones abiertas detectadas. La próxima vez que inicies sesión se mostrarán aquí.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {activeSessions.map(session => (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between rounded-lg border bg-muted/60 px-3 py-2"
                                    >
                                      <div>
                                        <p className="text-xs font-medium">
                                          IP {session.ipAddress || 'desconocida'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Inició hace{' '}
                                          {formatDistanceToNow(new Date(session.startedAt), {
                                            addSuffix: true,
                                            locale: es
                                          })}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {latestActiveId === session.id && (
                                          <Badge variant="secondary" className="text-[10px]">
                                            Esta sesión
                                          </Badge>
                                        )}
                                        <Badge className="text-[10px]">Activa</Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {closedSessions.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium mb-2">Historial reciente</p>
                                <div className="space-y-2">
                                  {closedSessions
                                    .slice()
                                    .reverse()
                                    .map(session => {
                                      const end = session.endedAt ? new Date(session.endedAt) : null
                                      const start = new Date(session.startedAt)
                                      const durationMinutes =
                                        end && !Number.isNaN(end.getTime())
                                          ? Math.max(
                                              1,
                                              Math.round((end.getTime() - start.getTime()) / 60000)
                                            )
                                          : null

                                      return (
                                        <div
                                          key={session.id}
                                          className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                                        >
                                          <div>
                                            <p className="text-xs font-medium">
                                              IP {session.ipAddress || 'desconocida'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                              Cerrada{' '}
                                              {end
                                                ? formatDistanceToNow(end, {
                                                    addSuffix: true,
                                                    locale: es
                                                  })
                                                : 'recientemente'}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <Badge variant="outline" className="text-[10px] mb-1">
                                              Cerrada
                                            </Badge>
                                            {durationMinutes && (
                                              <p className="text-[11px] text-muted-foreground">
                                                Duración aprox. {durationMinutes} min
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              {role === 'super_admin' && (
                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                  <CardHeader>
                    <CardTitle className="text-orange-700 dark:text-orange-400">Zona Administrativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Configuración de Almacenamiento</p>
                      <Button variant="outline" size="sm" onClick={() => {
                        toast.promise(fetch('/api/admin/setup-storage', { method: 'POST' }), {
                          loading: 'Configurando...',
                          success: 'Storage configurado',
                          error: 'Error al configurar'
                        })
                      }}>
                        Ejecutar Setup
                      </Button>
                    </div>
                    <div className="mt-4">
                      <StorageDiagnostics />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeSection === 'activity' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Ventas', value: stats.totalSales, icon: TrendingUp, color: 'text-green-500' },
                  { label: 'Tareas', value: stats.completedTasks, icon: CheckCircle, color: 'text-blue-500' },
                  { label: 'Racha', value: `${stats.loginStreak} días`, icon: Zap, color: 'text-orange-500' },
                  { label: 'Activo', value: stats.lastActivity, icon: Clock, color: 'text-purple-500' },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                      <stat.icon className={cn("h-6 w-6", stat.color)} />
                      <div className="text-xl font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Historial Reciente</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
                </CardContent>
              </Card>
            </div>
          )}
          </div>
        </div>
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Tendrás que volver a ingresar tus credenciales para acceder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar Sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
