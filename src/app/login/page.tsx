'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Cpu,
  Shield,
  CheckCircle2,
  Store,
  Mail,
  Lock,
  Sparkles,
  Wrench,
  Boxes,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { sanitizeRedirectPath, isValidEmail } from '@/lib/auth/password-validation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { logAuthEventClient } from '@/lib/auth-event-client'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { siteUrl } from '@/lib/site-url'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetEmailError, setResetEmailError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [resetCaptchaToken, setResetCaptchaToken] = useState<string | null>(null)
  const [resetCaptchaKey, setResetCaptchaKey] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const reduceMotion = useReducedMotion()
  const { branding } = usePlatformBranding()
  const registeredCompany = searchParams.get('registered') === '1' ? searchParams.get('company') : null
  const callbackError =
    searchParams.get('error') === 'auth_callback_error'
      ? 'No se pudo completar la verificación del enlace. Solicitá uno nuevo o iniciá sesión nuevamente.'
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
  const backHref = isCustomerContext ? rawRedirect || '/marketplace' : '/saas'

  const initializeActiveOrganization = async () => {
    try {
      const response = await fetch('/api/organizations', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok && response.status !== 404) {
        console.warn('No se pudo inicializar la organización activa:', response.status)
      }
    } catch (organizationError) {
      console.warn('No se pudo inicializar la organización activa:', organizationError)
    }
  }

  const validateFields = () => {
    let isValid = true
    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setEmailError('Ingresá tu correo electrónico.')
      isValid = false
    } else if (!isValidEmail(cleanEmail)) {
      setEmailError('Ingresá un formato de correo válido (ej: nombre@empresa.com).')
      isValid = false
    } else {
      setEmailError('')
    }

    if (!password) {
      setPasswordError('Ingresá tu contraseña de acceso.')
      isValid = false
    } else if (password.length < 4) {
      setPasswordError('La contraseña debe tener al menos 4 caracteres.')
      isValid = false
    } else {
      setPasswordError('')
    }

    return isValid
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateFields()) {
      return
    }

    if (!captchaToken || loading) {
      setError('Por favor, completá la verificación de seguridad para continuar.')
      return
    }

    setLoading(true)
    setError('')
    setUnconfirmed(false)

    const normalizedEmail = email.trim().toLowerCase()

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
        options: { captchaToken },
      })

      if (authError) {
        const msg = authError.message || (typeof authError === 'string' ? authError : 'Error al iniciar sesión')

        if (/email not confirmed/i.test(msg)) {
          setUnconfirmed(true)
          setError('Tu cuenta aún no fue confirmada. Revisá tu bandeja de entrada o hacé clic abajo para reenviar el enlace.')
        } else if (/invalid login credentials|invalid_grant/i.test(msg)) {
          setError('El correo o la contraseña ingresados no son correctos. Verificá los datos e intentá de nuevo.')
        } else if (/rate limit|too many requests|over_request_rate_limit/i.test(msg)) {
          setError('Demasiados intentos fallidos. Por seguridad, esperá unos minutos antes de volver a intentar.')
        } else if (/Failed to fetch|Network|fetch/i.test(msg)) {
          setError('No se pudo conectar con el servidor. Verificá tu conexión a internet.')
        } else {
          setError('El correo o la contraseña no coinciden con ninguna cuenta activa.')
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

        toast.success('¡Bienvenido de nuevo!')
        await initializeActiveOrganization()
        const rawRedirectParam = searchParams.get('redirect')
        let redirectTo = '/dashboard'

        if (rawRedirectParam) {
          const cleanRedirect = sanitizeRedirectPath(rawRedirectParam)
          const redirectSlug = getTenantSlugFromPathname(cleanRedirect)
          const isCustomerOrOtherSection = cleanRedirect.startsWith('/marketplace') || redirectSlug !== ''

          if (isCustomerOrOtherSection) {
            redirectTo = cleanRedirect
          }
        }

        router.push(redirectTo)
        router.refresh()
      }
    } catch (err) {
      console.error('Unexpected login error:', err)
      setError('Ocurrió un error inesperado. Por favor, intentá de nuevo.')
    } finally {
      setLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim()
    if (!targetEmail) {
      toast.error('Ingresá tu correo para reenviar la confirmación.')
      return
    }
    const emailValid = isValidEmail(targetEmail)
    if (!emailValid) {
      toast.error('El formato de correo no es válido.')
      return
    }
    try {
      setResendLoading(true)
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: origin ? { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` } : undefined,
      })
      if (resendError) {
        toast.error(resendError.message)
      } else {
        toast.success('Te enviamos nuevamente el correo de confirmación.')
        setUnconfirmed(false)
      }
    } catch {
      toast.error('No se pudo reenviar el correo de confirmación.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleResetPassword = async () => {
    const targetEmail = resetEmail.trim().toLowerCase()
    if (!targetEmail) {
      setResetEmailError('Ingresá tu correo electrónico.')
      return
    }
    if (!isValidEmail(targetEmail)) {
      setResetEmailError('Ingresá un correo electrónico válido (ej: nombre@empresa.com).')
      return
    }
    setResetEmailError('')
    if (!resetCaptchaToken || resetLoading) {
      toast.error('Completá la verificación de seguridad para continuar.')
      return
    }

    try {
      setResetLoading(true)
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: siteUrl('/auth/reset-password'),
        captchaToken: resetCaptchaToken,
      })

      if (resetErr) {
        toast.error(resetErr.message || 'No se pudo procesar la solicitud.')
      } else {
        toast.success('Te enviamos un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada.')
        setResetOpen(false)
        setResetEmail('')
      }
    } catch {
      toast.error('No se pudo enviar el correo de recuperación. Intentá de nuevo.')
    } finally {
      setResetLoading(false)
      setResetCaptchaToken(null)
      setResetCaptchaKey((current) => current + 1)
    }
  }

  return (
    <div className="relative flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background ambient lighting and fine technical grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[25%] -left-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl" />
        <div className="absolute top-[30%] -right-[15%] w-[65vw] h-[65vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-cyan-600/15 via-teal-600/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-t from-blue-900/15 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_95%)]" />
      </div>

      {/* Top Header Navigation */}
      {isCustomerContext ? (
        <header className="relative z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href={backHref} className="flex items-center gap-3.5 group transition-transform active:scale-95">
              {branding.logoUrl ? (
                <div className="relative flex items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-900/80 px-2.5 py-1.5 shadow-sm backdrop-blur-md group-hover:border-cyan-500/40 transition-colors">
                  <img
                    src={branding.logoUrl}
                    alt={branding.marketplaceName}
                    className="h-8 w-auto max-w-[170px] object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-950/50 border border-white/10 group-hover:shadow-cyan-500/25 transition-all">
                  <Store className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold leading-none text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                  {branding.marketplaceName}
                </div>
                <div className="mt-1 text-xs text-slate-400">{branding.marketplaceTagline}</div>
              </div>
            </Link>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-all"
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Volver a la tienda
              </Link>
            </Button>
          </div>
        </header>
      ) : (
        <div className="relative z-30">
          <SaaSPublicNav variant="dark" />
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Feature Highlights & Brand Identity Showcase (Visible on Desktop) */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -20 }}
            animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between space-y-8 pr-4"
          >
            <div className="space-y-6">
              {/* Brand Showcase Header */}
              <div className="flex items-center gap-3.5 pb-2">
                {branding.logoDarkUrl || branding.logoUrl ? (
                  <div className="relative flex items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md ring-1 ring-white/10">
                    <img
                      src={branding.logoDarkUrl || branding.logoUrl}
                      alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                      className="h-10 w-auto max-w-[190px] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                    />
                  </div>
                ) : (
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-500 text-white shadow-xl shadow-blue-950/50 border border-white/10">
                    {isCustomerContext ? <Store className="h-6 w-6" /> : <Cpu className="h-6 w-6" />}
                  </div>
                )}
                <div>
                  <div className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>{isCustomerContext ? branding.marketplaceName : branding.platformName}</span>
                  </div>
                  <div className="text-xs font-medium text-cyan-400">
                    {isCustomerContext ? branding.marketplaceTagline || 'Tu marketplace de confianza' : 'Sistema de Gestión & Ventas'}
                  </div>
                </div>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-300 shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>{isCustomerContext ? 'Portal de Compras y Seguimiento' : 'Plataforma SaaS para Negocios y Talleres'}</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {isCustomerContext ? (
                  <>
                    Accedé a tus pedidos, <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">favoritos y reparaciones</span> en tiempo real.
                  </>
                ) : (
                  <>
                    Control total de tu taller, <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">ventas e inventario</span> en una sola plataforma.
                  </>
                )}
              </h1>

              <p className="text-sm xl:text-base text-slate-300 leading-relaxed max-w-xl">
                {isCustomerContext
                  ? 'Gestioná tus órdenes de compra, seguí el estado de tus equipos en servicio técnico y descubrí las mejores ofertas en un solo lugar.'
                  : 'Automatizá órdenes de servicio técnico, emití presupuestos, controlá stock con variantes y publicá tus productos en tu propio e-commerce sincronizado.'}
              </p>

              {/* Visual Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {isCustomerContext ? (
                  <>
                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 mb-3 border border-cyan-500/20">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Seguimiento de Taller</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Consultá el avance y diagnóstico de tus reparaciones en vivo con código de orden.
                      </p>
                    </div>

                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3 border border-blue-500/20">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Compras & Favoritos</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Guardá tus productos preferidos, agrupalos por tienda y gestioná tus pedidos fácilmente.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 mb-3 border border-cyan-500/20">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Gestión de Reparaciones</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Costos internos, rentabilidad neta por orden, asignación a técnicos y notificaciones al cliente.
                      </p>
                    </div>

                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3 border border-blue-500/20">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Inventario y POS Rápido</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Control multi-sucursal, lectura de código de barras, variantes y actualización de stock inmediata.
                      </p>
                    </div>

                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 mb-3 border border-indigo-500/20">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Métricas y Rentabilidad</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Reportes automáticos de ganancias, ticket promedio y rendimiento por canal de venta.
                      </p>
                    </div>

                    <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-900/90">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 mb-3 border border-emerald-500/20">
                        <Store className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-200">Tienda Online & Catálogo</h2>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Tu propio storefront público optimizado para móviles con carrito y pedidos por WhatsApp.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Sleek Auth Card */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full lg:col-span-6 xl:col-span-5 max-w-md mx-auto"
          >
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-slate-700/80 via-slate-800/50 to-slate-900/90 shadow-[0_24px_80px_rgba(2,6,23,0.7)] backdrop-blur-2xl">
              <div className="rounded-[23px] bg-slate-900/90 p-6 sm:p-8 backdrop-blur-2xl">
                
                {/* Header inside Card */}
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {branding.logoDarkUrl || branding.logoUrl ? (
                        <div className="relative flex items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-950/70 p-2 shadow-md backdrop-blur-md">
                          <img
                            src={branding.logoDarkUrl || branding.logoUrl}
                            alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                            className="h-9 w-auto max-w-[160px] object-contain drop-shadow"
                          />
                        </div>
                      ) : (
                        <div
                          className={`relative flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg border border-white/10 ${
                            isCustomerContext
                              ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-cyan-950/50'
                              : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-600 shadow-blue-950/50'
                          }`}
                        >
                          {isCustomerContext ? (
                            <Store className="h-5 w-5 text-white" />
                          ) : (
                            <Cpu className="h-5 w-5 text-white" />
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-100 tracking-tight">
                          {isCustomerContext ? branding.marketplaceName : branding.platformName}
                        </p>
                        <div className="inline-flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          <p className="text-[11px] text-slate-400 font-medium">
                            {isCustomerContext ? 'Portal Cliente' : branding.loginEyebrow || 'Acceso Empresa'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={backHref}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {isCustomerContext ? 'Volver' : 'Inicio'}
                    </Link>
                  </div>

                  <div className="pt-2">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Iniciar sesión</h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400">
                      {isCustomerContext
                        ? 'Ingresá tus credenciales para continuar tus compras y reparaciones.'
                        : branding.loginSubtitle || 'Ingresá al panel administrativo de tu empresa.'}
                    </p>
                  </div>
                </div>

                {/* Card Content & Form */}
                <div className="space-y-5">
                  {registeredCompany && (
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-200 animate-in fade-in-50">
                      <div className="flex gap-2.5 items-start">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <div>
                          <p className="font-semibold text-xs sm:text-sm text-emerald-100">¡Empresa creada con éxito!</p>
                          <p className="mt-0.5 text-xs text-emerald-200/80">
                            Iniciá sesión para comenzar a configurar {registeredCompany}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    {/* Email Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-slate-200 text-xs font-medium">
                        Correo electrónico
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="nombre@empresa.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (emailError) setEmailError('')
                          }}
                          required
                          autoComplete="email"
                          autoFocus
                          className={`h-11 pl-10 rounded-xl bg-slate-950/70 text-white placeholder:text-slate-500 transition-all ${
                            emailError
                              ? 'border-red-500/80 focus-visible:ring-red-500/30'
                              : 'border-slate-700/80 focus-visible:border-cyan-500/80 focus-visible:ring-cyan-500/30'
                          }`}
                          disabled={loading}
                        />
                      </div>
                      {emailError && (
                        <p className="text-[11px] text-red-400 font-medium pl-1 animate-in fade-in-50 duration-200">
                          {emailError}
                        </p>
                      )}
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-slate-200 text-xs font-medium">
                          Contraseña
                        </Label>
                        <button
                          type="button"
                          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                          onClick={() => setResetOpen(true)}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (passwordError) setPasswordError('')
                          }}
                          required
                          autoComplete="current-password"
                          className={`h-11 pl-10 pr-11 rounded-xl bg-slate-950/70 text-white placeholder:text-slate-500 transition-all ${
                            passwordError
                              ? 'border-red-500/80 focus-visible:ring-red-500/30'
                              : 'border-slate-700/80 focus-visible:border-cyan-500/80 focus-visible:ring-cyan-500/30'
                          }`}
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-cyan-400 hover:bg-slate-800"
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[11px] text-red-400 font-medium pl-1 animate-in fade-in-50 duration-200">
                          {passwordError}
                        </p>
                      )}
                    </div>

                    {/* Error Banner */}
                    <AnimatePresence>
                      {visibleError && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                          className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-300 leading-relaxed shadow-sm"
                          role="alert"
                          aria-live="assertive"
                        >
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                          <span>{visibleError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Unconfirmed Email Alert */}
                    {unconfirmed && (
                      <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3.5 space-y-2.5">
                        <p className="text-xs text-cyan-200 leading-relaxed">
                          Tu cuenta aún no está confirmada. Revisá tu bandeja de entrada y spam o reenviá el enlace.
                        </p>
                        <Button
                          type="button"
                          onClick={handleResendConfirmation}
                          disabled={loading || resendLoading}
                          className="h-8 w-full text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-sm transition-all"
                        >
                          {resendLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Enviando enlace...
                            </span>
                          ) : (
                            'Reenviar correo de verificación'
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Security Captcha Challenge */}
                    <div className="pt-1 flex justify-center">
                      <TurnstileChallenge
                        action="login"
                        onTokenChange={setCaptchaToken}
                        resetKey={captchaResetKey}
                        theme="dark"
                        disabled={loading}
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="h-11 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-500 font-semibold text-white shadow-lg shadow-blue-900/30 transition-all rounded-xl active:scale-[0.99] disabled:opacity-50"
                      disabled={loading || !captchaToken}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Iniciando sesión...
                        </>
                      ) : (
                        <>
                          Iniciar sesión
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Contextual Sign Up Options */}
                  <div className="pt-2 border-t border-slate-800/70">
                    {isCustomerContext ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3.5 text-center">
                          <p className="text-xs text-slate-300 font-medium">¿Querés comprar o seguir tus órdenes?</p>
                          <Link
                            href={customerRegisterHref}
                            className="mt-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                          >
                            Crear cuenta de cliente gratis
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>

                        <p className="text-center text-xs text-slate-400">
                          ¿Tenés un negocio o taller?{' '}
                          <Link
                            href={companyRegisterHref}
                            className="font-semibold text-slate-200 hover:text-white hover:underline transition-colors"
                          >
                            Registrá tu empresa
                          </Link>
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <p className="text-xs sm:text-sm text-slate-400">
                          ¿No tenés una cuenta para tu empresa?{' '}
                        </p>
                        <Button
                          asChild
                          variant="outline"
                          className="w-full h-10 border-slate-700/80 bg-slate-950/50 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all"
                        >
                          <Link href={companyRegisterHref} className="gap-2">
                            <span>Registrar mi empresa</span>
                            <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Password Reset Modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl border-slate-800 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 mb-1">
              <Lock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Restablecer contraseña
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-400">
              Ingresá el correo asociado a tu cuenta y te enviaremos un enlace seguro para crear una nueva contraseña.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="resetEmail" className="text-xs font-medium text-slate-200">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value)
                    if (resetEmailError) setResetEmailError('')
                  }}
                  disabled={resetLoading}
                  className={`h-11 pl-10 rounded-xl bg-slate-950/80 text-white placeholder:text-slate-500 ${
                    resetEmailError ? 'border-red-500/80' : 'border-slate-700/80 focus-visible:ring-cyan-500/30'
                  }`}
                />
              </div>
              {resetEmailError && (
                <p className="text-[11px] text-red-400 font-medium pl-1">
                  {resetEmailError}
                </p>
              )}
            </div>

            <div className="flex justify-center pt-1">
              <TurnstileChallenge
                action="password_reset"
                onTokenChange={setResetCaptchaToken}
                resetKey={resetCaptchaKey}
                theme="dark"
                disabled={resetLoading}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                onClick={() => setResetOpen(false)}
                disabled={resetLoading}
                className="h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={!resetEmail.trim() || resetLoading || !resetCaptchaToken}
                className="h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all px-4"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Enviando enlace...
                  </>
                ) : (
                  'Enviar enlace de recuperación'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
