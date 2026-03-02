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
import { Loader2, Eye, EyeOff, ArrowRight, Cpu, Shield } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { config } from '@/lib/config'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const reduceMotion = useReducedMotion()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        const msg = error.message || (typeof error === 'string' ? error : 'Error al iniciar sesion')

        // Registrar intento fallido
        try {
          const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
          await supabase.rpc('log_auth_event', {
            p_user_id: undefined,
            p_action: 'login_failed',
            p_success: false,
            p_ip_address: undefined,
            p_user_agent: userAgent,
            p_details: { email, error: msg },
          })
        } catch (logError) {
          console.error('Error logging failed login from page:', logError)
        }

        if (/email not confirmed/i.test(msg)) {
          setUnconfirmed(true)
          setError('Tu correo no esta confirmado. Reenvia el email de verificacion para acceder.')
        } else if (msg.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas. Verifica tu correo y contrasena.')
        } else if (/Failed to fetch|Network|fetch/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Verifica tu conexion a internet.')
        } else {
          setError(msg)
        }
      } else {
        if (data?.user) {
          try {
            const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
            await supabase.rpc('log_auth_event', {
              p_user_id: data.user.id,
              p_action: 'login',
              p_success: true,
              p_ip_address: undefined,
              p_user_agent: userAgent,
              p_details: { email },
            })
          } catch (logError) {
            console.error('Error logging auth event from login page:', logError)
          }
        }

        try {
          localStorage.setItem('auth.rememberMe', rememberMe ? '1' : '0')
        } catch {}
        toast.success('Bienvenido de nuevo')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('Unexpected login error:', err)
      setError('Ocurrio un error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim()
    if (!targetEmail) {
      toast.error('Ingresa tu correo para reenviar la confirmacion')
      return
    }
    const emailValid = /.+@.+\..+/.test(targetEmail)
    if (!emailValid) {
      toast.error('Correo invalido')
      return
    }
    try {
      setResendLoading(true)
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: origin ? { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` } : undefined,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Te enviamos nuevamente el correo de confirmacion')
        setUnconfirmed(false)
      }
    } catch {
      toast.error('No se pudo reenviar el correo de confirmacion')
    } finally {
      setResendLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) return

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=/dashboard/profile`
            : undefined,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Te enviamos un enlace para restablecer tu contrasena')
        setResetOpen(false)
      }
    } catch {
      toast.error('No se pudo enviar el correo de reseteo')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(6,182,212,0.16),transparent_40%),radial-gradient(circle_at_90%_80%,rgba(59,130,246,0.14),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/30">
                  <Cpu className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{config.company.name}</p>
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">Iniciar sesion</CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  Acceso al sistema interno
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Correo electronico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-200">
                      Contrasena
                    </Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                      onClick={() => setResetOpen(true)}
                    >
                      Olvide mi contrasena
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
                      className="h-11 border-slate-700 bg-slate-950/60 pr-11 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-cyan-400"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <Switch
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                    className="data-[state=checked]:bg-cyan-600"
                  />
                  <Label htmlFor="remember" className="cursor-pointer text-sm text-slate-400">
                    Mantener sesion iniciada
                  </Label>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                      role="alert"
                      aria-live="assertive"
                    >
                      <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {unconfirmed && (
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-cyan-200">
                        Tu cuenta no esta verificada. Revisa entrada y spam.
                      </span>
                      <Button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={loading || resendLoading}
                        className="h-9 bg-cyan-600 hover:bg-cyan-500"
                      >
                        {resendLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </span>
                        ) : (
                          'Reenviar verificacion'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white hover:from-cyan-500 hover:to-blue-500"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesion...
                    </>
                  ) : (
                    <>
                      Iniciar sesion
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-1 text-center">
                <p className="text-sm text-slate-400">
                  No tienes cuenta?{' '}
                  <Link href="/register" className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline">
                    Registrate
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Restablecer contrasena</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="resetEmail">Correo electronico</Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="nombre@empresa.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Te enviaremos un enlace para crear una nueva contrasena.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResetOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={!resetEmail}>
                Enviar enlace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
