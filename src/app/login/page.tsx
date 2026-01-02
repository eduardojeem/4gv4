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
import { Smartphone, Loader2, Cpu, CircuitBoard, Wifi, WifiOff, AlertTriangle, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { config, isDemoNoDb } from '@/lib/config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useConnectionStatus } from '@/hooks/use-connection-status'
import { motion  } from '../../components/ui/motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  const { status: connectionStatus } = useConnectionStatus()
  const router = useRouter()
  const supabase = createClient()

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

  const handleDemoLogin = async () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('app-settings') : null
      const obj = raw ? JSON.parse(raw) : {}
      obj['system.demoNoDb'] = true
      if (typeof window !== 'undefined') localStorage.setItem('app-settings', JSON.stringify(obj))
    } catch { }

    setLoading(true)
    setError('')

    await new Promise(resolve => setTimeout(resolve, 800))

    try {
      const demoSupabase = createClient()
      const { error } = await demoSupabase.auth.signInWithPassword({ email: 'admin@demo.com', password: 'demo123' })

      if (error) {
        console.warn('Demo auth failed (expected if no DB), forcing redirect')
      }

      toast.success('Modo Demo activado')
      router.push('/dashboard')
      router.refresh()
    } catch {
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) return

    try {
      if (!config.supabase.isConfigured || isDemoNoDb() || connectionStatus === 'disconnected') {
        toast.info('En modo demo o sin conexión, esta función es simulada.')
        setResetOpen(false)
        return
      }

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
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20" />

      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 text-white bg-slate-900 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 opacity-90" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />

        {/* Abstract Shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-violet-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/20 shadow-xl">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">4G POS</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Gestiona tu negocio con <span className="text-blue-200">tecnología avanzada</span>
          </h1>
          <p className="text-lg text-blue-100/90 leading-relaxed">
            Control total de ventas, inventario y reparaciones en una plataforma unificada y segura.
          </p>

          <div className="flex gap-4 pt-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
              <Cpu className="h-4 w-4 text-blue-300" />
              <span className="text-sm font-medium">Rendimiento</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
              <CircuitBoard className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-medium">Automatización</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/60 font-mono">
          <span>v4.2.0-stable</span>
          <span>© 2024 4G System</span>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-[420px]"
        >
          <Card className="shadow-2xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="space-y-1 pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold tracking-tight">Bienvenido</CardTitle>
                {/* Connection Status Indicator */}
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors",
                    connectionStatus === 'connected'
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50"
                      : connectionStatus === 'checking'
                        ? "bg-slate-50 text-slate-600 border-slate-200"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50"
                  )}
                  title={connectionStatus === 'connected' ? 'Conectado a Supabase' : 'Sin conexión a base de datos'}
                >
                  {connectionStatus === 'connected' ? (
                    <>
                      <Wifi className="h-3 w-3" />
                      <span>Online</span>
                    </>
                  ) : connectionStatus === 'checking' ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      <span>Offline</span>
                    </>
                  )}
                </div>
              </div>
              <CardDescription>Ingresa tus credenciales para acceder al panel</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {connectionStatus === 'disconnected' && !isDemoNoDb() && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold ml-2">Problema de conexión</AlertTitle>
                  <AlertDescription className="text-xs ml-2 mt-1">
                    No se pudo conectar con la base de datos. Verifica tu configuración o usa el modo demo.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10 bg-slate-50 dark:bg-slate-950/50"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      onClick={() => setResetOpen(true)}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-10 bg-slate-50 dark:bg-slate-950/50 pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
                  <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Mantener sesión iniciada
                  </Label>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg group"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      Acceder al Panel
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">O continúa con</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <CircuitBoard className="mr-2 h-4 w-4 text-slate-500" />
                Modo Demo (Sin Base de Datos)
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
                  Solicitar acceso
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail">Correo electrónico</Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="nombre@empresa.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Te enviaremos un enlace seguro para crear una nueva contraseña.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
              <Button onClick={handleResetPassword} disabled={!resetEmail}>Enviar enlace</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
