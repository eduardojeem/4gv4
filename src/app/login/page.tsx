'use client'

import { AppImage } from '@/components/ui/app-image'

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
  Shield,
  CheckCircle2,
  Mail,
  Lock,
  Store, Building2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { sanitizeRedirectPath, isValidEmail } from '@/lib/auth/password-validation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { logAuthEventClient } from '@/lib/auth-event-client'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { resolveLogoSize } from '@/lib/platform/logo-size'
import { siteUrl } from '@/lib/site-url'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'

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
  const logoSize = resolveLogoSize(branding)
  const currentHeight = logoSize.className || 'h-10'
  const darkGlowClass =
    branding.logoGlowDark !== false
      ? 'drop-shadow-[0_3px_18px_rgba(6,182,212,0.4)]'
      : 'drop-shadow-xs'

  const registeredCompany = searchParams.get('registered') === '1' ? searchParams.get('company') : null
  const esperaConfirmacion = registeredCompany !== null && searchParams.get('confirmar') === '1'
  const callbackError =
    searchParams.get('error') === 'auth_callback_error'
      ? 'No se pudo completar la verificación del enlace. Solicitá uno nuevo o iniciá sesión nuevamente.'
      : ''
  const visibleError = error || callbackError

  const rawRedirect = searchParams.get('redirect') || ''
  const redirectQuery = rawRedirect ? `?redirect=${encodeURIComponent(rawRedirect)}` : ''
  const companyRegisterHref = `/register${redirectQuery}`
  const redirectTenantSlug = getTenantSlugFromPathname(rawRedirect)
  const customerRegisterHref = redirectTenantSlug
    ? `/${redirectTenantSlug}/cliente/registro`
    : `/cliente/registro${redirectQuery}`
  const isCustomerContext = Boolean(redirectTenantSlug) || rawRedirect.startsWith('/marketplace')
  const backHref = isCustomerContext ? rawRedirect || '/marketplace' : '/saas'

  const initializeActiveOrganization = async () => {
    try {
      const response = await fetch('/api/organizations', { method: 'GET', cache: 'no-store' })
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

    if (!validateFields()) return

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
        // Se vuelve a donde estaba la persona. Antes sólo se respetaba el
        // marketplace y las tiendas: desde cualquier otra página pública, una
        // cuenta con negocio terminaba en el panel sin haberlo pedido.
        // `sanitizeRedirectPath` descarta lo que no sea una ruta interna.
        const rawRedirectParam = searchParams.get('redirect')
        const redirectTo = rawRedirectParam ? sanitizeRedirectPath(rawRedirectParam) : '/dashboard'

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
    if (!isValidEmail(targetEmail)) {
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
    <div className="relative flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      {/* Top Header Navigation */}
      {isCustomerContext ? (
        <header className="relative z-30 border-b border-slate-200 bg-white/95 dark:border-slate-800/80 dark:bg-slate-950/90 backdrop-blur-xl shadow-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href={backHref} className="flex items-center gap-3.5 group transition-transform active:scale-95">
              {branding.logoUrl ? (
                <div className="relative flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 px-2.5 py-1.5 shadow-sm backdrop-blur-md group-hover:border-blue-400/60 dark:group-hover:border-cyan-500/40 transition-colors">
                  <AppImage src={branding.logoUrl} alt={branding.marketplaceName} className="h-8 w-auto max-w-[170px] object-contain" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-cyan-950/50 border border-blue-100 dark:border-white/10 transition-all">
                  <Store className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold leading-none text-slate-800 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                  {branding.marketplaceName}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{branding.marketplaceTagline}</div>
              </div>
            </Link>
            <Button asChild variant="outline" size="sm" className="gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all shadow-sm dark:shadow-none">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Volver a la tienda
              </Link>
            </Button>
          </div>
        </header>
      ) : (
        <div className="relative z-30">
          <SaaSPublicNav variant="default" />
        </div>
      )}

      {/* Background Image Wallpaper with light/dark overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <AppImage
          src="/images/login-cover.png"
          alt="Fondo de pantalla"
          className="w-full h-full object-cover object-center dark:brightness-[0.35] dark:saturate-60 transition-all duration-300"
        />
        {/* Overlay suave para legibilidad: claro blanco traslúcido, oscuro slate profundo */}
        <div className="absolute inset-0 bg-slate-900/15 dark:bg-slate-950/75 backdrop-blur-[2px] transition-colors" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-white/30 dark:from-slate-950/80 dark:via-transparent dark:to-slate-950/40" />
      </div>

      {/* Main Content Area — Centered clean login card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Tarjeta de login flotante con bordes redondeados y glassmorphism */}
          <div className="rounded-3xl border border-white/80 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/90 p-6 sm:p-9 shadow-2xl shadow-slate-950/15 dark:shadow-black/70 backdrop-blur-2xl">

            {/* Logo + Title */}
            <div className="mb-7 text-center">
              {branding.logoUrl || branding.logoDarkUrl ? (
                <div className="mb-4 flex justify-center">
                  {branding.logoUrl && branding.logoDarkUrl ? (
                    <>
                      <AppImage
                        src={branding.logoUrl}
                        alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                        className={`${currentHeight} w-auto max-w-[200px] object-contain drop-shadow-xs dark:hidden`}
                        style={logoSize.style}
                      />
                      <AppImage
                        src={branding.logoDarkUrl}
                        alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                        className={`${currentHeight} w-auto max-w-[200px] object-contain ${darkGlowClass} hidden dark:block`}
                        style={logoSize.style}
                      />
                    </>
                  ) : (
                    <AppImage
                      src={branding.logoUrl || branding.logoDarkUrl}
                      alt={isCustomerContext ? branding.marketplaceName : branding.platformName}
                      className={`${currentHeight} w-auto max-w-[200px] object-contain drop-shadow-xs`}
                      style={logoSize.style}
                    />
                  )}
                </div>
              ) : (
                <div className="mb-4 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Iniciar sesión
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isCustomerContext
                  ? 'Accedé a tus pedidos y reparaciones.'
                  : branding.loginSubtitle || 'Accedé al panel de tu empresa.'}
              </p>
            </div>

            {/* Success: registered company */}
            {registeredCompany && (
              <div className="mb-5 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold text-xs">¡Empresa creada con éxito!</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    {esperaConfirmacion
                      ? `Revisá tu correo para activar la cuenta de ${registeredCompany}.`
                      : `Iniciá sesión para configurar ${registeredCompany}.`}
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    className={`h-11 pl-10 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 transition-all border ${
                      emailError
                        ? 'border-red-400 focus-visible:ring-red-400/30'
                        : 'border-slate-200/90 dark:border-slate-800 focus-visible:border-blue-500 focus-visible:ring-blue-500/20'
                    }`}
                  />
                </div>
                {emailError && <p className="text-[11px] text-red-500 font-medium pl-1 animate-in fade-in-50 duration-200">{emailError}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Contraseña
                  </Label>
                  <button type="button" className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors" onClick={() => setResetOpen(true)}>
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
                    onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError('') }}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className={`h-11 pl-10 pr-11 rounded-xl bg-slate-50/80 text-slate-900 placeholder:text-slate-400 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 transition-all border ${
                      passwordError
                        ? 'border-red-400 focus-visible:ring-red-400/30'
                        : 'border-slate-200/90 dark:border-slate-800 focus-visible:border-blue-500 focus-visible:ring-blue-500/20'
                    }`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-[11px] text-red-500 font-medium pl-1 animate-in fade-in-50 duration-200">{passwordError}</p>}
              </div>

              {/* Error */}
              <AnimatePresence>
                {visibleError && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                    role="alert"
                    aria-live="assertive"
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{visibleError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unconfirmed email */}
              {unconfirmed && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 space-y-2.5 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Tu cuenta aún no está confirmada. Revisá tu bandeja de entrada y spam o reenviá el enlace.
                  </p>
                  <Button type="button" onClick={handleResendConfirmation} disabled={loading || resendLoading} className="h-8 w-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm">
                    {resendLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando enlace...</span> : 'Reenviar correo de verificación'}
                  </Button>
                </div>
              )}

              {/* Captcha */}
              <div className="flex justify-center pt-1">
                <TurnstileChallenge action="login" onTokenChange={setCaptchaToken} resetKey={captchaResetKey} theme="auto" disabled={loading} />
              </div>

              {/* Submit */}
              <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-semibold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.99] disabled:opacity-50" disabled={loading || !captchaToken}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : <>Iniciar sesión<ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>

            {/* Sign up section */}
            <div className="mt-6 border-t border-slate-200/80 dark:border-slate-800/80 pt-5 space-y-3.5 text-center">
              {isCustomerContext ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">¿Querés comprar o seguir tus pedidos?</p>
                    <Link
                      href={customerRegisterHref}
                      className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
                    >
                      Crear cuenta de cliente gratis
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="pt-1 text-left space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                      ¿Tenés un negocio o taller?
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-11 rounded-xl border-2 border-blue-500/30 hover:border-blue-600 dark:border-cyan-500/40 dark:hover:border-cyan-400 bg-blue-50/60 hover:bg-blue-100/80 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-blue-700 dark:text-cyan-300 font-bold text-sm shadow-xs transition-all active:scale-[0.99]"
                    >
                      <Link href={companyRegisterHref} className="flex items-center justify-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <span>Registrar mi empresa</span>
                        <ArrowRight className="h-4 w-4 ml-auto text-blue-600 dark:text-cyan-400 shrink-0" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    ¿No tenés una cuenta para tu empresa?
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-11 rounded-xl border-2 border-blue-500/35 hover:border-blue-600 dark:border-cyan-500/40 dark:hover:border-cyan-400 bg-blue-50/70 hover:bg-blue-100/90 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-blue-700 dark:text-cyan-300 font-bold text-sm shadow-xs transition-all active:scale-[0.99]"
                  >
                    <Link href={companyRegisterHref} className="flex items-center justify-center gap-2.5">
                      <Building2 className="h-4.5 w-4.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                      <span>Registrar mi empresa</span>
                      <ArrowRight className="h-4 w-4 ml-auto text-blue-600 dark:text-cyan-400 shrink-0" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

          </div>{/* end card */}
        </motion.div>
      </main>


      {/* Password Reset Modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 mb-1">
              <Lock className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Restablecer contraseña
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Ingresá el correo asociado a tu cuenta y te enviaremos un enlace seguro para crear una nueva contraseña.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="resetEmail" className="text-xs font-medium text-slate-700 dark:text-slate-300">
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
                  className={`h-11 pl-10 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 border ${
                    resetEmailError
                      ? 'border-red-400 focus-visible:ring-red-400/30'
                      : 'border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500/20'
                  }`}
                />
              </div>
              {resetEmailError && (
                <p className="text-[11px] text-red-500 font-medium pl-1">
                  {resetEmailError}
                </p>
              )}
            </div>

            <div className="flex justify-center pt-1">
              <TurnstileChallenge
                action="password_reset"
                onTokenChange={setResetCaptchaToken}
                resetKey={resetCaptchaKey}
                theme="auto"
                disabled={resetLoading}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                variant="ghost"
                onClick={() => setResetOpen(false)}
                disabled={resetLoading}
                className="h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={!resetEmail.trim() || resetLoading || !resetCaptchaToken}
                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm px-4"
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
