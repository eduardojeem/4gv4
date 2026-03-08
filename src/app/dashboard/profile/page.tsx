
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  LogOut,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
  User
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

  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>('profile')

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [initialProfile, setInitialProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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
          return
        }

        try {
          const { data: summary, error } = await supabase.rpc('get_profile_summary', { p_user_id: user.id })

          if (error || !summary) {
            setProfile(baseProfile)
            setInitialProfile(baseProfile)
            return
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
        } catch (rpcError) {
          logger.error('Error fetching profile summary', { error: rpcError })
          setProfile(baseProfile)
          setInitialProfile(baseProfile)
        }
      } catch (e) {
        logger.error('Error loading user', { error: e })
      } finally {
        setLoadingUser(false)
      }
    }

    const loadPrefs = () => {
      try {
        const raw = localStorage.getItem('profile-preferences')
        if (!raw) return
        const parsed = JSON.parse(raw)
        const merged = { ...DEFAULT_PREFS, ...parsed }
        setPrefs(merged)
        setInitialPrefs(merged)
      } catch {
        // no-op
      }
    }

    loadUser()
    loadPrefs()
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

  const savePrefs = useCallback((): boolean => {
    try {
      localStorage.setItem('profile-preferences', JSON.stringify(prefs))
      setInitialPrefs(prefs)
      return true
    } catch {
      return false
    }
  }, [prefs])

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
      // 1. Actualizar tabla Profiles (Fuente de la verdad para la UI)
      // Priorizamos esto para que el usuario vea los cambios rápido
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

      // 2. Actualizar metadatos de Auth en segundo plano (Best Effort)
      // No bloqueamos la UI si esto tarda o falla, ya que es secundario
      if (config.supabase.isConfigured && 'updateUser' in supabase.auth) {
        // Solo actualizar si hay cambios relevantes para Auth
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
      return true
    } catch (error: unknown) {
      const userMessage = logAndTranslateError(error, 'Profile Update')
      toast.error(userMessage)
      return false
    }
  }, [profile, userId, supabase, validate, initialProfile])

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
      if (isDirtyPrefs) prefsSaved = savePrefs()

      const allOk = (!isDirty || profileSaved) && (!isDirtyPrefs || prefsSaved)
      if (allOk) toast.success('Configuracion guardada')
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
          <Skeleton className="mb-6 h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <Card className="mb-6 border-slate-200/70 bg-gradient-to-r from-white to-slate-100 dark:from-slate-900 dark:to-slate-900/70">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5" />
                Dashboard / Cuenta
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Perfil y configuracion
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Administra tus datos, preferencias y seguridad desde un solo lugar.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasPendingChanges && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Cambios sin guardar
                </Badge>
              )}
              <Button onClick={saveAll} disabled={loading || !hasPendingChanges}>
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border border-slate-200 dark:border-slate-700">
                    <AvatarImage src={profile.avatarUrl || ''} />
                    <AvatarFallback>{profile.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.name || 'Usuario'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.email || 'Sin email'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-full justify-center py-1.5">
                  {roleLabel}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                        activeSection === item.id
                          ? 'bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        {activeSection === item.id && <ChevronRight className="h-4 w-4" />}
                      </div>
                      <p className={cn('mt-1 text-xs', activeSection === item.id ? 'text-slate-200 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400')}>
                        {item.hint}
                      </p>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>

            <Button variant="destructive" className="w-full" onClick={() => setShowLogoutConfirm(true)}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesion
            </Button>
          </aside>

          <section className="space-y-6">
            {activeSection === 'profile' && (
              <DashboardProfileForm 
                profile={profile}
                setProfile={setProfile}
                errors={errors}
                userId={userId}
                roleLabel={roleLabel}
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
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar sesion?</DialogTitle>
            <DialogDescription>
              Tendras que volver a ingresar tus credenciales para acceder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar sesion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
