'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { toast } from 'sonner'
import { User, Mail, Phone, Loader2, ArrowLeft, Save, AlertCircle, CircleCheck, Shield, Clock, MapPin, LogOut, Home, Wrench, TrendingUp, Award, Info, ExternalLink, Calendar, UserRound, Settings, History } from 'lucide-react'
import Link from 'next/link'
import { logAndTranslateError } from '@/lib/error-translator'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Schema de validación para el perfil
const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'El teléfono debe ser válido').optional().or(z.literal('')),
  avatarUrl: z.string().optional(),
  location: z.string().optional()
})

type ProfileData = z.infer<typeof profileSchema> & { email: string; createdAt?: string; role?: string }

export default function CustomerProfilePage() {
  const { user, loading: loadingAuth } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
    location: '',
    createdAt: '',
    role: ''
  })
  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [stats, setStats] = useState({
    totalRepairs: 0,
    activeRepairs: 0,
    totalSpent: 0,
    completedRepairs: 0
  })
  const [recentRepairs, setRecentRepairs] = useState<any[]>([])

  const isDirty = useMemo(() => {
    if (!initialProfile) return false
    return JSON.stringify(profile) !== JSON.stringify(initialProfile)
  }, [profile, initialProfile])

  // Load user statistics and history
  const loadUserStats = useCallback(async () => {
    if (!user) {
      console.log('⏸️ loadUserStats: No user session found, skipping stats load.')
      return
    }

    console.log('📡 loadUserStats: Starting fetch for user.id:', user.id)

    try {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (customerError) {
        console.error('Error fetching customer record:', customerError)
        throw customerError
      }

      if (!customer) {
        setStats({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, totalSpent: 0 })
        return
      }

      const { data: repairs, error } = await supabase
        .from('repairs')
        .select('status, final_cost, paid_amount')
        .eq('customer_id', customer.id)

      if (error) throw error

      const totalRepairs = repairs?.length || 0
      const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo', 'pausado']
      const activeRepairs = repairs?.filter(r => activeStatuses.includes(r.status)).length || 0
      const completedRepairs = repairs?.filter(r => r.status === 'entregado').length || 0
      const totalSpent = repairs?.reduce((sum, r) => {
        const amount = typeof r.paid_amount === 'number' && !isNaN(r.paid_amount)
          ? Number(r.paid_amount)
          : (typeof r.final_cost === 'number' && !isNaN(r.final_cost) ? Number(r.final_cost) : 0)
        return sum + amount
      }, 0) || 0

      // Get 10 most recent repairs
      const { data: history, error: historyError } = await supabase
        .from('repairs')
        .select('id, brand, model, status, created_at, final_cost, device')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (historyError) throw historyError

      setRecentRepairs(history || [])
      setStats({
        totalRepairs,
        activeRepairs,
        completedRepairs,
        totalSpent
      })
      console.log('✅ Stats loaded successfully:', { totalRepairs, activeRepairs, completedRepairs, totalSpent })
    } catch (error: any) {
      const errorDetails = {
        message: error.message || 'No message',
        code: error.code || 'No code',
        details: error.details || 'No details',
        hint: error.hint || 'No hint',
        stack: error.stack,
        fullError: error
      }
      console.error('💥 CRITICAL: Error loading user stats:', JSON.stringify(errorDetails, null, 2))
      console.error('💥 Raw error object:', error)
    }
  }, [user, supabase])

  // Load user data
  useEffect(() => {
    if (!loadingAuth && !user) {
      router.push('/login')
      return
    }

    if (user) {
      const data = {
        name: user.profile?.name || '',
        email: user.email || '',
        phone: user.profile?.phone || '',
        avatarUrl: user.profile?.avatar_url || '',
        location: user.profile?.location || '',
        createdAt: user.created_at || '',
        role: user.role || 'cliente'
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
        error.issues.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
        toast.error('Por favor corrige los errores en el formulario')
      }
      return
    }

    setLoading(true)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          phone: profile.phone,
          avatar_url: profile.avatarUrl
        }
      })
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
          avatar_url: profile.avatarUrl,
          location: profile.location
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      toast.success('Perfil actualizado correctamente')
      setInitialProfile(profile)
      router.refresh()
    } catch (error) {
      const message = logAndTranslateError(error, 'UpdateProfile')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Sesión cerrada correctamente')
      router.push('/login')
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      recibido: { label: 'Recibido', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      diagnostico: { label: 'Diagnóstico', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
      reparacion: { label: 'En Reparación', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
      pausado: { label: 'En Pausa', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
      listo: { label: 'Listo', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      entregado: { label: 'Entregado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400' },
      cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
    }
    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
    return <Badge variant="outline" className={cn("font-medium border-none text-[10px]", config.className)}>{config.label}</Badge>
  }

  const getRoleBadge = (role?: string) => {
    const roleMap: Record<string, { label: string; color: string }> = {
      admin: { label: 'Administrador', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      mayorista: { label: 'Mayorista', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      client_mayorista: { label: 'Mayorista', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      vendedor: { label: 'Vendedor', color: 'bg-green-100 text-green-800 border-green-200' },
      tecnico: { label: 'Técnico', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      cliente: { label: 'Cliente', color: 'bg-gray-100 text-gray-800 border-gray-200' }
    }
    const roleInfo = roleMap[role || 'cliente'] || roleMap.cliente
    return <Badge variant="outline" className={cn(roleInfo.color, "font-bold text-[10px] tracking-tight px-2")}>{roleInfo.label}</Badge>
  }

  const formatDate = (dateString?: string, short = false) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (short) return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return 'N/A'
    }
  }

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-20">
      {/* Modern Dashboard Header */}
      <div className="relative h-64 w-full bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/20" />
        <div className="absolute inset-0 bg-[grid-white/[0.05]] bg-[size:20px_20px]" />
        
        <div className="container relative h-full flex flex-col justify-end pb-8">
           <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-500" />
                <div className="relative bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-2xl">
                    <AvatarUpload
                        currentAvatarUrl={profile.avatarUrl}
                        userName={profile.name}
                        userId={user?.id}
                        userEmail={profile.email}
                        onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                        size="lg"
                    />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-1">
                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {profile.name || 'Cargando...'}
                    </h1>
                    {getRoleBadge(profile.role)}
                 </div>
                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-400 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                        <Mail className="h-3.5 w-3.5" />
                        {profile.email}
                    </span>
                    <span className="hidden md:inline text-slate-700">•</span>
                    <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        Miembro desde {new Date(profile.createdAt || Date.now()).getFullYear()}
                    </span>
                 </div>
              </div>

              <div className="flex items-center gap-3">
                  <Button asChild variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all rounded-xl">
                    <Link href="/mis-reparaciones">
                        <History className="mr-2 h-4 w-4" />
                        Historial
                    </Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowLogoutConfirm(true)}
                    className="text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
              </div>
           </div>
        </div>
      </div>

      <div className="container -mt-8 relative z-20">
        {/* Metric Bar Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 border-l-4 border-l-blue-500 overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Reparaciones Totales</p>
                        <h3 className="text-3xl font-black">{stats.totalRepairs}</h3>
                    </div>
                    <div className="h-12 w-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600">
                        <Wrench className="h-6 w-6" />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">En Proceso Ahora</p>
                        <h3 className="text-3xl font-black text-amber-600">{stats.activeRepairs}</h3>
                    </div>
                    <div className="h-12 w-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 border-l-4 border-l-green-500 overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Equipos Entregados</p>
                        <h3 className="text-3xl font-black text-green-600">{stats.completedRepairs}</h3>
                    </div>
                    <div className="h-12 w-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600">
                        <Award className="h-6 w-6" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Main Form Area */}
          <div className="space-y-6">
            <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="py-6 px-8 flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                        <UserRound className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-xl font-black tracking-tight">Mis Datos</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 font-bold text-[10px] uppercase px-3">Actualizable</Badge>
              </CardHeader>
              <CardContent className="p-8">
                 <form onSubmit={handleUpdateProfile} className="space-y-8">
                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="space-y-3">
                            <Label htmlFor="name" className="text-xs font-black uppercase text-slate-500 tracking-wider">Nombre Completo</Label>
                            <Input 
                                id="name"
                                value={profile.name}
                                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                                placeholder="Tu nombre artístico o real"
                                className={cn(
                                    "h-12 rounded-xl transition-all border-2",
                                    errors.name ? "border-red-500" : "border-slate-100 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                )}
                            />
                            {errors.name && <p className="text-[10px] font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {errors.name}</p>}
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="phone" className="text-xs font-black uppercase text-slate-500 tracking-wider">WhatsApp Contacto</Label>
                            <Input 
                                id="phone"
                                value={profile.phone}
                                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+595 9xx xxx xxx"
                                className="h-12 rounded-xl border-2 border-slate-100 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 underline-offset-4"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                <Shield className="h-3 w-3" /> Email de Acceso
                            </Label>
                            <div className="relative">
                                <Input 
                                    value={profile.email}
                                    disabled
                                    className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none opacity-60 font-medium italic cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="location" className="text-xs font-black uppercase text-slate-500 tracking-wider">Ubicación Actual</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    id="location"
                                    value={profile.location}
                                    onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                                    placeholder="Ciudad, Barrio..."
                                    className="h-12 pl-10 rounded-xl border-2 border-slate-100 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                        <div className="flex items-center gap-3 p-3 px-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className={cn("h-3 w-3 rounded-full shrink-0", isDirty ? "bg-amber-500 animate-pulse" : "bg-green-500")} />
                             <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                {isDirty ? "Hay cambios que requieren guardado" : "Tus datos están sincronizados"}
                             </span>
                        </div>
                        <Button 
                            type="submit" 
                            disabled={loading || !isDirty} 
                            className="h-12 px-10 rounded-xl font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-95 w-full sm:w-auto"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            GUARDAR PERFIL
                        </Button>
                    </div>
                 </form>
              </CardContent>
            </Card>

            {/* Quick Actions / Info Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Button asChild variant="secondary" className="h-20 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-none justify-start px-6 transition-all group shadow-sm">
                    <Link href="/mis-reparaciones">
                        <div className="h-10 w-10 bg-blue-500 text-white rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <Wrench className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-900 dark:text-white">Rastrear Equipo</p>
                            <p className="text-[10px] text-slate-500 font-medium">Ver estado en tiempo real</p>
                        </div>
                    </Link>
                 </Button>

                 <Button asChild variant="secondary" className="h-20 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-none justify-start px-6 transition-all group shadow-sm">
                    <Link href="/inicio#contacto">
                        <div className="h-10 w-10 bg-purple-500 text-white rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <Phone className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-slate-900 dark:text-white">Soporte Técnico</p>
                            <p className="text-[10px] text-slate-500 font-medium">Habla con nosotros</p>
                        </div>
                    </Link>
                 </Button>
            </div>
          </div>

          {/* Right Column: Recent Activity */}
          <div className="space-y-6">
            <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden h-fit">
               <CardHeader className="py-6 px-6 border-b border-slate-50 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg font-black italic">Actividad Reciente</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {recentRepairs.length > 0 ? (
                        recentRepairs.map((repair) => (
                            <div key={repair.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all flex items-start gap-4">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold truncate leading-none mb-1">
                                        {repair.device || `${repair.brand} ${repair.model}`}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mb-3">
                                        <Clock className="h-3 w-3" /> {formatDate(repair.created_at, true)}
                                        <span>•</span>
                                        ID: {repair.id.slice(0, 6)}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {getStatusBadge(repair.status)}
                                        <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10">
                                            <Link href={`/mis-reparaciones?search=${repair.id}`}> DETALLE </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center space-y-3">
                           <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                              <Info className="h-8 w-8 text-slate-200" />
                           </div>
                           <p className="text-xs text-slate-400 font-bold tracking-tight">SIN ACTIVIDAD RECIENTE</p>
                        </div>
                    )}
                  </div>
               </CardContent>
               {recentRepairs.length > 0 && (
                 <CardFooter className="py-4 border-t border-slate-50 dark:border-slate-800">
                    <Button asChild variant="outline" size="sm" className="w-full text-[10px] font-black tracking-widest uppercase h-9 rounded-xl">
                        <Link href="/mis-reparaciones text-slate-500"> VER TODO EL HISTORIAL </Link>
                    </Button>
                 </CardFooter>
               )}
            </Card>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm"
            >
              <Card className="border-none shadow-3xl bg-white dark:bg-slate-900 p-8 text-center rounded-[32px]">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-500/10">
                    <LogOut className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight mb-2">¿Seguro que te vas?</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
                    Tendrás que volver a autenticarte para ver el estado de tus equipos en reparación.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button variant="destructive" className="h-12 rounded-2xl font-black shadow-lg shadow-red-500/20" onClick={handleLogout}>SÍ, CERRAR SESIÓN</Button>
                    <Button variant="ghost" className="h-12 rounded-2xl text-slate-500 font-bold" onClick={() => setShowLogoutConfirm(false)}>CANCELAR</Button>
                  </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Added missing icons for completion
function Smartphone(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
        </svg>
    )
}
