'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ColorScheme } from '@/contexts/theme-context'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/supabase-storage'
import { config } from '@/lib/config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Camera, Save, RefreshCw, Settings, Key, Eye, EyeOff, Globe, 
  Smartphone, Monitor, Sun, Moon, Zap, Check, X, Edit3, Copy,
  UserCheck, Activity, Clock, Calendar, Star, Award, TrendingUp
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton-loader'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { StorageDiagnostics } from '@/components/admin/storage-diagnostics'

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

const createMockSupabaseClient = () => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: null } }),
    updateUser: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve({ error: null })
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    upsert: () => Promise.resolve({ error: null })
  })
})

export default function UserProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => (config.supabase.isConfigured ? createClient() : createMockSupabaseClient()), [])
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState({
    name: 'Usuario Demo',
    email: 'usuario@demo.com',
    phone: '',
    avatarUrl: '',
    department: '',
    location: '',
    bio: '',
    website: '',
    timezone: 'America/Asuncion'
  })
  const [initialProfile, setInitialProfile] = useState(profile)
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

  // Cargar usuario actual y preferencias
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          const loaded = {
            name: (user.user_metadata?.full_name as string) || 'Usuario',
            email: user.email || 'usuario@email.com',
            phone: (user.user_metadata?.phone as string) || '',
            avatarUrl: (user.user_metadata?.avatar_url as string) || '',
            department: '',
            location: '',
            bio: '',
            website: '',
            timezone: 'America/Asuncion'
          }
          setProfile(loaded)
          setInitialProfile(loaded)

          try {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('name, avatar_url, phone, department, location, bio, website, timezone')
              .eq('id', user.id)
              .maybeSingle()
            if (profileRow) {
              setProfile(p => ({
                ...p,
                name: profileRow.name ?? p.name,
                avatarUrl: profileRow.avatar_url ?? p.avatarUrl,
                phone: profileRow.phone ?? p.phone,
                department: profileRow.department ?? p.department,
                location: profileRow.location ?? p.location,
                bio: profileRow.bio ?? p.bio,
                website: profileRow.website ?? p.website,
                timezone: profileRow.timezone ?? p.timezone
              }))
              setInitialProfile(prev => ({
                ...prev,
                name: profileRow.name ?? prev.name,
                avatarUrl: profileRow.avatar_url ?? prev.avatarUrl,
                phone: profileRow.phone ?? prev.phone,
                department: profileRow.department ?? prev.department,
                location: profileRow.location ?? prev.location,
                bio: profileRow.bio ?? prev.bio,
                website: profileRow.website ?? prev.website,
                timezone: profileRow.timezone ?? prev.timezone
              }))
            }
          } catch {}

          try {
            const { data: roleRow } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .maybeSingle()
            if (roleRow?.role) setRole(roleRow.role)
          } catch {}

          // Cargar estadísticas mock
          setStats({
            totalSales: Math.floor(Math.random() * 100),
            completedTasks: Math.floor(Math.random() * 50),
            loginStreak: Math.floor(Math.random() * 30),
            lastActivity: 'Hace 5 minutos'
          })
        }
      } catch {}
      finally { setLoadingUser(false) }
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

  // Detectar cambios
  useEffect(() => {
    setIsDirty(
      profile.name !== initialProfile.name ||
      profile.phone !== initialProfile.phone ||
      profile.avatarUrl !== initialProfile.avatarUrl ||
      profile.department !== initialProfile.department ||
      profile.location !== initialProfile.location ||
      profile.bio !== initialProfile.bio ||
      profile.website !== initialProfile.website ||
      profile.timezone !== initialProfile.timezone
    )
  }, [profile, initialProfile])

  const validate = useCallback(() => {
    const next: typeof errors = {}
    if (!profile.name.trim()) {
      next.name = 'El nombre es obligatorio.'
    } else if (profile.name.trim().length < 2) {
      next.name = 'El nombre debe tener al menos 2 caracteres.'
    }

    if (profile.phone) {
      const digits = profile.phone.replace(/\D/g, '')
      if (digits.length < 7) {
        next.phone = 'Ingrese un teléfono válido (mínimo 7 dígitos).'
      }
    }

    if (profile.website) {
      try {
        const u = new URL(profile.website)
        if (!/^https?:/.test(u.protocol)) {
          next.website = 'La URL debe ser http(s).'
        }
      } catch {
        next.website = 'Ingrese una URL válida.'
      }
    }

    if (profile.avatarUrl) {
      try {
        const u = new URL(profile.avatarUrl)
        if (!/^https?:/.test(u.protocol)) {
          next.avatarUrl = 'La URL debe ser http(s).'
        }
      } catch {
        next.avatarUrl = 'Ingrese una URL válida.'
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [profile])

  const savePrefs = useCallback(() => {
    try {
      localStorage.setItem('profile-preferences', JSON.stringify(prefs))
      toast.success('Preferencias guardadas correctamente')
      setInitialPrefs(prefs)
      setIsDirtyPrefs(false)
    } catch {
      toast.error('No se pudieron guardar las preferencias')
    }
  }, [prefs])

  const handleUpdateProfile = useCallback(async () => {
    if (!validate()) {
      toast.error('Por favor, corrige los campos marcados.')
      return
    }
    setLoading(true)
    try {
      if (config.supabase.isConfigured && 'updateUser' in supabase.auth) {
        const { error } = await (supabase.auth as unknown as { updateUser: (params: { data: Record<string, unknown> }) => Promise<{ error: { message?: string } | null }> }).updateUser({
          data: {
            full_name: profile.name,
            phone: profile.phone,
            avatar_url: profile.avatarUrl
          }
        })
        if (error) throw error
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
            location: profile.location,
            bio: profile.bio,
            website: profile.website,
            timezone: profile.timezone
          })
        if (upsertError) throw upsertError
      }
      toast.success('Perfil actualizado correctamente')
      setInitialProfile(profile)
      setIsDirty(false)
    } catch (error: unknown) {
      const hasMessage = typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      const message = hasMessage ? (error as { message: string }).message : 'No se pudo actualizar el perfil'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [profile, userId, supabase, validate])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      toast.success('Sesión cerrada correctamente')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
      toast.error('Error al cerrar sesión')
    } finally {
      setLoading(false)
    }
  }

  // Dirty check for prefs
  useEffect(() => {
    setIsDirtyPrefs(
      prefs.notifications !== initialPrefs.notifications ||
      prefs.compactMode !== initialPrefs.compactMode ||
      prefs.language !== initialPrefs.language ||
      prefs.emailNotifications !== initialPrefs.emailNotifications ||
      prefs.pushNotifications !== initialPrefs.pushNotifications ||
      prefs.marketingEmails !== initialPrefs.marketingEmails ||
      prefs.autoSave !== initialPrefs.autoSave ||
      prefs.darkModeSchedule !== initialPrefs.darkModeSchedule
    )
  }, [prefs, initialPrefs])

  const saveAll = useCallback(async () => {
    const tasks: Promise<void>[] = []
    if (isDirty) {
      if (!validate()) {
        toast.error('Corrige los campos del perfil antes de guardar.')
      } else {
        tasks.push((async () => {
          await handleUpdateProfile()
        })())
      }
    }
    if (isDirtyPrefs) {
      savePrefs()
    }
    if (!isDirty && !isDirtyPrefs) {
      toast.message('No hay cambios para guardar')
    }
    await Promise.all(tasks)
  }, [isDirty, isDirtyPrefs, validate, handleUpdateProfile, savePrefs])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveAll])

  const profileCompleteness = useMemo(() => {
    const fields = [
      !!profile.name,
      !!profile.email,
      !!profile.phone,
      !!profile.avatarUrl,
      !!profile.department,
      !!profile.location,
      !!profile.bio,
      !!profile.website
    ]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  }, [profile])

  const copyToClipboard = async (text: string, label: string) => {
    try { 
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado al portapapeles`) 
    } catch { 
      toast.error('No se pudo copiar al portapapeles') 
    }
  }

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompletionMessage = (percentage: number) => {
    if (percentage >= 80) return 'Perfil completo'
    if (percentage >= 60) return 'Casi completo'
    return 'Completa tu perfil'
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header mejorado */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatarUrl || '/avatars/01.svg'} alt={profile.name} />
              <AvatarFallback>{profile.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                {profile.email}
                {role && <Badge variant="secondary">{role}</Badge>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isDirty || isDirtyPrefs) && (
              <Badge variant="outline" className="animate-pulse">
                <Save className="h-3 w-3 mr-1" />
                Cambios sin guardar
              </Badge>
            )}
            <Button 
              size="sm" 
              onClick={saveAll} 
              disabled={!isDirty && !isDirtyPrefs}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Guardar todo
            </Button>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferencias
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Actividad
          </TabsTrigger>
        </TabsList>
        {/* Pestaña de Perfil */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Información básica */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                  {isDirty && <Badge variant="outline" className="animate-pulse">Sin guardar</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingUser ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <SkeletonCard />
                  </div>
                ) : (
                  <>
                    {/* Avatar Section - Optimizado */}
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                      <AvatarUpload
                        currentAvatarUrl={profile.avatarUrl}
                        userName={profile.name}
                        userId={userId}
                        userEmail={profile.email}
                        onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                        size="lg"
                        className="mx-auto sm:mx-0"
                      />
                      
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <h3 className="text-lg font-semibold">{profile.name}</h3>
                          {role && <Badge variant="secondary">{role}</Badge>}
                        </div>
                        <p className="text-muted-foreground">{profile.email}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
                          {profile.department && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {profile.department}
                            </span>
                          )}
                          {profile.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {profile.location}
                            </span>
                          )}
                        </div>
                        
                        {/* Tips para avatar */}
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            💡 <strong>Tips:</strong> Puedes generar avatares únicos con IA o subir tu propia imagen. 
                            Formatos soportados: JPG, PNG, WebP, GIF (máx. 10MB)
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre completo *</Label>
                        <Input 
                          id="name" 
                          value={profile.name} 
                          onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                          className={errors.name ? 'border-red-500' : ''}
                        />
                        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <div className="flex gap-2">
                          <Input id="email" value={profile.email} disabled className="flex-1" />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(profile.email, 'Correo')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="phone" 
                            value={profile.phone} 
                            onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                            placeholder="+595 981 123 456"
                            className={`flex-1 ${errors.phone ? 'border-red-500' : ''}`}
                          />
                          {profile.phone && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => copyToClipboard(profile.phone, 'Teléfono')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Departamento</Label>
                        <Input 
                          id="department" 
                          value={profile.department} 
                          onChange={(e) => setProfile(p => ({ ...p, department: e.target.value }))}
                          placeholder="Ej: Ventas, Técnico, Administración"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">Ubicación</Label>
                        <Input 
                          id="location" 
                          value={profile.location} 
                          onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))}
                          placeholder="Ej: Asunción, Paraguay"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Sitio web</Label>
                        <Input 
                          id="website" 
                          value={profile.website} 
                          onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                          placeholder="https://ejemplo.com"
                          className={errors.website ? 'border-red-500' : ''}
                        />
                        {errors.website && <p className="text-xs text-red-600">{errors.website}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Biografía</Label>
                      <Textarea 
                        id="bio" 
                        value={profile.bio} 
                        onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                        placeholder="Cuéntanos un poco sobre ti..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setProfile(initialProfile)
                          setErrors({})
                        }}
                        disabled={!isDirty}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleUpdateProfile} 
                        disabled={loading || !isDirty}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Guardar cambios
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Estadísticas del perfil */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Estadísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${getCompletionColor(profileCompleteness)}`}>
                      {getCompletionMessage(profileCompleteness)}
                    </span>
                    <span className=
{`text-sm ${getCompletionColor(profileCompleteness)}`}>
                      {profileCompleteness}%
                    </span>
                  </div>
                  <Progress value={profileCompleteness} className="h-2" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Ventas totales</span>
                    </div>
                    <span className="font-semibold">{stats.totalSales}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Tareas completadas</span>
                    </div>
                    <span className="font-semibold">{stats.completedTasks}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Racha de login</span>
                    </div>
                    <span className="font-semibold">{stats.loginStreak} días</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Última actividad</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{stats.lastActivity}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pestaña de Preferencias */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Preferencias de la aplicación
                </CardTitle>
                {isDirtyPrefs && <Badge variant="outline" className="animate-pulse">Sin guardar</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tema y apariencia */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Tema y apariencia
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Claro
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            Oscuro
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            Sistema
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Esquema de colores</Label>
                    <Select value={colorScheme} onValueChange={(value: ColorScheme) => setColorScheme(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Por defecto</SelectItem>
                        <SelectItem value="blue">Azul</SelectItem>
                        <SelectItem value="green">Verde</SelectItem>
                        <SelectItem value="purple">Púrpura</SelectItem>
                        <SelectItem value="orange">Naranja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo compacto</Label>
                    <p className="text-sm text-muted-foreground">Reduce el espaciado en la interfaz</p>
                  </div>
                  <Switch
                    checked={prefs.compactMode}
                    onCheckedChange={(checked) => setPrefs(p => ({ ...p, compactMode: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Programar modo oscuro</Label>
                    <p className="text-sm text-muted-foreground">Cambiar automáticamente según la hora</p>
                  </div>
                  <Switch
                    checked={prefs.darkModeSchedule}
                    onCheckedChange={(checked) => setPrefs(p => ({ ...p, darkModeSchedule: checked }))}
                  />
                </div>
              </div>

              <Separator />

              {/* Notificaciones */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificaciones
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones generales</Label>
                      <p className="text-sm text-muted-foreground">Recibir notificaciones de la aplicación</p>
                    </div>
                    <Switch
                      checked={prefs.notifications}
                      onCheckedChange={(checked) => setPrefs(p => ({ ...p, notifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones por correo</Label>
                      <p className="text-sm text-muted-foreground">Recibir actualizaciones por email</p>
                    </div>
                    <Switch
                      checked={prefs.emailNotifications}
                      onCheckedChange={(checked) => setPrefs(p => ({ ...p, emailNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones push</Label>
                      <p className="text-sm text-muted-foreground">Notificaciones del navegador</p>
                    </div>
                    <Switch
                      checked={prefs.pushNotifications}
                      onCheckedChange={(checked) => setPrefs(p => ({ ...p, pushNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Emails de marketing</Label>
                      <p className="text-sm text-muted-foreground">Promociones y novedades</p>
                    </div>
                    <Switch
                      checked={prefs.marketingEmails}
                      onCheckedChange={(checked) => setPrefs(p => ({ ...p, marketingEmails: checked }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Configuración general */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Configuración general
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={prefs.language} onValueChange={(value) => setPrefs(p => ({ ...p, language: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Zona horaria</Label>
                    <Select value={profile.timezone} onValueChange={(value) => setProfile(p => ({ ...p, timezone: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Asuncion">Asunción (GMT-3)</SelectItem>
                        <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                        <SelectItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                        <SelectItem value="America/Santiago">Santiago (GMT-3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Guardado automático</Label>
                    <p className="text-sm text-muted-foreground">Guardar cambios automáticamente</p>
                  </div>
                  <Switch
                    checked={prefs.autoSave}
                    onCheckedChange={(checked) => setPrefs(p => ({ ...p, autoSave: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPrefs(initialPrefs)
                  }}
                  disabled={!isDirtyPrefs}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={savePrefs} 
                  disabled={!isDirtyPrefs}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar preferencias
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Seguridad */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Seguridad de la cuenta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Contraseña</Label>
                      <p className="text-sm text-muted-foreground">Última actualización hace 30 días</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Cambiar
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Autenticación de dos factores</Label>
                      <p className="text-sm text-muted-foreground">Añade una capa extra de seguridad</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sesiones activas</Label>
                      <p className="text-sm text-muted-foreground">Gestiona tus dispositivos conectados</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Monitor className="h-4 w-4 mr-2" />
                      Ver sesiones
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Privacidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Tu información está protegida y nunca será compartida con terceros sin tu consentimiento.
                  </AlertDescription>
                </Alert>

                {/* Sección de configuración de storage para administradores */}
                {role === 'super_admin' && (
                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>Configurar almacenamiento de archivos</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/admin/setup-storage', {
                              method: 'POST'
                            })
                            if (response.ok) {
                              toast.success('Storage configurado correctamente')
                            } else {
                              const error = await response.text()
                              toast.error(`Error: ${error}`)
                            }
                          } catch (error) {
                            toast.error('Error al configurar storage')
                          }
                        }}
                      >
                        Configurar Storage
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Descargar mis datos</Label>
                      <p className="text-sm text-muted-foreground">Obtén una copia de tu información</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Descargar
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Eliminar cuenta</Label>
                      <p className="text-sm text-muted-foreground">Eliminar permanentemente tu cuenta</p>
                    </div>
                    <Button variant="destructive" size="sm">
                      Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Diagnóstico de storage para super admins */}
          {role === 'super_admin' && (
            <StorageDiagnostics />
          )}
        </TabsContent>

        {/* Pestaña de Actividad */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Actividad reciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecentActivity />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Resumen mensual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalSales}</div>
                    <div className="text-sm text-muted-foreground">Ventas este mes</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
                    <div className="text-sm text-muted-foreground">Tareas completadas</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Productividad</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Objetivos alcanzados</span>
                    <span>7/10</span>
                  </div>
                  <Progress value={70} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar sesión</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres cerrar tu sesión?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cerrando...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}