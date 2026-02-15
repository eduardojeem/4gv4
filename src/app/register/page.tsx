'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone, Loader2, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, TrendingUp, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion  } from '../../components/ui/motion'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una mayúscula'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una minúscula'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'La contraseña debe contener al menos un número'
    }
    return null
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    if (!formData.fullName.trim()) {
      setError('El nombre completo es requerido')
      setLoading(false)
      return
    }

    try {
      // Registrar usuario con Supabase Auth
      // El trigger on_auth_user_created creará automáticamente el perfil con rol 'cliente'
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: 'cliente'
          }
        }
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        toast.success('¡Cuenta creada exitosamente! Bienvenido.')
        
        setTimeout(() => {
          router.push('/inicio')
          router.refresh()
        }, 1000)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-40" />
      
      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-400/10 rounded-full blur-3xl animate-pulse delay-500" />

      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden"
      >
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700" />
        
        {/* Mesh Gradient Overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        </div>

        {/* Animated Shapes */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-10 right-10 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-10 left-10 w-80 h-80 bg-violet-400/20 rounded-full blur-3xl"
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-2xl"
          >
            <Smartphone className="h-7 w-7 text-white" />
          </motion.div>
          <div>
            <span className="text-2xl font-bold tracking-tight">4G POS</span>
            <p className="text-xs text-blue-200/80 font-medium">Business Suite</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 space-y-8 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
              Comienza tu{' '}
              <span className="bg-gradient-to-r from-blue-200 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
                transformación digital
              </span>
            </h1>
            <p className="text-lg text-blue-100/90 leading-relaxed">
              Únete a cientos de empresas que ya optimizan su gestión con nuestra plataforma. 
              Crea tu cuenta en minutos y comienza a crecer.
            </p>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { icon: Zap, label: 'Configuración rápida', color: 'from-yellow-400 to-orange-400' },
              { icon: Shield, label: 'Datos protegidos', color: 'from-green-400 to-emerald-400' },
              { icon: TrendingUp, label: 'Crece sin límites', color: 'from-blue-400 to-cyan-400' },
              { icon: Sparkles, label: 'Fácil de usar', color: 'from-purple-400 to-pink-400' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -5 }}
                className="group relative bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-all cursor-pointer"
              >
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br",
                  feature.color
                )} />
                <feature.icon className="h-5 w-5 text-white mb-2" />
                <span className="text-sm font-medium text-white/90">{feature.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-[460px]"
        >
          <Card className="shadow-2xl border-slate-200/60 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl overflow-hidden">
            {/* Card Header with Gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
            
            <CardHeader className="space-y-1 pb-6 pt-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Crear Cuenta
                </CardTitle>
              </div>
              <CardDescription className="text-base">
                Completa tus datos para comenzar
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pb-8">
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Nombre completo
                  </Label>
                  <div className="relative group">
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Juan Pérez"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      required
                      className="h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 transition-all pl-4 group-hover:border-slate-300 dark:group-hover:border-slate-700"
                      disabled={loading}
                    />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Correo electrónico
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      placeholder="nombre@empresa.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 transition-all pl-4 group-hover:border-slate-300 dark:group-hover:border-slate-700"
                      disabled={loading}
                    />
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Contraseña
                  </Label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="new-password"
                      className="h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 transition-all pr-11 pl-4 group-hover:border-slate-300 dark:group-hover:border-slate-700"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Confirmar contraseña
                  </Label>
                  <div className="relative group">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      autoComplete="new-password"
                      className="h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 transition-all pr-11 pl-4 group-hover:border-slate-300 dark:group-hover:border-slate-700"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Requisitos de contraseña:
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <li className={cn(
                      "flex items-center gap-2",
                      formData.password.length >= 8 && "text-green-600 dark:text-green-400"
                    )}>
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        formData.password.length >= 8 ? "bg-green-600" : "bg-slate-400"
                      )} />
                      Mínimo 8 caracteres
                    </li>
                    <li className={cn(
                      "flex items-center gap-2",
                      /[A-Z]/.test(formData.password) && "text-green-600 dark:text-green-400"
                    )}>
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        /[A-Z]/.test(formData.password) ? "bg-green-600" : "bg-slate-400"
                      )} />
                      Una letra mayúscula
                    </li>
                    <li className={cn(
                      "flex items-center gap-2",
                      /[a-z]/.test(formData.password) && "text-green-600 dark:text-green-400"
                    )}>
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        /[a-z]/.test(formData.password) ? "bg-green-600" : "bg-slate-400"
                      )} />
                      Una letra minúscula
                    </li>
                    <li className={cn(
                      "flex items-center gap-2",
                      /[0-9]/.test(formData.password) && "text-green-600 dark:text-green-400"
                    )}>
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        /[0-9]/.test(formData.password) ? "bg-green-600" : "bg-slate-400"
                      )} />
                      Un número
                    </li>
                  </ul>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3.5 rounded-lg flex items-start gap-2.5 border border-red-200 dark:border-red-900/50"
                  >
                    <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="text-xs leading-relaxed">{error}</span>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
                  disabled={loading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      Crear Cuenta
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center pt-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ¿Ya tienes cuenta?{' '}
                  <Link 
                    href="/login" 
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold hover:underline transition-colors inline-flex items-center gap-1 group"
                  >
                    Inicia sesión
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-green-600" />
              <span>Datos protegidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Gratis para empezar</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
