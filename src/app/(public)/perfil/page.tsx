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
import { User, Mail, Phone, Loader2, ArrowLeft, Save, AlertCircle, Camera, CheckCircle2, Shield, Clock, MapPin, Briefcase, LogOut, Home, Package, Wrench, TrendingUp, Award, Info, ExternalLink } from 'lucide-react'
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

  const isDirty = useMemo(() => {
    if (!initialProfile) return false
    return JSON.stringify(profile) !== JSON.stringify(initialProfile)
  }, [profile, initialProfile])

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
        createdAt: user.profile?.created_at || '',
        role: user.role || 'cliente'
      }
      setProfile(data)
      setInitialProfile(data)
      loadUserStats()
    }
  }, [user, loadingAuth, router])

  // Load user statistics
  const loadUserStats = async () => {
    if (!user) return

    try {
      // Resolver customer_id vinculado al usuario (customers.profile_id = user.id)
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!customer) {
        setStats({ totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, totalSpent: 0 })
        return
      }

      // Obtener estadísticas de reparaciones del cliente
      const { data: repairs, error } = await supabase
        .from('repairs')
        .select('status, final_cost, paid_amount')
        .eq('customer_id', customer.id)

      if (error) throw error

      const totalRepairs = repairs?.length || 0
      const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo']
      const activeRepairs = repairs?.filter(r => activeStatuses.includes(r.status)).length || 0
      const completedRepairs = repairs?.filter(r => r.status === 'entregado').length || 0
      const totalSpent = repairs?.reduce((sum, r) => {
        const amount = typeof r.paid_amount === 'number' && !isNaN(r.paid_amount)
          ? Number(r.paid_amount)
          : (typeof r.final_cost === 'number' && !isNaN(r.final_cost) ? Number(r.final_cost) : 0)
        return sum + amount
      }, 0) || 0

      setStats({
        totalRepairs,
        activeRepairs,
        completedRepairs,
        totalSpent
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Advertencia al salir con cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validar con Zod
    try {
      profileSchema.parse(profile)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
        toast.error('Por favor corrige los errores en el formulario')
      }
      return
    }

    setLoading(true)
    try {
      // 1. Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          phone: profile.phone,
          avatar_url: profile.avatarUrl
        }
      })
      if (authError) throw authError

      // 2. Update Public Profile
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
    return (
      <Badge variant="outline" className={`${roleInfo.color} font-semibold`}>
        {roleInfo.label}
      </Badge>
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha no disponible'
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Fecha no disponible'
    }
  }

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando tu información...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            x: [0, 100, 0], 
            y: [0, -50, 0],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -80, 0], 
            y: [0, 60, 0],
            rotate: [0, -45, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" 
        />
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-pink-500/5 rounded-full blur-[80px]" />
      </div>

      <main className="container max-w-5xl py-12 px-4 relative z-10 pt-24 lg:pt-32">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Button asChild variant="ghost" size="sm" className="-ml-2 group hover:bg-white/50 dark:hover:bg-slate-900/50 backdrop-blur-sm">
                <Link href="/inicio">
                  <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Volver al inicio
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="group hover:bg-white/50 dark:hover:bg-slate-900/50 backdrop-blur-sm">
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-300 dark:to-white bg-clip-text text-transparent">
              Mi Perfil
            </h1>
            <p className="text-muted-foreground mt-3 text-lg font-medium max-w-xl">
              Gestiona tu información personal y mantén tus datos actualizados.
            </p>
          </motion.div>

          {isDirty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl backdrop-blur-md"
            >
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Cambios pendientes</span>
            </motion.div>
          )}
        </div>

        <div className="grid gap-10 md:grid-cols-[300px_1fr]">
          {/* Sidebar / Avatar Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <Card className="border-none shadow-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl overflow-hidden group">
              <div className="h-24 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 5, 0] }}
                  transition={{ duration: 10, repeat: Infinity }}
                  className="absolute -right-4 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl" 
                />
              </div>
              <CardContent className="-mt-12 pt-0 pb-8 flex flex-col items-center relative z-10">
                <div className="relative group/avatar">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-md opacity-25 group-hover/avatar:opacity-75 transition duration-500" />
                  <div className="relative p-1 bg-white dark:bg-slate-950 rounded-full shadow-xl">
                    <AvatarUpload
                      currentAvatarUrl={profile.avatarUrl}
                      userName={profile.name}
                      userId={user?.id}
                      userEmail={profile.email}
                      onAvatarChange={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                      size="xl"
                    />
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[240px]">
                    {profile.name || 'Cargando...'}
                  </h3>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    {getRoleBadge(profile.role)}
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Cuenta Verificada
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="p-1 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-lg">
              <div className="bg-white dark:bg-slate-950 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span>{profile.phone || 'Sin teléfono'}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Miembro desde</span>
                    <span className="text-xs font-semibold">{formatDate(profile.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowLogoutConfirm(true)}
              variant="outline" 
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </motion.div>

          {/* Form Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="border-none shadow-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl min-h-[500px] flex flex-col">
              <form onSubmit={handleUpdateProfile} className="flex-1 flex flex-col">
                <CardHeader className="p-8 pb-4">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
                    <User className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-3xl font-bold">Información de Contacto</CardTitle>
                  <CardDescription className="text-lg font-medium text-slate-500 dark:text-slate-400">
                    Mantén tus datos actualizados para que podamos contactarte sobre tus reparaciones y enviarte notificaciones importantes.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-8 pt-6 space-y-6 flex-1">
                  {/* Información Principal */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-base font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Nombre Completo
                        {profile.name && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </Label>
                      <Input 
                        id="name"
                        value={profile.name}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ej: Juan Pérez"
                        required
                        className={cn(
                          "h-14 text-lg border-2 transition-all duration-300 rounded-2xl bg-white/50 dark:bg-slate-950/50",
                          errors.name 
                            ? "border-red-500 ring-2 ring-red-500/10" 
                            : "border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white dark:focus:bg-slate-950"
                        )}
                      />
                      <p className="text-xs text-muted-foreground pl-1">
                        Este nombre aparecerá en tus órdenes de reparación y facturas
                      </p>
                      <AnimatePresence>
                        {errors.name && (
                          <motion.p 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-sm font-semibold text-red-500 flex items-center gap-1.5 ml-1"
                          >
                            <AlertCircle className="h-4 w-4" />
                            {errors.name}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="phone" className="text-base font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Número de WhatsApp
                        {profile.phone && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </Label>
                      <Input 
                        id="phone"
                        value={profile.phone}
                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+595 981 123 456"
                        className={cn(
                          "h-14 text-lg border-2 transition-all duration-300 rounded-2xl bg-white/50 dark:bg-slate-950/50",
                          errors.phone 
                            ? "border-red-500 ring-2 ring-red-500/10" 
                            : "border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10"
                        )}
                      />
                      <p className="text-xs text-muted-foreground pl-1">
                        Te contactaremos por WhatsApp para actualizaciones de tu reparación
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-base font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 opacity-70">
                        <Mail className="h-4 w-4" />
                        Correo Electrónico
                      </Label>
                      <div className="relative">
                        <Input 
                          id="email"
                          value={profile.email}
                          disabled
                          className="h-14 text-lg bg-slate-100/50 dark:bg-slate-800/50 border-dashed border-2 border-slate-300 dark:border-slate-700 cursor-not-allowed rounded-2xl opacity-60"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Shield className="h-5 w-5 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 italic pl-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Tu email está protegido y no puede ser modificado
                      </p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Información Adicional */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                        Información Adicional
                      </h3>
                      <Badge variant="secondary" className="ml-auto">Opcional</Badge>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="location" className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Dirección o Zona
                      </Label>
                      <Input 
                        id="location"
                        value={profile.location}
                        onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                        placeholder="Ej: Centro, Asunción"
                        className="h-12 text-base border-2 transition-all duration-300 rounded-xl bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                      <p className="text-xs text-muted-foreground pl-1">
                        Nos ayuda a coordinar entregas y retiros de equipos
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-6">
                    <div className="text-sm">
                      {isDirty ? (
                        <div className="flex flex-col">
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2">
                            <span className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                            Tienes cambios sin guardar
                          </span>
                          <span className="text-slate-500 text-xs mt-0.5">Recuerda guardar tus cambios</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Información actualizada</span>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading || !isDirty} 
                      className={cn(
                        "h-14 px-12 text-lg font-black rounded-2xl shadow-xl transition-all active:scale-[0.97] w-full sm:w-auto",
                        isDirty 
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30" 
                          : "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 shadow-none"
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          GUARDANDO...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-5 w-5" />
                          GUARDAR CAMBIOS
                        </>
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        </div>

        {/* Información Relevante para el Cliente */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Info className="h-6 w-6 text-primary" />
              Información Relevante
            </h2>
            <p className="text-muted-foreground mt-1">
              Resumen de tu actividad y accesos rápidos
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total de Reparaciones */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                    <Wrench className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    Total
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {stats.totalRepairs}
                  </p>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Reparaciones
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reparaciones Activas */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Activas
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
                    {stats.activeRepairs}
                  </p>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    En Proceso
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reparaciones Completadas */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
                    <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Completadas
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-green-600 dark:text-green-400">
                    {stats.completedRepairs}
                  </p>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Finalizadas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Gastado */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                    <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    Inversión
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-purple-600 dark:text-purple-400">
                    ${stats.totalSpent.toLocaleString()}
                  </p>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Total Gastado
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Accesos Rápidos */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="border-none shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                      <Wrench className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Mis Reparaciones</h3>
                      <p className="text-sm text-muted-foreground">
                        Ver estado de tus equipos
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="group-hover:translate-x-1 transition-transform">
                    <Link href="/mis-reparaciones">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Package className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Productos</h3>
                      <p className="text-sm text-muted-foreground">
                        Explora nuestro catálogo
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="group-hover:translate-x-1 transition-transform">
                    <Link href="/productos">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </main>

      {/* Logout Confirmation Dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            >
              <Card className="border-none shadow-2xl bg-white dark:bg-slate-900">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                    <LogOut className="h-8 w-8 text-red-600 dark:text-red-500" />
                  </div>
                  <CardTitle className="text-2xl">¿Cerrar sesión?</CardTitle>
                  <CardDescription className="text-base mt-2">
                    ¿Estás seguro que deseas cerrar tu sesión? Tendrás que volver a iniciar sesión para acceder.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleLogout}
                  >
                    Sí, cerrar sesión
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
