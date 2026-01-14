'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Smartphone, Loader2, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, TrendingUp, Cpu, CircuitBoard, Binary, Wifi, Lock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { config } from '@/lib/config'
import { useEffect } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Esperar a que el componente esté montado en el cliente
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error.message, error)
        const msg = error.message || (typeof error === 'string' ? error : 'Error al iniciar sesión')

        if (msg.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas. Por favor verifica tu correo y contraseña.')
        } else if (/Failed to fetch|Network|fetch/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Verifica tu conexión a internet.')
        } else {
          setError(msg)
        }
      } else {
        try { localStorage.setItem('auth.rememberMe', rememberMe ? '1' : '0') } catch { }
        toast.success('Bienvenido de nuevo')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('Unexpected login error:', err)
      setError('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) return

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/dashboard/profile` : undefined,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Te enviamos un enlace para restablecer tu contraseña')
        setResetOpen(false)
      }
    } catch (e) {
      toast.error('No se pudo enviar el correo de reseteo')
    }
  }

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-950">
      {/* Animated Tech Background */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
        
        {/* Animated Circuit Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <linearGradient id="circuit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Horizontal lines */}
          {[...Array(5)].map((_, i) => (
            <motion.line
              key={`h-${i}`}
              x1="0"
              y1={`${20 + i * 20}%`}
              x2="100%"
              y2={`${20 + i * 20}%`}
              stroke="url(#circuit-gradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{
                duration: 2,
                delay: i * 0.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
            />
          ))}
          
          {/* Vertical lines */}
          {[...Array(5)].map((_, i) => (
            <motion.line
              key={`v-${i}`}
              x1={`${20 + i * 20}%`}
              y1="0"
              x2={`${20 + i * 20}%`}
              y2="100%"
              stroke="url(#circuit-gradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{
                duration: 2,
                delay: i * 0.2 + 0.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
            />
          ))}
        </svg>

        {/* Floating Particles */}
        {mounted && [...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              opacity: 0
            }}
            animate={{
              y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear"
            }}
          />
        ))}

        {/* Glowing Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Left Panel - Tech Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden"
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-blue-600/10 to-violet-600/10" />

        {/* Logo with Tech Animation */}
        <div className="relative z-10">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-2xl border border-cyan-400/20 shadow-2xl">
                <Cpu className="h-7 w-7 text-white" />
              </div>
              {/* Animated Corner Brackets */}
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400"
              />
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400"
              />
            </motion.div>
            <div>
              <motion.span 
                className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent"
                animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
                transition={{ duration: 5, repeat: Infinity }}
              >
                {config.company.name}
              </motion.span>
            </div>
          </motion.div>
        </div>

        {/* Main Content with Tech Theme */}
        <div className="relative z-10 space-y-8 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
              <span className="text-white">Tecnología que </span>
              <motion.span 
                className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent"
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 5, repeat: Infinity }}
                style={{ backgroundSize: "200% auto" }}
              >
                impulsa tu negocio
              </motion.span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Sistema integral de gestión para el sector de electrónica y tecnología. 
              Control total de inventario, ventas y reparaciones.
            </p>
          </motion.div>

          {/* Tech Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { icon: Zap, label: 'Alto rendimiento', color: 'from-yellow-400 to-orange-500', delay: 0 },
              { icon: Shield, label: 'Datos seguros', color: 'from-green-400 to-emerald-500', delay: 0.1 },
              { icon: CircuitBoard, label: 'Automatización', color: 'from-cyan-400 to-blue-500', delay: 0.2 },
              { icon: TrendingUp, label: 'Analytics en vivo', color: 'from-purple-400 to-pink-500', delay: 0.3 },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + feature.delay }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="group relative"
              >
                {/* Glow effect */}
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl bg-gradient-to-br",
                  feature.color
                )} />
                
                {/* Card */}
                <div className="relative bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-slate-800 group-hover:border-cyan-500/50 transition-all">
                  <div className={cn(
                    "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2",
                    feature.color
                  )}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    {feature.label}
                  </span>
                  
                  {/* Corner accents */}
                  <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-cyan-500/0 group-hover:border-cyan-500/50 transition-colors" />
                  <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-cyan-500/0 group-hover:border-cyan-500/50 transition-colors" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tech Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-6 pt-4"
          >
            {[
              { icon: CheckCircle2, text: 'Sistema certificado' },
              { icon: Lock, text: 'Encriptación SSL' },
              { icon: Wifi, text: 'Cloud sync' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 + i * 0.1 }}
                className="flex items-center gap-2 text-xs text-slate-400"
              >
                <item.icon className="h-3.5 w-3.5 text-cyan-400" />
                <span>{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-[460px]"
        >
          <Card className="shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-2xl overflow-hidden relative">
            {/* Animated Border */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: "linear-gradient(90deg, transparent, #06b6d4, #3b82f6, #8b5cf6, transparent)"
              }}
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            
            <CardHeader className="space-y-1 pb-6 pt-8">
              <div className="space-y-1">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <CardTitle className="text-3xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                      Bienvenido
                    </span>
                  </CardTitle>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <CardDescription className="text-base text-slate-400">
                    Ingresa tus credenciales para continuar
                  </CardDescription>
                </motion.div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pb-8">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-2"
                >
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-300">
                    Correo electrónico
                  </Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      placeholder="nombre@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="email"
                      className="h-11 bg-slate-950/50 border-slate-800 focus:border-cyan-500 transition-all pl-4 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                    {/* Animated underline */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: focusedField === 'email' ? '100%' : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    {/* Corner brackets */}
                    <AnimatePresence>
                      {focusedField === 'email' && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500"
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500"
                          />
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-300">
                      Contraseña
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors hover:underline"
                      onClick={() => setResetOpen(true)}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="current-password"
                      className="h-11 bg-slate-950/50 border-slate-800 focus:border-cyan-500 transition-all pr-11 pl-4 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded-md"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </motion.button>
                    {/* Animated underline */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: focusedField === 'password' ? '100%' : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    {/* Corner brackets */}
                    <AnimatePresence>
                      {focusedField === 'password' && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500"
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500"
                          />
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Remember Me */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center space-x-2 py-1"
                >
                  <Switch 
                    id="remember" 
                    checked={rememberMe} 
                    onCheckedChange={setRememberMe}
                    className="data-[state=checked]:bg-cyan-600"
                  />
                  <Label htmlFor="remember" className="text-sm font-normal text-slate-400 cursor-pointer">
                    Mantener sesión iniciada
                  </Label>
                </motion.div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="text-sm text-red-400 bg-red-500/10 p-3.5 rounded-lg flex items-start gap-2.5 border border-red-500/20"
                    >
                      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="text-xs leading-relaxed">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 hover:from-cyan-500 hover:via-blue-500 hover:to-violet-500 text-white font-semibold transition-all shadow-lg hover:shadow-cyan-500/50 group relative overflow-hidden"
                    disabled={loading}
                  >
                    {/* Animated shine effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        Acceder al Panel
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </motion.div>
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Register Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center pt-2"
              >
                <p className="text-sm text-slate-400">
                  ¿No tienes cuenta?{' '}
                  <Link 
                    href="/register" 
                    className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-colors inline-flex items-center gap-1 group"
                  >
                    Solicitar acceso
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </p>
              </motion.div>
            </CardContent>
          </Card>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500"
          >
            <motion.div 
              className="flex items-center gap-1.5"
              whileHover={{ scale: 1.05 }}
            >
              <Shield className="h-3.5 w-3.5 text-green-500" />
              <span>Conexión segura</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-1.5"
              whileHover={{ scale: 1.05 }}
            >
              <Lock className="h-3.5 w-3.5 text-cyan-500" />
              <span>Encriptación SSL</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[440px] border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-sm font-semibold">
                Correo electrónico
              </Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="nombre@empresa.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="h-11 bg-slate-50 dark:bg-slate-950/50"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Te enviaremos un enlace seguro para crear una nueva contraseña.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setResetOpen(false)}
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleResetPassword} 
                disabled={!resetEmail}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Enviar enlace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
