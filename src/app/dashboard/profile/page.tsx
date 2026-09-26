'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { config } from '@/lib/config'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Activity,
  ChevronRight,
  Copy,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  User,
  Building2,
  Check
} from 'lucide-react'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton-loader'
import { SecuritySection } from '@/components/profile/security-section'
import { DashboardProfileForm } from '@/components/profile/dashboard-profile-form'
import { DashboardPreferencesForm } from '@/components/profile/dashboard-preferences-form'
import { DashboardActivitySection } from '@/components/profile/dashboard-activity-section'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { logAndTranslateError } from '@/lib/error-translator'
import { logger } from '@/lib/logger'

export const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email invalido').refine((email) => {
    const [, domain] = email.split('@')
    return domain && domain.includes('.') && domain.split('.').every(part => part.length > 0)
  }, 'El dominio del email no es valido'),
  phone: z.string().nullish().or(z.literal('')),
  avatarUrl: z.string().nullish().or(z.literal('')),
  department: z.string().nullish().or(z.literal('')),
  jobTitle: z.string().nullish().or(z.literal('')),
  location: z.string().nullish().or(z.literal('')),
  bio: z.string().max(500, 'Maximo 500 caracteres').nullish().or(z.literal('')),
  website: z.union([z.string().url('URL invalida'), z.literal(''), z.null(), z.undefined()]).optional(),
  timezone: z.string().nullish().or(z.literal(''))
})

export type UserProfile = z.infer<typeof profileSchema>
export type SectionId = 'profile' | 'preferences' | 'security' | 'activity'
export type NotificationKey = 'notifications' | 'emailNotifications' | 'pushNotifications' | 'marketingEmails'

export interface ProfilePreferences {
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

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  department: '',
  jobTitle: '',
  location: '',
  bio: '',
  website: '',
  timezone: 'America/Asuncion'
}

const DEFAULT_PREFS: ProfilePreferences = {
  notifications: true,
  compactMode: false,
  language: 'es',
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
  autoSave: true,
  darkModeSchedule: false
}

export default function UserProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { refreshUser } = useAuth()
  const { organization: activeOrg } = useOptionalActiveOrganization()

  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>('profile')

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [initialProfile, setInitialProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  const [prefs, setPrefs] = useState<ProfilePreferences>(DEFAULT_PREFS)
  const [initialPrefs, setInitialPrefs] = useState<ProfilePreferences>(DEFAULT_PREFS)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const [stats, setStats] = useState<ProfileStats>({
    totalSales: 0,
    completedTasks: 0,
    loginStreak: 0,
    lastActivity: 'Sin actividad reciente'
  })

  const roleLabel = useMemo(() => {
    if (!role) return 'Usuario'
    const map: Record<string, string> = {
      super_admin: 'Super Administrador',
      admin: 'Administrador',
      tecnico: 'Tecnico',
      technician: 'Tecnico',
      vendedor: 'Vendedor',
      manager: 'Gerente',
      employee: 'Empleado',
      client_normal: 'Cliente',
      client_mayorista: 'Cliente Mayorista',
      viewer: 'Visualizador'
    }
    return map[role] || role.charAt(0).toUpperCase() + role.slice(1)
  }, [role])

  const isDirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(initialProfile), [profile, initialProfile])
  const isDirtyPrefs = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(initialPrefs), [prefs, initialPrefs])
  const hasPendingChanges = isDirty || isDirtyPrefs

  const profileCompletion = useMemo(() => {
    const fields: (keyof UserProfile)[] = [
      'name',
      'email',
      'phone',
      'avatarUrl',
      'department',
      'jobTitle',
      'location',
      'bio'
    ]
    const filled = fields.filter((f) => {
      const val = profile[f]
      return typeof val === 'string' && val.trim().length > 0
    }).length
    return Math.round((filled / fields.length) * 100)
  }, [profile])

  const copyUserId = useCallback(() => {
    if (userId) {
      navigator.clipboard.writeText(userId)
      setCopiedId(true)
      toast.success('ID de usuario copiado')
      setTimeout(() => setCopiedId(false), 2000)
    }
  }, [userId])

  const handleDiscardChanges = useCallback(() => {
    setProfile(initialProfile)
    setPrefs(initialPrefs)
    setErrors({})
    toast.info('Cambios descartados')
  }, [initialProfile, initialPrefs])

  useEffect(() => {
    const loadUser = async (): Promise<Record<string, unknown> | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        setUserId(user.id)

        const baseProfile: UserProfile = {
          ...DEFAULT_PROFILE,
          name: (user.user_metadata?.full_name as string) || 'Usuario',
          email: user.email || '',
          phone: (user.user_metadata?.phone as string) || '',
          avatarUrl: (user.user_metadata?.avatar_url as string) || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_PROFILE.timezone
        }

        if (!config.supabase.isConfigured) {
          setProfile(baseProfile)
          setInitialProfile(baseProfile)
          return null
        }

        try {
          const { data: summary, error } = await supabase.rpc('get_profile_summary', { p_user_id: user.id })

          if (error || !summary) {
            setProfile(baseProfile)
            setInitialProfile(baseProfile)
            return null
          }

          if (summary.role) setRole(summary.role)

          const profileRow = summary.profile
          const mergedProfile: UserProfile = profileRow ? {
            ...baseProfile,
            name: profileRow.full_name ?? profileRow.name ?? baseProfile.name,
            avatarUrl: profileRow.avatar_url ?? baseProfile.avatarUrl,
            phone: profileRow.phone ?? baseProfile.phone,
            department: profileRow.department ?? baseProfile.department,
            jobTitle: profileRow.job_title ?? baseProfile.jobTitle,
            location: profileRow.location ?? baseProfile.location,
            bio: profileRow.bio ?? baseProfile.bio,
            website: profileRow.website ?? baseProfile.website,
            timezone: profileRow.timezone ?? baseProfile.timezone
          } : baseProfile

          setProfile(mergedProfile)
          setInitialProfile(mergedProfile)

          const statsData = summary.stats
          let lastActivityLabel = 'Sin actividad reciente'
          if (statsData.lastActivity) {
            const lastDate = new Date(statsData.lastActivity)
            if (!isNaN(lastDate.getTime())) {
              lastActivityLabel = `Hace ${formatDistanceToNow(lastDate, { addSuffix: false, locale: es })}`
            }
          }

          setStats({
            totalSales: statsData.totalSales || 0,
            completedTasks: statsData.completedTasks || 0,
            loginStreak: statsData.loginStreak || 0,
            lastActivity: lastActivityLabel
          })

          // Retornar profileRow para que loadPrefsFromRow pueda leer preferences
          return (profileRow as Record<string, unknown>) ?? null
        } catch (rpcError) {
          logger.error('Error fetching profile summary', { error: rpcError })
          setProfile(baseProfile)
          setInitialProfile(baseProfile)
          return null
        }
      } catch (e) {
        logger.error('Error loading user', { error: e })
        return null
      } finally {
        setLoadingUser(false)
      }
    }

    // loadPrefs: lee primero del JSONB profiles.preferences (vía la RPC ya ejecutada),
    // con localStorage como caché offline. Si hay datos de Supabase los usa; si no,
    // intenta localStorage; si tampoco hay, usa DEFAULT_PREFS.
    const loadPrefsFromRow = (profileRow: Record<string, unknown> | null) => {
      try {
        // 1. Intentar desde la columna preferences de la BD
        const dbPrefs = profileRow?.preferences as Record<string, unknown> | null | undefined
        if (dbPrefs && typeof dbPrefs === 'object' && Object.keys(dbPrefs).length > 0) {
          const merged = { ...DEFAULT_PREFS, ...dbPrefs }
          setPrefs(merged as ProfilePreferences)
          setInitialPrefs(merged as ProfilePreferences)
          // Sincronizar cache local
          localStorage.setItem('profile-preferences', JSON.stringify(merged))
          return
        }
        // 2. Fallback a localStorage (para usuarios que ya tenían datos guardados)
        const raw = localStorage.getItem('profile-preferences')
        if (!raw) return
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const merged = { ...DEFAULT_PREFS, ...parsed }
        setPrefs(merged as ProfilePreferences)
        setInitialPrefs(merged as ProfilePreferences)
      } catch {
        // no-op — defaults ya aplicados
      }
    }

    loadUser().then((profileRow) => {
      loadPrefsFromRow(profileRow ?? null)
    })
  }, [supabase])

  const validate = useCallback(() => {
    try {
      profileSchema.parse(profile)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const nextErrors: Record<string, string> = {}
        error.issues.forEach((err) => {
          nextErrors[err.path.join('.')] = err.message
        })
        setErrors(nextErrors)
      }
      return false
    }
  }, [profile])

  const savePrefs = useCallback(async (): Promise<boolean> => {
    try {
      // 1. Persistir en localStorage como caché offline rápido
      localStorage.setItem('profile-preferences', JSON.stringify(prefs))
      setInitialPrefs(prefs)

      // 2. Persistir en Supabase para que sea portable entre dispositivos
      if (userId && config.supabase.isConfigured) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({ id: userId, preferences: prefs, updated_at: new Date().toISOString() })
        if (upsertError) {
          // No es crítico: localStorage ya tiene los datos. Solo loguear.
          logger.warn('No se pudieron guardar las preferencias en la nube:', upsertError)
        }
      }
      return true
    } catch {
      return false
    }
  }, [prefs, userId, supabase])

  const handleUpdateProfile = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      toast.error('No se pudo identificar al usuario. Recarga la pagina.')
      return false
    }
    if (!validate()) return false

    const normalizedProfile = {
      ...profile,
      name: profile.name.trim(),
      phone: profile.phone?.trim() || '',
      website: profile.website?.trim() || '',
      department: profile.department?.trim() || '',
      jobTitle: profile.jobTitle?.trim() || '',
      location: profile.location?.trim() || '',
      bio: profile.bio?.trim() || ''
    }

    try {
      const payload = {
        email: normalizedProfile.email,
        full_name: normalizedProfile.name,
        avatar_url: normalizedProfile.avatarUrl,
        phone: normalizedProfile.phone,
        department: normalizedProfile.department,
        job_title: normalizedProfile.jobTitle,
        location: normalizedProfile.location,
        bio: normalizedProfile.bio,
        website: normalizedProfile.website,
        timezone: normalizedProfile.timezone,
        updated_at: new Date().toISOString()
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...payload })

      if (upsertError) throw upsertError

      if (config.supabase.isConfigured && 'updateUser' in supabase.auth) {
        const hasAuthChanges = 
           normalizedProfile.name !== initialProfile.name ||
           normalizedProfile.phone !== initialProfile.phone ||
           normalizedProfile.avatarUrl !== initialProfile.avatarUrl;

        if (hasAuthChanges) {
            supabase.auth.updateUser({
              data: {
                full_name: normalizedProfile.name,
                phone: normalizedProfile.phone,
                avatar_url: normalizedProfile.avatarUrl
              }
            }).then(({ error }) => {
              if (error) {
                console.warn('Error actualizando metadatos de Auth (no crítico):', error)
              } else {
                console.log('Metadatos de Auth actualizados en segundo plano')
              }
            }).catch(err => {
                 console.warn('Error en llamada a updateUser:', err)
            })
        }
      }

      setInitialProfile(normalizedProfile)
      refreshUser().catch(err => console.warn('Error refreshing auth user:', err))
      return true
    } catch (error: unknown) {
      const userMessage = logAndTranslateError(error, 'Profile Update')
      toast.error(userMessage)
      return false
    }
  }, [profile, userId, supabase, validate, initialProfile, refreshUser])

  const saveAll = useCallback(async () => {
    setLoading(true)
    try {
      if (!hasPendingChanges) {
        toast.info('No hay cambios para guardar')
        return
      }

      if (isDirty && !validate()) {
        toast.error('Corrige los errores antes de guardar')
        return
      }

      let profileSaved = false
      let prefsSaved = false

      if (isDirty) profileSaved = await handleUpdateProfile()
      if (isDirtyPrefs) prefsSaved = await savePrefs()

      const allOk = (!isDirty || profileSaved) && (!isDirtyPrefs || prefsSaved)
      if (allOk) toast.success('Configuracion guardada correctamente')
      else if (profileSaved || prefsSaved) toast.warning('Se guardo parcialmente la configuracion')
      else toast.error('No se pudieron guardar los cambios')
    } finally {
      setLoading(false)
    }
  }, [handleUpdateProfile, hasPendingChanges, isDirty, isDirtyPrefs, savePrefs, validate])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      toast.success('Sesion cerrada')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Error al cerrar sesion')
    } finally {
      setLoading(false)
    }
  }

  const navItems: { id: SectionId; label: string; icon: typeof User; hint: string }[] = [
    { id: 'profile', label: 'Mi perfil', icon: User, hint: 'Datos personales y contacto' },
    { id: 'preferences', label: 'Preferencias', icon: Settings, hint: 'Tema, idioma y alertas' },
    { id: 'security', label: 'Seguridad', icon: Shield, hint: 'Password y sesiones' },
    { id: 'activity', label: 'Actividad', icon: Activity, hint: 'Metricas e historial' }
  ]

  if (loadingUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header Banner */}
      <Card className="border-border/60 bg-gradient-to-r from-card via-card to-muted/30 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Panel de Cuenta</span>
              </div>

              {activeOrg && (
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs font-normal">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold">{activeOrg.name}</span>
                  {activeOrg.role && (
                    <span className="text-muted-foreground">· {activeOrg.role}</span>
                  )}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Perfil y Configuración
            </h1>
            <p className="text-sm text-muted-foreground">
              Administra tu información personal, presencia profesional, seguridad y preferencias del sistema.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {hasPendingChanges && (
              <>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse">
                  Cambios sin guardar
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardChanges}
                  disabled={loading}
                  className="text-xs"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Descartar
                </Button>
              </>
            )}
            <Button onClick={saveAll} disabled={loading || !hasPendingChanges} className="shadow-sm">
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar con scroll independiente */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
          {/* User Identity Card */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent" />
            <CardContent className="space-y-4 p-5 -mt-10">
              <div className="flex items-end justify-between">
                <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                  <AvatarImage src={profile.avatarUrl || ''} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {profile.name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <Badge variant="outline" className="text-xs py-1 px-2.5 font-medium border-primary/30 text-primary bg-primary/5">
                  {roleLabel}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {profile.name || 'Usuario'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.email || 'Sin email'}
                </p>
                {userId && (
                  <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ID: {userId.slice(0, 8)}...
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyUserId}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                      title="Copiar ID de usuario"
                    >
                      {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Completion Meter */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Progreso del perfil
                </span>
                <span className={cn(
                  "font-bold font-mono",
                  profileCompletion === 100 ? "text-emerald-600" : "text-primary"
                )}>
                  {profileCompletion}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    profileCompletion === 100
                      ? "bg-emerald-500"
                      : profileCompletion > 60
                      ? "bg-primary"
                      : "bg-amber-500"
                  )}
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {profileCompletion === 100
                  ? '¡Tu perfil está completo con todos los datos clave!'
                  : 'Completa tu información para optimizar la interacción con tu equipo y clientes.'}
              </p>
            </CardContent>
          </Card>

          {/* Navigation Card */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-2">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-muted/70 text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className="h-4 w-4" />}
                      </div>
                      <p className={cn(
                        'mt-0.5 text-xs',
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}>
                        {item.hint}
                      </p>
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>

          <Button variant="destructive" className="w-full shadow-sm" onClick={() => setShowLogoutConfirm(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </aside>

        {/* Main Content Area */}
        <section className="space-y-6">
          {activeSection === 'profile' && (
            <DashboardProfileForm 
              profile={profile}
              setProfile={setProfile}
              errors={errors}
              userId={userId}
              roleLabel={roleLabel}
              onAvatarChange={(url) => {
                setInitialProfile((p) => ({ ...p, avatarUrl: url }))
                refreshUser().catch(err => console.warn('Error refreshing auth user:', err))
              }}
            />
          )}

          {activeSection === 'preferences' && (
            <DashboardPreferencesForm 
              prefs={prefs}
              setPrefs={setPrefs}
              profile={profile}
              setProfile={setProfile}
            />
          )}

          {activeSection === 'security' && <SecuritySection userId={userId} role={role} />}

          {activeSection === 'activity' && <DashboardActivitySection stats={stats} />}
        </section>
      </div>

      {/* Floating Bottom Quick Save Bar */}
      {hasPendingChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 text-white dark:bg-slate-800/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700/80">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-200 whitespace-nowrap">Cambios sin guardar</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscardChanges}
            disabled={loading}
            className="text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 h-8 px-2.5"
          >
            Descartar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveAll}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-3 shadow-sm whitespace-nowrap"
          >
            {loading ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Guardar cambios
          </Button>
        </div>
      )}

      {/* Modal Confirm Logout */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Tendrás que volver a ingresar tus credenciales para acceder a la plataforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
