'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, ArrowRight, Shield, Sparkles, CheckCircle2, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { validatePassword, getPasswordChecks } from '@/lib/auth/password-validation'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { useSlugAvailability } from '@/hooks/use-slug-availability'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { createClient } from '@/lib/supabase/client'

/**
 * Tiers que la API acepta. Se usan solo para validar lo que llega por la URL:
 * el nombre que ve el usuario sale de la base, porque el codigo interno y el
 * nombre comercial no coinciden (por ejemplo el tier `free` puede ser un plan
 * pago llamado "Lite"). Mostrar el tier hacia que quien clickeaba "Lite"
 * terminara leyendo "Plan seleccionado: FREE".
 */
const VALID_PLAN_TIERS = ['free', 'basic', 'pro', 'enterprise'] as const

type SelectedPlanInfo = { tier: string; name: string; price: number; trialDays: number } | null

// Maps API field names to friendly display labels for inline errors.
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Nombre completo',
  email: 'Correo electrónico',
  password: 'Contraseña',
  companyName: 'Nombre de la empresa',
  companySlug: 'Subdominio',
  plan: 'Plan',
}

type FieldErrors = Record<string, string>

function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    companySlug: '',
  })
  // Track whether the user has manually edited the slug field.
  const [slugTouched, setSlugTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Per-field inline errors (from Zod or client-side validation).
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()

  const rawRedirect = searchParams.get('redirect') || ''
  const loginHref = rawRedirect ? `/login?redirect=${encodeURIComponent(rawRedirect)}` : '/login'
  const planParam = searchParams.get('plan')?.toLowerCase().trim() ?? ''

  // El nombre comercial se lee de la base y no se deduce del tier: son cosas
  // distintas (el tier `free` puede ser un plan pago llamado "Lite"), y mostrar
  // el codigo interno hacia parecer que se habia elegido otro plan.
  const [planInfo, setPlanInfo] = useState<SelectedPlanInfo>(null)

  useEffect(() => {
    // Formato de URL, no autorizacion: evita mandar basura a la consulta. Lo que
    // decide el plan real es la fila que devuelve la base.
    if (!planParam || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(planParam)) {
      setPlanInfo(null)
      return
    }

    let cancelled = false
    const supabase = createClient()

    void supabase
      .from('subscription_plans')
      .select('tier, public_slug, name, price, trial_days')
      .eq('is_active', true)
      // Se busca por el slug publico y tambien por el tier, para que los enlaces
      // viejos (/register?plan=free) sigan funcionando.
      .or(`public_slug.eq.${planParam},tier.eq.${planParam}`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setPlanInfo({
          tier: data.tier,
          name: data.name,
          price: Number(data.price) || 0,
          trialDays: Number(data.trial_days) || 0,
        })
      })

    return () => { cancelled = true }
  }, [planParam])

  // El tier que se envia sale SIEMPRE de la fila encontrada, nunca de la URL:
  // asi un parametro armado a mano no puede pedir un plan que no existe o esta
  // desactivado. Sin plan resuelto se usa el de entrada, como antes.
  const selectedPlan = planInfo && (VALID_PLAN_TIERS as readonly string[]).includes(planInfo.tier)
    ? planInfo.tier
    : 'free'

  // Always resolve slug: prefer what the user typed, fall back to slugified company name.
  const previewSlug = slugifyTenantName(formData.companySlug || formData.companyName)

  // Se verifica mientras se escribe. Antes la colision aparecia recien al
  // enviar, y como el captcha se reinicia en cada intento fallido, corregir el
  // subdominio obligaba a resolverlo de nuevo.
  const slugStatus = useSlugAvailability(previewSlug)
  const slugOcupado = slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido'
  const slugSugerencia = slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido'
    ? slugStatus.sugerencia
    : null

  const aplicarSugerencia = (sugerencia: string) => {
    setSlugTouched(true)
    setFormData((prev) => ({ ...prev, companySlug: sugerencia }))
    setFieldErrors((prev) => { const next = { ...prev }; delete next.companySlug; return next })
  }

  const handleInputChange = (field: string, value: string) => {
    // Clear per-field error when the user starts correcting that field.
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
    }
    if (error) setError('')

    if (field === 'companyName' && !slugTouched) {
      // La sugerencia se escribe en el campo, no solo como placeholder: antes el
      // subdominio quedaba vacio y el texto gris no dejaba claro que ese iba a
      // ser el valor real, ni invitaba a ajustarlo antes de crear la empresa.
      setFormData((prev) => ({
        ...prev,
        companyName: value,
        companySlug: slugifyTenantName(value),
      }))
      return
    }
    if (field === 'companySlug') {
      const touched = value.trim().length > 0
      setSlugTouched(touched)

      // Al vaciarlo vuelve a sugerirse desde el nombre, en vez de quedar en
      // blanco esperando que el usuario adivine que hacer.
      if (!touched) {
        setFormData((prev) => ({ ...prev, companySlug: slugifyTenantName(prev.companyName) }))
        return
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})

    // Client-side validations — fast, no round-trip.
    const clientErrors: FieldErrors = {}

    if (!formData.fullName.trim()) {
      clientErrors.fullName = 'El nombre completo es requerido'
    }

    if (!formData.companyName.trim()) {
      clientErrors.companyName = 'El nombre de la empresa es requerido'
    }

    if (formData.password !== formData.confirmPassword) {
      clientErrors.confirmPassword = 'Las contraseñas no coinciden'
    } else {
      const passwordError = validatePassword(formData.password)
      if (passwordError) clientErrors.password = passwordError
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      setLoading(false)
      return
    }

    if (!captchaToken) {
      setError('Completa la verificacion de seguridad para continuar.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          companySlug: previewSlug,
          plan: selectedPlan,
          captchaToken,
        }),
      })

      const result = await response.json()

      if (response.status === 429) {
        setError(result.error || 'Demasiados intentos de registro. Intenta nuevamente en unos minutos.')
        setLoading(false)
        return
      }

      // Map server-side field errors (from Zod) into inline UI errors.
      if (!response.ok || !result.success) {
        if (Array.isArray(result.fieldErrors) && result.fieldErrors.length > 0) {
          const serverFieldErrors: FieldErrors = {}
          for (const { field, message } of result.fieldErrors as { field: string; message: string }[]) {
            serverFieldErrors[field] = message
          }
          setFieldErrors(serverFieldErrors)
          // Also set a summary error for screen readers / users who might miss inline errors.
          const firstField = result.fieldErrors[0]?.field ?? ''
          const label = FIELD_LABELS[firstField] ?? firstField
          setError(label ? `Revisá el campo "${label}".` : 'Revisá el formulario.')
        } else {
          setError(result.error || 'No se pudo crear la cuenta.')
        }
        setLoading(false)
        return
      }

      toast.success(
        result.data?.requiresEmailConfirmation
          ? 'Empresa creada. Revisa tu correo para verificar la cuenta.'
          : 'Empresa creada correctamente. Ya puedes iniciar sesion.'
      )
      setTimeout(() => {
        const redirectTarget = encodeURIComponent('/dashboard/onboarding')
        const registeredCompany = encodeURIComponent(previewSlug)
        router.push(`/login?registered=1&company=${registeredCompany}&redirect=${redirectTarget}`)
        router.refresh()
      }, 900)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Error inesperado. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  const pwd = formData.password
  const pwdChecks = getPasswordChecks(pwd)
  const allChecksOk = pwdChecks.every((c) => c.ok)

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.16),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,0.14),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

      <SaaSPublicNav />

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-bold text-white">Crear empresa</CardTitle>
                <CardDescription className="mt-1 text-slate-400">Registro SaaS para nuevos negocios</CardDescription>
              </div>
              {planInfo && (
                <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    {/* Nombre y dias reales del plan: antes se mostraba el codigo
                        interno del tier y una prueba fija de 14 dias, asi que
                        quien elegia "Lite" leia "FREE" y una duracion que podia
                        no ser la suya. */}
                    Plan seleccionado: <strong>{planInfo.name}</strong>
                    {planInfo.price > 0 && (
                      <span className="ml-1 text-xs text-cyan-400/70">
                        · {new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(planInfo.price)}/mes
                      </span>
                    )}
                    {planInfo.trialDays > 0 && (
                      <span className="ml-1 text-xs text-cyan-400/70">
                        · {planInfo.trialDays} días de prueba gratis
                      </span>
                    )}
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                {/* Nombre completo */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-slate-200">
                    Nombre completo
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Perez"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                    aria-invalid={!!fieldErrors.fullName}
                    aria-describedby={fieldErrors.fullName ? 'err-fullName' : undefined}
                    className={`h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.fullName ? 'border-red-500/70' : ''}`}
                  />
                  {fieldErrors.fullName && (
                    <p id="err-fullName" className="text-xs text-red-400" role="alert">{fieldErrors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-200">
                    Correo electronico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'err-email' : undefined}
                    className={`h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.email ? 'border-red-500/70' : ''}`}
                  />
                  {fieldErrors.email && (
                    <p id="err-email" className="text-xs text-red-400" role="alert">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Nombre empresa */}
                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-slate-200">
                    Nombre de la empresa
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Mi empresa"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    required
                    disabled={loading}
                    aria-invalid={!!fieldErrors.companyName}
                    aria-describedby={fieldErrors.companyName ? 'err-companyName' : undefined}
                    className={`h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.companyName ? 'border-red-500/70' : ''}`}
                  />
                  {fieldErrors.companyName && (
                    <p id="err-companyName" className="text-xs text-red-400" role="alert">{fieldErrors.companyName}</p>
                  )}
                </div>

                {/* Subdominio */}
                <div className="space-y-1.5">
                  <Label htmlFor="companySlug" className="text-slate-200">
                    Subdominio{' '}
                    <span className="font-normal text-slate-500">
                      {slugTouched ? '(podés volver a dejarlo vacío para sugerirlo)' : '(sugerido desde el nombre)'}
                    </span>
                  </Label>
                  <Input
                    id="companySlug"
                    type="text"
                    placeholder={previewSlug || 'mi-empresa'}
                    value={formData.companySlug}
                    onChange={(e) => handleInputChange('companySlug', e.target.value)}
                    disabled={loading}
                    aria-invalid={!!fieldErrors.companySlug}
                    aria-describedby="hint-slug"
                    className={`h-11 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.companySlug ? 'border-red-500/70' : ''}`}
                  />
                  {fieldErrors.companySlug ? (
                    <p className="text-xs text-red-400" role="alert">{fieldErrors.companySlug}</p>
                  ) : previewSlug ? (
                    <div id="hint-slug" className="space-y-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-500">URL:</span>
                        <span className={`font-mono ${slugOcupado ? 'text-amber-400' : 'text-cyan-400'}`}>{previewSlug}</span>
                        <span className="text-slate-500">.tu-dominio.com</span>
                      </p>

                      {/* El estado se anuncia con aria-live: quien usa lector de
                          pantalla no ve el cambio de color ni el icono. */}
                      <p className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
                        {slugStatus.estado === 'consultando' && (
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            Verificando disponibilidad…
                          </span>
                        )}
                        {slugStatus.estado === 'libre' && (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Disponible
                          </span>
                        )}
                        {(slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido') && (
                          <>
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <AlertCircle className="h-3 w-3" aria-hidden="true" />
                              {slugStatus.mensaje}
                            </span>
                            {slugSugerencia && (
                              <button
                                type="button"
                                onClick={() => aplicarSugerencia(slugSugerencia)}
                                className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300 transition-colors hover:bg-cyan-500/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                              >
                                Usar {slugSugerencia}
                              </button>
                            )}
                          </>
                        )}
                        {slugStatus.estado === 'error' && (
                          <span className="text-slate-500">{slugStatus.mensaje}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p id="hint-slug" className="text-xs text-slate-500">Se genera automaticamente desde el nombre de la empresa.</p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-200">
                    Contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      aria-invalid={!!fieldErrors.password}
                      className={`h-11 border-slate-700 bg-slate-950/60 pr-11 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.password ? 'border-red-500/70' : ''}`}
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
                  {fieldErrors.password && (
                    <p className="text-xs text-red-400" role="alert">{fieldErrors.password}</p>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-slate-200">
                    Confirmar contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      className={`h-11 border-slate-700 bg-slate-950/60 pr-11 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/60 ${fieldErrors.confirmPassword ? 'border-red-500/70' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-cyan-400"
                      aria-label={showConfirmPassword ? 'Ocultar confirmacion de contrasena' : 'Mostrar confirmacion de contrasena'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-red-400" role="alert">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Checklist de contraseña con barra de progreso */}
                {pwd && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    {/* Barra de progreso */}
                    <div className="mb-2.5 flex gap-1">
                      {pwdChecks.map((item, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${item.ok ? 'bg-cyan-500' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {pwdChecks.map((item) => (
                        <li
                          key={item.label}
                          className={`flex items-center gap-1.5 ${item.ok ? 'text-emerald-400' : 'text-slate-500'}`}
                        >
                          <CheckCircle2 className={`h-3 w-3 shrink-0 ${item.ok ? 'opacity-100' : 'opacity-30'}`} />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Error global animado */}
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

                <TurnstileChallenge
                  action="company_register"
                  onTokenChange={setCaptchaToken}
                  resetKey={captchaResetKey}
                  theme="dark"
                  disabled={loading}
                />

                <Button
                  type="submit"
                  className="h-11 w-full bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60"
                  disabled={loading || !captchaToken || (pwd.length > 0 && !allChecksOk)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      Crear mi empresa
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-1 text-center">
                <p className="text-sm text-slate-400">
                  Ya tienes cuenta?{' '}
                  <Link href={loginHref} className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline">
                    Iniciar sesion
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
