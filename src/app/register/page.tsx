'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Check,
  AlertCircle,
  Store,
  Mail,
  Lock,
  User,
  Globe,
  Cpu,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { validatePassword, getPasswordChecks } from '@/lib/auth/password-validation'
import { slugifyTenantName } from '@/lib/saas/tenant'
import { useSlugAvailability } from '@/hooks/use-slug-availability'
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge'
import { createClient } from '@/lib/supabase/client'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { useTheme } from '@/contexts/theme-context'

/**
 * Los precios de los planes son de la plataforma, no de la tienda: se cobran en
 * guaranies independientemente de la moneda con la que despues facture cada
 * comercio, asi que aca no corresponde la moneda de la organizacion.
 */
const formatPlanPrice = (value: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value)

type SelectedPlanInfo = { tier: string; name: string; price: number; trialDays: number } | null

type PlanOption = {
  tier: string
  /** Lo que va en la URL. Cae al tier si el plan todavia no tiene slug propio. */
  slug: string
  name: string
  price: number
  priceNote: string
  trialDays: number
}

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
  const { branding } = usePlatformBranding()

  let isDark = false
  try {
    const themeCtx = useTheme()
    isDark = themeCtx.isDark
  } catch {
    isDark = false
  }

  const rawRedirect = searchParams.get('redirect') || ''
  const loginHref = rawRedirect ? `/login?redirect=${encodeURIComponent(rawRedirect)}` : '/login'
  const planParam = searchParams.get('plan')?.toLowerCase().trim() ?? ''

  // El nombre comercial se lee de la base y no se deduce del tier: son cosas
  // distintas (el tier `free` puede ser un plan pago llamado "Lite"), y mostrar
  // el codigo interno hacia parecer que se habia elegido otro plan.
  const [planInfo, setPlanInfo] = useState<SelectedPlanInfo>(null)
  const [availablePlans, setAvailablePlans] = useState<PlanOption[] | null>(null)

  // Se traen todos los planes vigentes de una vez: hacen falta para resolver el
  // que llega por la URL y, si no llega ninguno, para poder ofrecerlos.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void supabase
      .from('subscription_plans')
      .select('tier, public_slug, name, price, price_note, trial_days')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setAvailablePlans(
          (data ?? []).map((row) => ({
            tier: String(row.tier),
            slug: String(row.public_slug || row.tier),
            name: String(row.name),
            price: Number(row.price) || 0,
            priceNote: row.price_note ? String(row.price_note) : '',
            trialDays: Number(row.trial_days) || 0,
          }))
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  // El plan pedido se resuelve contra esa lista. Se busca por slug publico y
  // tambien por tier, para que los enlaces viejos sigan funcionando.
  useEffect(() => {
    if (availablePlans === null) return

    const encontrado = planParam
      ? availablePlans.find((plan) => plan.slug === planParam) ??
        availablePlans.find((plan) => plan.tier === planParam)
      : undefined

    setPlanInfo(
      encontrado
        ? { tier: encontrado.tier, name: encontrado.name, price: encontrado.price, trialDays: encontrado.trialDays }
        : null
    )
  }, [planParam, availablePlans])

  // El tier que se envia sale SIEMPRE de la fila encontrada, nunca de la URL.
  const selectedPlan = planInfo?.tier ?? null

  const planState: 'cargando' | 'sin-plan' | 'no-disponible' | 'ok' =
    availablePlans === null
      ? 'cargando'
      : planInfo
      ? 'ok'
      : planParam
      ? 'no-disponible'
      : 'sin-plan'

  const elegirPlan = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set('plan', slug)
    else params.delete('plan')
    const query = params.toString()
    router.replace(query ? `/register?${query}` : '/register', { scroll: false })
  }

  // Always resolve slug: prefer what the user typed, fall back to slugified company name.
  const previewSlug = slugifyTenantName(formData.companySlug || formData.companyName)

  // Se verifica mientras se escribe con el hook debounce y feedback reactivo.
  const slugStatus = useSlugAvailability(previewSlug)
  const slugOcupado = slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido'
  const slugSugerencia =
    slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido' ? slugStatus.sugerencia : null

  const aplicarSugerencia = (sugerencia: string) => {
    setSlugTouched(true)
    setFormData((prev) => ({ ...prev, companySlug: sugerencia }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.companySlug
      return next
    })
  }

  const handleInputChange = (field: string, value: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    if (error) setError('')

    if (field === 'companyName' && !slugTouched) {
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

    if (!selectedPlan) {
      setError('Elegí un plan para continuar.')
      setLoading(false)
      return
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
        // Con confirmación pendiente el ingreso rechaza igual: la pantalla de
        // login lo dice en vez de invitar a intentarlo.
        const pendiente = result.data?.requiresEmailConfirmation ? '&confirmar=1' : ''
        router.push(`/login?registered=1&company=${registeredCompany}&redirect=${redirectTarget}${pendiente}`)
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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-700 dark:selection:text-cyan-200">
      {/* Luces de fondo adaptables al modo claro y oscuro */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_-10%,rgba(6,182,212,0.12),transparent_50%),radial-gradient(ellipse_60%_50%_at_90%_90%,rgba(59,130,246,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_10%_-10%,rgba(6,182,212,0.18),transparent_50%),radial-gradient(ellipse_60%_50%_at_90%_90%,rgba(59,130,246,0.15),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(14,165,233,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.05)_1px,transparent_1px)] bg-[size:48px_48px] opacity-50" />

      <SaaSPublicNav />

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* ── COLUMNA IZQUIERDA: Minimalista, limpia y enfocada (Desktop) ── */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -16 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="hidden flex-col space-y-6 lg:col-span-5 lg:flex lg:sticky lg:top-24"
            >
              {/* Marca */}
              <div className="flex items-center gap-3">
                {branding.logoUrl ? (
                  <div className="relative flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2.5 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoUrl}
                      alt={branding.platformName}
                      className="h-8 w-auto max-w-[150px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-sm border border-cyan-500/30">
                    <Cpu className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{branding.platformName}</h3>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">{branding.platformTagline || 'Gestión para Negocios'}</p>
                </div>
              </div>

              {/* Título y Subtítulo Limpio */}
              <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white xl:text-3xl leading-snug">
                  Llevá tu empresa al{' '}
                  <span className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 dark:from-cyan-400 dark:via-sky-300 dark:to-blue-500 bg-clip-text text-transparent">
                    siguiente nivel
                  </span>
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ventas, control de stock, servicio técnico y tienda online en una sola plataforma.
                </p>
              </div>

              {/* Lista limpia de beneficios clave (sin tarjetas pesadas) */}
              <ul className="space-y-3 pt-1">
                <li className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Punto de venta y control de stock en tiempo real</span>
                </li>
                <li className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Órdenes de taller y seguimiento para tus clientes</span>
                </li>
                <li className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Tienda online propia sincronizada automáticamente</span>
                </li>
                <li className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span>Sin tarjeta de crédito requerida para comenzar</span>
                </li>
              </ul>

              {/* Nota de confianza discreta */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 p-3.5 shadow-xs">
                <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Configuración en 2 minutos y soporte directo incluido</span>
                </p>
              </div>
            </motion.div>

            {/* ── COLUMNA DERECHA: Tarjeta de Registro Limpia & Adaptable ── */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full lg:col-span-7"
            >
              <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 shadow-xl dark:shadow-2xl rounded-3xl backdrop-blur-xl">
                <CardHeader className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                      Crear mi empresa
                    </CardTitle>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-300">
                      <Sparkles className="h-3 w-3" />
                      <span>Registro</span>
                    </div>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Completá tus datos y tu espacio estará listo al instante.
                  </CardDescription>

                  {/* Bloque de Plan Seleccionado */}
                  {planInfo && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-50/70 dark:bg-gradient-to-r dark:from-cyan-950/40 dark:via-cyan-900/20 dark:to-slate-900/60 p-3 text-cyan-950 dark:text-cyan-300 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-none text-slate-900 dark:text-white truncate">
                            Plan seleccionado: <strong>{planInfo.name}</strong>
                          </p>
                          <p className="text-[11px] text-cyan-700 dark:text-cyan-300/80 mt-1 flex flex-wrap items-center gap-1.5 leading-none">
                            {planInfo.price > 0 && (
                              <span className="font-semibold text-cyan-800 dark:text-cyan-300">{formatPlanPrice(planInfo.price)}/mes</span>
                            )}
                            {planInfo.trialDays > 0 && (
                              <>
                                <span className="opacity-50">·</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{planInfo.trialDays} días de regalo</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => elegirPlan('')}
                        className="shrink-0 rounded-xl border border-cyan-500/40 bg-white/80 dark:bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:bg-cyan-100 dark:hover:bg-cyan-500/25 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-5 p-5 sm:p-6">
                  {/* Selector si no hay plan resuelto */}
                  {planState !== 'ok' && planState !== 'cargando' && (
                    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4">
                      {planState === 'no-disponible' && (
                        <div
                          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-700 dark:text-amber-300"
                          role="alert"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>Ese plan ya no está disponible. Elegí uno de estos:</span>
                        </div>
                      )}

                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {planState === 'no-disponible' ? 'Planes vigentes' : 'Elegí tu plan para continuar'}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Sin tarjeta: empezás con los días de regalo y pagás recién cuando terminan.
                        </p>
                      </div>

                      {availablePlans && availablePlans.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {availablePlans.map((plan) => (
                            <button
                              key={plan.tier}
                              type="button"
                              onClick={() => elegirPlan(plan.slug)}
                              className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3.5 text-left transition-all hover:border-cyan-500/60 hover:shadow-sm active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="block text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                                    {plan.name}
                                  </span>
                                  {plan.trialDays > 0 && (
                                    <span className="inline-block mt-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                      {plan.trialDays} días de regalo
                                    </span>
                                  )}
                                </div>
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                                  <ArrowRight className="h-3 w-3" />
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="block text-sm font-black text-cyan-700 dark:text-cyan-300">
                                  {formatPlanPrice(plan.price)}
                                </span>
                                <span className="block text-[10px] text-slate-500">{plan.priceNote || 'por mes'}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 text-xs text-slate-500">
                          No hay planes disponibles en este momento. Escribinos y te ayudamos a activar tu cuenta.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Formulario Principal */}
                  {planState === 'ok' && (
                    <form onSubmit={handleRegister} className="space-y-4" noValidate>
                      {/* Fila 1: Nombre y Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Nombre completo
                          </Label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                              id="fullName"
                              type="text"
                              placeholder="Ej. Juan Pérez"
                              value={formData.fullName}
                              onChange={(e) => handleInputChange('fullName', e.target.value)}
                              required
                              autoFocus
                              disabled={loading}
                              aria-invalid={!!fieldErrors.fullName}
                              aria-describedby={fieldErrors.fullName ? 'err-fullName' : undefined}
                              className={`h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.fullName ? 'border-red-500/70' : ''
                              }`}
                            />
                          </div>
                          {fieldErrors.fullName && (
                            <p id="err-fullName" className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.fullName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Correo electrónico
                          </Label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
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
                              className={`h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.email ? 'border-red-500/70' : ''
                              }`}
                            />
                          </div>
                          {fieldErrors.email && (
                            <p id="err-email" className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fila 2: Empresa y Subdominio */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="companyName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Nombre de la empresa
                          </Label>
                          <div className="relative">
                            <Store className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                              id="companyName"
                              type="text"
                              placeholder="Ej. Mi Tienda Tech"
                              value={formData.companyName}
                              onChange={(e) => handleInputChange('companyName', e.target.value)}
                              required
                              disabled={loading}
                              aria-invalid={!!fieldErrors.companyName}
                              aria-describedby={fieldErrors.companyName ? 'err-companyName' : undefined}
                              className={`h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.companyName ? 'border-red-500/70' : ''
                              }`}
                            />
                          </div>
                          {fieldErrors.companyName && (
                            <p id="err-companyName" className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.companyName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="companySlug" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Dirección web
                            </Label>
                            <span className="text-[10px] text-slate-400">
                              {slugTouched ? 'Manual' : 'Automático'}
                            </span>
                          </div>
                          <div className="relative">
                            <Globe className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                              id="companySlug"
                              type="text"
                              placeholder={previewSlug || 'mi-empresa'}
                              value={formData.companySlug}
                              onChange={(e) => handleInputChange('companySlug', e.target.value)}
                              disabled={loading}
                              aria-invalid={!!fieldErrors.companySlug}
                              aria-describedby="hint-slug"
                              className={`h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.companySlug ? 'border-red-500/70' : ''
                              }`}
                            />
                          </div>

                          {fieldErrors.companySlug ? (
                            <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.companySlug}
                            </p>
                          ) : previewSlug ? (
                            <div id="hint-slug" className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/60 p-2.5 space-y-1 text-xs">
                              <p className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400">
                                <span>URL:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    slugOcupado ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-700 dark:text-cyan-400'
                                  }`}
                                >
                                  /{previewSlug}/inicio
                                </span>
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
                                {slugStatus.estado === 'consultando' && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                                    Verificando...
                                  </span>
                                )}
                                {slugStatus.estado === 'libre' && (
                                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                    Disponible
                                  </span>
                                )}
                                {(slugStatus.estado === 'ocupado' || slugStatus.estado === 'invalido') && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      {slugStatus.mensaje}
                                    </span>
                                    {slugSugerencia && (
                                      <button
                                        type="button"
                                        onClick={() => aplicarSugerencia(slugSugerencia)}
                                        className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 active:scale-95"
                                      >
                                        Usar {slugSugerencia}
                                      </button>
                                    )}
                                  </div>
                                )}
                                {slugStatus.estado === 'error' && (
                                  <span className="text-slate-400">{slugStatus.mensaje}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p id="hint-slug" className="text-xs text-slate-400">
                              Se genera automáticamente desde el nombre de la empresa.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fila 3: Contraseña y Confirmación */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Contraseña
                          </Label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
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
                              className={`h-11 pl-10 pr-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.password ? 'border-red-500/70' : ''
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-cyan-400"
                              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {fieldErrors.password && (
                            <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.password}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Confirmar contraseña
                          </Label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
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
                              className={`h-11 pl-10 pr-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 ${
                                fieldErrors.confirmPassword ? 'border-red-500/70' : ''
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-cyan-400"
                              aria-label={
                                showConfirmPassword
                                  ? 'Ocultar confirmación de contraseña'
                                  : 'Mostrar confirmación de contraseña'
                              }
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {fieldErrors.confirmPassword && (
                            <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                              {fieldErrors.confirmPassword}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Checklist compacto de fortaleza de contraseña */}
                      {pwd && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/50 p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Requisitos de contraseña:</span>
                            <span
                              className={`font-bold ${
                                allChecksOk
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {allChecksOk ? 'Completa' : 'Faltan requisitos'}
                            </span>
                          </div>

                          <div className="flex gap-1">
                            {pwdChecks.map((item, i) => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                                  item.ok ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>

                          <ul className="grid grid-cols-2 gap-1 text-[11px] pt-0.5">
                            {pwdChecks.map((item) => (
                              <li
                                key={item.label}
                                className={`flex items-center gap-1.5 ${
                                  item.ok
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                <CheckCircle2 className={`h-3 w-3 shrink-0 ${item.ok ? 'opacity-100' : 'opacity-40'}`} />
                                <span>{item.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Error global animado */}
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300"
                            role="alert"
                            aria-live="assertive"
                          >
                            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                            <span>{error}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Cloudflare Turnstile adaptativo */}
                      <div className="flex justify-center pt-1">
                        <TurnstileChallenge
                          action="company_register"
                          onTokenChange={setCaptchaToken}
                          resetKey={captchaResetKey}
                          theme={isDark ? 'dark' : 'light'}
                          disabled={loading}
                        />
                      </div>

                      {/* Botón Principal */}
                      <div className="space-y-2.5 pt-1">
                        <Button
                          type="submit"
                          className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 font-bold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-500 hover:to-blue-500 active:scale-[0.99] transition-all disabled:opacity-60 text-sm"
                          disabled={loading || !captchaToken || !selectedPlan || (pwd.length > 0 && !allChecksOk)}
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

                        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                          <span>
                            No pedimos tarjeta para crear la cuenta
                            {planInfo && planInfo.trialDays > 0 && (
                              <>: tenés {planInfo.trialDays} días de regalo</>
                            )}
                            .
                          </span>
                        </p>
                      </div>
                    </form>
                  )}

                  {/* Acceso a Inicio de Sesión */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      ¿Ya tienes cuenta registrada?{' '}
                      <Link
                        href={loginHref}
                        className="font-bold text-cyan-600 dark:text-cyan-400 transition-colors hover:underline"
                      >
                        Iniciar sesión
                      </Link>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
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
