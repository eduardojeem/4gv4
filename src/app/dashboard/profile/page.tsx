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
import { toast } from 'sonner'
import { useTheme } from '@/contexts/theme-context'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Mail, Phone, User, LogOut, Palette, Shield, Bell, Building2, MapPin } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton-loader'
import { Switch } from '@/components/ui/switch'

interface ProfilePreferences {
  notifications: boolean
  compactMode: boolean
  language: string
}

export default function UserProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => (config.supabase.isConfigured ? createClient() : createMockSupabaseClient()), [])
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [profile, setProfile] = useState({
    name: 'Usuario Demo',
    email: 'usuario@demo.com',
    phone: '',
    avatarUrl: '',
    department: '',
    location: ''
  })
  const [initialProfile, setInitialProfile] = useState(profile)
  const [errors, setErrors] = useState<{ name?: string; phone?: string; avatarUrl?: string }>({})
  const [isDirty, setIsDirty] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showCropConfirm, setShowCropConfirm] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null)
  const [cropSquare, setCropSquare] = useState(true)
  const [rotateDeg, setRotateDeg] = useState(0)
  const [prefs, setPrefs] = useState<ProfilePreferences>({
    notifications: true,
    compactMode: false,
    language: 'es'
  })
  const [initialPrefs, setInitialPrefs] = useState<ProfilePreferences>(prefs)
  const [isDirtyPrefs, setIsDirtyPrefs] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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
            location: ''
          }
          setProfile(loaded)
          setInitialProfile(loaded)

          try {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('name, avatar_url, phone, department, location')
              .eq('id', user.id)
              .maybeSingle()
            if (profileRow) {
              setProfile(p => ({
                ...p,
                name: profileRow.name ?? p.name,
                avatarUrl: profileRow.avatar_url ?? p.avatarUrl,
                phone: profileRow.phone ?? p.phone,
                department: profileRow.department ?? p.department,
                location: profileRow.location ?? p.location
              }))
              setInitialProfile(prev => ({
                ...prev,
                name: profileRow.name ?? prev.name,
                avatarUrl: profileRow.avatar_url ?? prev.avatarUrl,
                phone: profileRow.phone ?? prev.phone,
                department: profileRow.department ?? prev.department,
                location: profileRow.location ?? prev.location
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
        }
      } catch {}
      finally { setLoadingUser(false) }
    }

    const loadPrefs = () => {
      try {
        const raw = localStorage.getItem('profile-preferences')
        if (raw) {
          const parsed = JSON.parse(raw)
          setPrefs(parsed)
          setInitialPrefs(parsed)
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
      profile.location !== initialProfile.location
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

    if (profile.avatarUrl) {
      try {
        // URL básica
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
      toast.success('Preferencias guardadas')
      setInitialPrefs(prefs)
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
            location: profile.location
          })
        if (upsertError) throw upsertError
      }
      toast.success('Perfil actualizado')
      setInitialProfile(profile)
    } catch (error: unknown) {
      const hasMessage = typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      const message = hasMessage ? (error as { message: string }).message : 'No se pudo actualizar el perfil'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [profile, userId, supabase, validate])

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatarUrl: 'El archivo debe ser una imagen.' }))
      return
    }
    const maxSizeMB = 3
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`La imagen supera ${maxSizeMB}MB`)
      return
    }

    setErrors(prev => ({ ...prev, avatarUrl: undefined }))
    setPendingAvatarFile(file)
    const url = URL.createObjectURL(file)
    setPendingAvatarUrl(url)
    setCropSquare(true)
    setRotateDeg(0)
    setShowCropConfirm(true)
  }

  const processAvatar = async (file: File, opts: { cropSquare: boolean; rotate: number }) => {
    const arrayBuffer = await file.arrayBuffer()
    const img = document.createElement('img')
    const dataUrl = URL.createObjectURL(new Blob([arrayBuffer]))
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('error'))
      img.src = dataUrl
    })
    URL.revokeObjectURL(dataUrl)
    const originalWidth = img.naturalWidth
    const originalHeight = img.naturalHeight
    const maxWidth = 512
    let targetW = Math.min(maxWidth, originalWidth)
    let targetH = Math.round((originalHeight / originalWidth) * targetW)
    let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight
    if (opts.cropSquare) {
      const side = Math.min(originalWidth, originalHeight)
      sx = Math.floor((originalWidth - side) / 2)
      sy = Math.floor((originalHeight - side) / 2)
      sWidth = side
      sHeight = side
      targetW = Math.min(maxWidth, side)
      targetH = targetW
    }
    const rotated = (Math.round(opts.rotate) % 360 + 360) % 360
    const willRotate = rotated === 90 || rotated === 270
    const canvas = document.createElement('canvas')
    canvas.width = willRotate ? targetH : targetW
    canvas.height = willRotate ? targetW : targetH
    const ctx = canvas.getContext('2d')!
    if (rotated) {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotated * Math.PI) / 180)
      ctx.translate(-canvas.height / 2, -canvas.width / 2)
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, willRotate ? targetH : targetW, willRotate ? targetW : targetH)
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob(
        (b) => resolve(b as Blob),
        'image/webp',
        0.9
      )
    )
    return new File([blob], 'avatar.webp', { type: 'image/webp' })
  }

  const confirmCropAndUpload = async () => {
    if (!pendingAvatarFile) return
    try {
      setIsUploadingAvatar(true)
      const processed = await processAvatar(pendingAvatarFile, { cropSquare, rotate: rotateDeg })
      if (!config.supabase.isConfigured || !userId) {
        const localUrl = URL.createObjectURL(processed)
        setProfile(p => ({ ...p, avatarUrl: localUrl }))
        toast.info('Modo demo: imagen procesada')
        setShowCropConfirm(false)
        setPendingAvatarFile(null)
        if (pendingAvatarUrl) { URL.revokeObjectURL(pendingAvatarUrl); setPendingAvatarUrl(null) }
        return
      }
      const fileExt = processed.name.split('.').pop() || 'webp'
      const filePath = `${userId}/avatar.${fileExt}`
      const result = await uploadFile('avatars', filePath, processed, { upsert: true })
      
      if (!result.success) {
        if (result.error?.includes('not found')) {
          toast.error('Avatar storage not configured. Please contact administrator.')
        } else {
          toast.error(`Error uploading avatar: ${result.error}`)
        }
        return
      }
      
      const publicUrl = result.url!
      setProfile(p => ({ ...p, avatarUrl: publicUrl }))
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, avatar_url: publicUrl })
      if (upsertError) throw upsertError
      if ('updateUser' in supabase.auth) {
        await (supabase.auth as unknown as { updateUser: (params: { data: Record<string, unknown> }) => Promise<{ error: { message?: string } | null }> }).updateUser({ data: { avatar_url: publicUrl } })
      }
      toast.success('Avatar actualizado')
    } catch (err) {
      const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message?: string }).message) : 'Error al subir imagen'
      toast.error(msg)
    } finally {
      setIsUploadingAvatar(false)
      setShowCropConfirm(false)
      setPendingAvatarFile(null)
      if (pendingAvatarUrl) { URL.revokeObjectURL(pendingAvatarUrl); setPendingAvatarUrl(null) }
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setLoading(false)
    }
  }

  // Dirty check for prefs
  useEffect(() => {
    setIsDirtyPrefs(
      prefs.notifications !== initialPrefs.notifications ||
      prefs.compactMode !== initialPrefs.compactMode ||
      prefs.language !== initialPrefs.language
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
  }, [isDirty, isDirtyPrefs, profile, prefs, saveAll])

  const profileCompleteness = useMemo(() => {
    const fields = [
      !!profile.name,
      !!profile.email,
      !!profile.phone,
      !!profile.avatarUrl,
      !!profile.department,
      !!profile.location,
    ]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  }, [profile])

  const copyToClipboard = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado`) } catch { toast.error('No se pudo copiar') }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Perfil de usuario</h1>
            <p className="text-muted-foreground">Gestiona tu información personal y preferencias</p>
          </div>
          <div className="flex items-center gap-2">
            {(isDirty || isDirtyPrefs) && (
              <Badge variant="secondary">Cambios sin guardar</Badge>
            )}
            <Button size="sm" onClick={saveAll} disabled={!isDirty && !isDirtyPrefs}>
              Guardar todo
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información básica */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Información básica</CardTitle>
              {isDirty && <Badge variant="outline">Cambios sin guardar</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingUser ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <SkeletonCard />
              </div>
            ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatarUrl || '/avatars/01.svg'} alt={profile.name} />
                <AvatarFallback>{profile.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold">{profile.name}</div>
                <div className="text-sm text-muted-foreground">{profile.email}</div>
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  {role && <Badge>{role}</Badge>}
                  {profile.department && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{profile.department}</span>
                  )}
                  {profile.location && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{profile.location}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                  <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar}>
                    {isUploadingAvatar ? 'Subiendo…' : 'Cargar foto'}
                  </Button>
                  {profile.avatarUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setProfile(p => ({ ...p, avatarUrl: '' }))}>Quitar</Button>
                  )}
                  {isUploadingAvatar && (
                    <div className="w-40">
                      <Progress value={60} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Compleción del perfil</Badge>
                <span className="text-xs text-muted-foreground">{profileCompleteness}%</span>
              </div>
              <Progress value={profileCompleteness} />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="name" className="sm:col-span-1">Nombre</Label>
                <div className="sm:col-span-2 space-y-1">
                  <Input id="name" value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} />
                  {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="email" className="sm:col-span-1">Correo</Label>
                <div className="sm:col-span-2 flex gap-2">
                  <Input id="email" value={profile.email} disabled />
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(profile.email, 'Correo')}>Copiar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="phone" className="sm:col-span-1">Teléfono</Label>
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex gap-2">
                    <Input id="phone" value={profile.phone} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="Ej: +595 981 123 456" />
                    <Button variant="outline" size="sm" onClick={() => profile.phone && copyToClipboard(profile.phone, 'Teléfono')}>Copiar</Button>
                  </div>
                  {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="department" className="sm:col-span-1">Departamento</Label>
                <div className="sm:col-span-2 space-y-1">
                  <Input id="department" value={profile.department} onChange={(e) => setProfile(p => ({ ...p, department: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="location" className="sm:col-span-1">Ubicación</Label>
                <div className="sm:col-span-2 space-y-1">
                  <Input id="location" value={profile.location} onChange={(e) => setProfile(p => ({ ...p, location: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="avatar" className="sm:col-span-1">Foto (URL)</Label>
                <div className="sm:col-span-2 space-y-1">
                  <Input id="avatar" value={profile.avatarUrl} onChange={(e) => setProfile(p => ({ ...p, avatarUrl: e.target.value }))} placeholder="https://..." />
                  {errors.avatarUrl && <p className="text-xs text-red-600">{errors.avatarUrl}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => router.refresh()}>Cancelar</Button>
                <Button onClick={handleUpdateProfile} disabled={loading || !isDirty}>{loading ? 'Guardando…' : 'Guardar cambios'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>

      {/* Preferencias y seguridad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preferencias</CardTitle>
              {isDirtyPrefs && <Badge variant="outline">Cambios sin guardar</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tema */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span className="font-medium">Apariencia</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')}>Claro</Button>
                  <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')}>Oscuro</Button>
                  <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')}>Sistema</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['default','corporate','blue','green','purple','orange','red','indigo','teal','pink','amber','cyan','custom'] as ColorScheme[]).map((scheme) => (
                    <Button key={scheme} variant={colorScheme === scheme ? 'default' : 'outline'} size="sm" onClick={() => setColorScheme(scheme)}>
                      {scheme}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notificaciones */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">Notificaciones</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant={prefs.notifications ? 'default' : 'outline'}>
                    {prefs.notifications ? 'Activadas' : 'Desactivadas'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setPrefs(p => ({ ...p, notifications: !p.notifications }))}>
                    {prefs.notifications ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </div>

              {/* Modo compacto */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Modo compacto</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant={prefs.compactMode ? 'default' : 'outline'}>
                    {prefs.compactMode ? 'Activado' : 'Desactivado'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setPrefs(p => ({ ...p, compactMode: !p.compactMode }))}>
                    Alternar
                  </Button>
                </div>
              </div>

              {/* Idioma */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Idioma</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['es','en','pt'].map(lang => (
                    <Button key={lang} variant={prefs.language === lang ? 'default' : 'outline'} size="sm" onClick={() => setPrefs(p => ({ ...p, language: lang }))}>
                      {lang.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => router.refresh()}>Cancelar</Button>
              <Button onClick={savePrefs}>Guardar preferencias</Button>
            </div>
          </CardContent>
        </Card>

        {/* Acciones de cuenta */}
        <Card>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>
            <Separator />
            <Button variant="destructive" className="w-full" onClick={() => setShowLogoutConfirm(true)} disabled={loading}>
              <LogOut className="mr-2 h-4 w-4" />
              {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </CardContent>
        </Card>

        {/* Confirmación de cierre de sesión */}
        <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cerrar sesión?</DialogTitle>
              <DialogDescription>
                Se cerrará tu sesión actual y volverás a la pantalla de acceso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => { setShowLogoutConfirm(false); handleLogout() }}>Cerrar sesión</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showCropConfirm} onOpenChange={setShowCropConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar avatar</DialogTitle>
              <DialogDescription>Recorta y rota antes de subir</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-center border rounded-md p-2">
                {pendingAvatarUrl ? (
                  <img src={pendingAvatarUrl} alt="preview" className="max-h-64 rounded-md" />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch checked={cropSquare} onCheckedChange={setCropSquare} />
                  <span className="text-sm">Recortar cuadrado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRotateDeg((r) => (r + 90) % 360)}>Rotar 90°</Button>
                  <Badge variant="outline">{rotateDeg}°</Badge>
                </div>
              </div>
            </div>
            <DialogFooter className="sm:justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCropConfirm(false); setPendingAvatarFile(null); if (pendingAvatarUrl) { URL.revokeObjectURL(pendingAvatarUrl); setPendingAvatarUrl(null) } }}>Cancelar</Button>
              <Button onClick={confirmCropAndUpload} disabled={isUploadingAvatar}>{isUploadingAvatar ? 'Procesando…' : 'Guardar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}