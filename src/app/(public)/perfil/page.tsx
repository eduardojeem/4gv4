'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { toast } from 'sonner'
import {
  Mail, Phone, Loader2, Save, AlertCircle, Shield, Clock,
  MapPin, LogOut, Wrench, Award, Calendar, UserRound,
  History, Smartphone, ChevronRight, TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { logAndTranslateError } from '@/lib/error-translator'
import { Badge } from '@/components/ui/badge'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'El telefono debe ser valido').optional().or(z.literal('')),
  avatarUrl: z.string().optional(),
  location: z.string().optional()
})

type ProfileData = z.infer<typeof profileSchema> & { email: string; createdAt?: string; role?: string }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recibido: { label: 'Recibido', color: 'bg-sky-100 text-sky-700' },
  diagnostico: { label: 'Diagnostico', color: 'bg-violet-100 text-violet-700' },
  reparacion: { label: 'En Reparacion', color: 'bg-amber-100 text-amber-700' },
  pausado: { label: 'Pausado', color: 'bg-orange-100 text-orange-700' },
  listo: { label: 'Listo', color: 'bg-emerald-100 text-emerald-700' },
  entregado: { label: 'Entregado', color: 'bg-slate-100 text-slate-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  mayorista: { label: 'Mayorista', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  client_mayorista: { label: 'Mayorista', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  vendedor: { label: 'Vendedor', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  tecnico: { label: 'Tecnico', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  cliente: { label: 'Cliente', color: 'bg-slate-50 text-slate-600 border-slate-200' },
}

export default function CustomerProfilePage() {
  const { user, loading: loadingAuth } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    name: '', email: '', phone: '', avatarUrl: '', location: '', createdAt: '', role: ''
  })
  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [stats, setStats] = useState({ totalRepairs: 0, activeRepairs: 0, totalSpent: 0, completedRepairs: 0 })
  const [recentRepairs, setRecentRepairs] = useState<any[]>([])

  const isDirty = useMemo(() => {
    if (!initialProfile) return false
    return JSON.stringify(profile) !== JSON.stringify(initialProfile)
  }, [profile, initialProfile])

  const loadUserStats = useCallback(async () => {
    if (!user) return
    try {
      const { data: customer } = await supabase
        .from('customers').select('id').eq('profile_id', user.id).maybeSingle()
      if (!customer) {
        setStats({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, totalSpent: 0 })
        return
      }
      const { data: repairs } = await supabase
        .from('repairs').select('status, final_cost, paid_amount').eq('customer_id', customer.id)
      const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo', 'pausado']
      setStats({
        totalRepairs: repairs?.length || 0,
        activeRepairs: repairs?.filter(r => activeStatuses.includes(r.status)).length || 0,
        completedRepairs: repairs?.filter(r => r.status === 'entregado').length || 0,
        totalSpent: repairs?.reduce((sum, r) => sum + (Number(r.paid_amount) || Number(r.final_cost) || 0), 0) || 0,
      })
      const { data: history } = await supabase
        .from('repairs')
        .select('id, brand, model, status, created_at, final_cost, device')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentRepairs(history || [])
    } catch {
      // Silently handle stats errors
    }
  }, [user, supabase])

  useEffect(() => {
    if (!loadingAuth && !user) { router.push('/login'); return }
    if (user) {
      const data = {
        name: user.profile?.name || '', email: user.email || '', phone: user.profile?.phone || '',
        avatarUrl: user.profile?.avatar_url || '', location: user.profile?.location || '',
        createdAt: user.created_at || '', role: user.role || 'cliente'
      }
      setProfile(data)
      setInitialProfile(data)
      loadUserStats()
    }
  }, [user, loadingAuth, router, loadUserStats])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    try {
      profileSchema.parse(profile)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => { if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message })
        setErrors(fieldErrors)
        toast.error('Por favor corrige los errores en el formulario')
      }
      return
    }
    setLoading(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: profile.name, phone: profile.phone, avatar_url: profile.avatarUrl } })
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: profile.name, phone: profile.phone, avatar_url: profile.avatarUrl, location: profile.location })
        .eq('id', user.id)
      if (profileError) throw profileError
      toast.success('Perfil actualizado correctamente')
      setInitialProfile(profile)
      router.refresh()
    } catch (error) {
      toast.error(logAndTranslateError(error, 'UpdateProfile'))
    } finally { setLoading(false) }
  }

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); toast.success('Sesion cerrada'); router.push('/login') }
    catch { toast.error('Error al cerrar sesion') }
  }

  const formatDate = (dateString?: string, short = false) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (short) return date.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })
      return date.toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch { return 'N/A' }
  }

  const roleInfo = ROLE_CONFIG[profile.role || 'cliente'] || ROLE_CONFIG.cliente

  if (loadingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
            <div className="relative">
              <div className="rounded-2xl border-4 border-card bg-card p-1 shadow-lg">
                <AvatarUpload
                  currentAvatarUrl={profile.avatarUrl}
                  userName={profile.name}
                  userId={user?.id ?? null}
                  userEmail={profile.email}
                  onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                  size="lg"
                />
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {profile.name || 'Cargando...'}
                </h1>
                <Badge variant="outline" className={cn('text-[10px] font-semibold', roleInfo.color)}>
                  {roleInfo.label}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {profile.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Miembro desde {new Date(profile.createdAt || Date.now()).getFullYear()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/mis-reparaciones">
                  <History className="mr-1.5 h-4 w-4" /> Historial
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowLogoutConfirm(true)}
                className="text-muted-foreground hover:text-destructive rounded-lg" aria-label="Cerrar sesion">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {[
            { label: 'Total', value: stats.totalRepairs, icon: Wrench, color: 'text-primary' },
            { label: 'En proceso', value: stats.activeRepairs, icon: TrendingUp, color: 'text-amber-600' },
            { label: 'Entregados', value: stats.completedRepairs, icon: Award, color: 'text-emerald-600' },
            { label: 'Invertido', value: `Gs. ${stats.totalSpent.toLocaleString('es-PY')}`, icon: TrendingUp, color: 'text-primary' },
          ].map((stat) => (
            <Card key={stat.label} className="border shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted', stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="truncate text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Form */}
          <div className="space-y-4">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3 border-b pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-semibold">Informacion Personal</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Nombre Completo</Label>
                      <Input id="name" value={profile.name}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                        placeholder="Tu nombre"
                        className={cn('h-11 rounded-lg', errors.name && 'border-destructive')} />
                      {errors.name && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">Telefono / WhatsApp</Label>
                      <Input id="phone" value={profile.phone}
                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+595 9xx xxx xxx"
                        className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Shield className="h-3 w-3" /> Email (no editable)
                      </Label>
                      <Input value={profile.email} disabled className="h-11 rounded-lg opacity-60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-xs font-medium text-muted-foreground">Ubicacion</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="location" value={profile.location}
                          onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                          placeholder="Ciudad, barrio..."
                          className="h-11 rounded-lg pl-10" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-between gap-4 border-t pt-5 sm:flex-row">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className={cn('h-2 w-2 rounded-full', isDirty ? 'bg-amber-500' : 'bg-emerald-500')} />
                      {isDirty ? 'Cambios sin guardar' : 'Todo actualizado'}
                    </div>
                    <Button type="submit" disabled={loading || !isDirty} className="h-10 rounded-lg px-6">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar cambios
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="h-16 justify-start gap-4 rounded-lg px-5">
                <Link href="/mis-reparaciones">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Rastrear equipo</p>
                    <p className="text-xs text-muted-foreground">Ver estado en tiempo real</p>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 justify-start gap-4 rounded-lg px-5">
                <Link href="/perfil/autorizados">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Personas autorizadas</p>
                    <p className="text-xs text-muted-foreground">Gestionar autorizaciones</p>
                  </div>
                </Link>
              </Button>
            </div>
          </div>

          {/* Sidebar: Recent Activity */}
          <Card className="h-fit border shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 border-b pb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentRepairs.length > 0 ? (
                  recentRepairs.map((repair) => {
                    const statusInfo = STATUS_CONFIG[repair.status] || { label: repair.status, color: 'bg-slate-100 text-slate-600' }
                    return (
                      <Link key={repair.id} href={`/mis-reparaciones?search=${repair.id}`}
                        className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{repair.device || `${repair.brand} ${repair.model}`}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatDate(repair.created_at, true)}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0 border-none text-[10px] font-medium', statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      </Link>
                    )
                  })
                ) : (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
                  </div>
                )}
              </div>
            </CardContent>
            {recentRepairs.length > 0 && (
              <CardFooter className="border-t p-3">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                  <Link href="/mis-reparaciones">Ver todo el historial <ChevronRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* Logout dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2">
              <Card className="p-6 text-center shadow-xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <LogOut className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-bold">Cerrar sesion?</h3>
                <p className="mt-1 text-sm text-muted-foreground">Tendras que volver a autenticarte para acceder a tu perfil.</p>
                <div className="mt-6 flex flex-col gap-2">
                  <Button variant="destructive" className="h-10 rounded-lg" onClick={handleLogout}>Si, cerrar sesion</Button>
                  <Button variant="ghost" className="h-10 rounded-lg" onClick={() => setShowLogoutConfirm(false)}>Cancelar</Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
