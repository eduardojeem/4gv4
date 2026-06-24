'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Cpu, Shield, CheckCircle2, Store } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { sanitizeRedirectPath, isValidEmail } from '@/lib/auth/password-validation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { logAuthEventClient } from '@/lib/auth-event-client'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { usePlatformBranding } from '@/hooks/use-platform-branding'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const reduceMotion = useReducedMotion()
  const { branding } = usePlatformBranding()
  const registeredCompany = searchParams.get('registered') === '1' ? searchParams.get('company') : null
  const callbackError = searchParams.get('error') === 'auth_callback_error'
    ? 'No se pudo completar la verificacion del enlace. Solicita uno nuevo o inicia sesion nuevamente.'
    : ''
  const visibleError = error || callbackError

  // Registration targets, kept distinct so shoppers aren't funneled into
  // business (company) creation. The redirect is preserved across the flow.
  const rawRedirect = searchParams.get('redirect') || ''
  const redirectQuery = rawRedirect ? `?redirect=${encodeURIComponent(rawRedirect)}` : ''
  const companyRegisterHref = `/register${redirectQuery}`
  // Customer accounts are tenant-scoped. If the redirect points to a specific
  // store, register there; otherwise send the shopper to pick a store.
  const redirectTenantSlug = getTenantSlugFromPathname(rawRedirect)
  const customerRegisterHref = redirectTenantSlug
    ? `/${redirectTenantSlug}/cliente/registro`
    : `/cliente/registro${redirectQuery}`
  // When arriving from the marketplace or a store, show storefront branding
  // instead of the SaaS (business) header to avoid mixing both worlds.
  const isCustomerContext = Boolean(redirectTenantSlug) || rawRedirect.startsWith('/marketplace')
  const backHref = isCustomerContext ? (rawRedirect || '/marketplace') : '/saas'

  const initializeActiveOrganization = async () => {
    try {
      const response = await fetch('/api/organizations', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok && response.status !== 404) {
        console.warn('No se pudo inicializar la organizacion activa:', response.status)
      }
    } catch (organizationError) {
      console.warn('No se pudo inicializar la organizacion activa:', organizationError)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnconfirmed(false)

    const normalizedEmail = email.trim().toLowerCase()

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        const msg = error.message || (typeof error === 'string' ? error : 'Error al iniciar sesion')
        if (/email not confirmed/i.test(msg)) {
          setUnconfirmed(true)
          setError('Credenciales incorrectas o cuenta no confirmada.')
        } else if (msg.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas o cuenta no confirmada.')
        } else if (/Failed to fetch|Network|fetch/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Verifica tu conexion a internet.')
        } else {
          setError('Credenciales incorrectas o cuenta no confirmada.')
        }
      } else {
        if (data?.user) {
          try {
            const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
            await logAuthEventClient({
              userId: data.user.id,
              action: 'login',
              success: true,
              userAgent,
              details: {},
            })
          } catch (logError) {
            console.error('Error logging auth event from login page:', logError)
          }
        }

        toast.success('Bienvenido de nuevo')
        await initializeActiveOrganization()
        const redirectTo = sanitizeRedirectPath(searchParams.get('redirect'))
        router.push(redirectTo)
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
    const emailValid = isValidEmail(targetEmail)
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
    const targetEmail = resetEmail.trim().toLowerCase()
    if (!targetEmail) return
    if (!isValidEmail(targetEmail)) {
      toast.error('Correo invalido')
      return
    }

    try {
      setResetLoading(true)
      // Usar la URL canonica configurada para no generar enlaces a localhost
      // cuando el reset se dispara desde un entorno de desarrollo.
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '')

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        // Apuntar directo a la pagina (client-side) para que el SDK del
        // navegador pueda leer la sesion del hash (#access_token). El callback
        // del servidor no puede leer el hash y rebota a /login.
        redirectTo: baseUrl ? `${baseUrl}/auth/reset-password` : undefined,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Te enviamos un enlace para restablecer tu contrasena')
        setResetOpen(false)
      }
    } catch {
      toast.error('No se pudo enviar el correo de reseteo')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {isCustomerContext ? (
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href={backHref} className="flex items-center gap-3">
              {branding.logoUrl ? (
                <div className="flex h-10 items-center">
                  <img src={branding.logoUrl} alt={branding.marketplaceName} className="h-10 w-auto max-w-[180px] object-contain" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white">
                  <Store className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="text-sm font-semibold leading-none text-white">{branding.marketplaceName}</div>
                <div className="mt-1 text-xs text-slate-400">{branding.marketplaceTagline}</div>
              </div>
            </Link>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>
        </header>
      ) : (
        <SaaSPublicNav variant="dark" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(14,165,233,0.13),transparent_34%),radial-gradient(circle_at_86%_82%,rgba(37,99,235,0.12),transparent_36%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35 pointer-events-none" />

      <main className="relative z-10 flex-1 flex items-start justify-center px-4 pb-6 pt-10 sm:px-6 sm:pt-14 lg:items-center lg:pt-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-800/90 bg-slate-900/88 shadow-[0_24px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {branding.logoUrl ? (
                    <div className="flex h-10 items-center">
                      <img
                        src={branding.logoUrl}
                        alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                        className="h-10 w-auto max-w-[180px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-lg ${isCustomerContext ? 'bg-cyan-600 shadow-cyan-950/30' : 'bg-blue-600 shadow-blue-950/30'}`}>
                      {isCustomerContext ? (
                        <Store className="h-5 w-5 text-white" />
                      ) : (
                        <Cpu className="h-5 w-5 text-white" />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{isCustomerContext ? branding.marketplaceName : branding.platformName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{isCustomerContext ? 'Cuenta de cliente' : branding.loginEyebrow}</p>
                  </div>
                </div>
                <Link
                  href={backHref}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {isCustomerContext ? 'Volver' : 'Inicio'}
                </Link>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">Iniciar sesion</CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  {isCustomerContext ? 'Ingresá para comprar y seguir tus pedidos.' : branding.loginSubtitle}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {registeredCompany && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Empresa creada correctamente</p>
                      <p className="mt-0.5 text-xs text-emerald-200/80">
                        Inicia sesion para completar el onboarding de {registeredCompany}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                    autoFocus
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
                      className="text-xs font-medium text-slate-400 transition-colors hover:text-cyan-300 hover:underline"
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

                <AnimatePresence>
                  {visibleError && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                      role="alert"
                      aria-live="assertive"
                    >
                      <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{visibleError}</span>
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
                  className="h-11 w-full bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500"
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

              {isCustomerContext ? (
                <div className="space-y-3 pt-1">
                  {/* Customer (shopper) sign-up — only in storefront/marketplace context */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                    <p className="text-sm font-medium text-slate-200">¿Querés comprar como cliente?</p>
                    <Link
                      href={customerRegisterHref}
                      className="mt-1 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200 hover:underline"
                    >
                      Crear cuenta de cliente
                    </Link>
                  </div>

                  {/* Business (company) sign-up — secondary here */}
                  <p className="text-center text-xs text-slate-500">
                    ¿Tenés un negocio?{' '}
                    <Link href={companyRegisterHref} className="font-semibold text-slate-300 hover:text-slate-200 hover:underline">
                      Registrá tu empresa
                    </Link>
                  </p>
                </div>
              ) : (
                /* SaaS context — only business sign-up, no customer option */
                <div className="pt-1 text-center">
                  <p className="text-sm text-slate-400">
                    No tienes cuenta?{' '}
                    <Link href={companyRegisterHref} className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">
                      Registrá tu empresa
                    </Link>
                  </p>
                </div>
              )}
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
                disabled={resetLoading}
              />
              <p className="text-xs text-muted-foreground">
                Te enviaremos un enlace para crear una nueva contrasena.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetLoading}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={!resetEmail.trim() || resetLoading}>
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
