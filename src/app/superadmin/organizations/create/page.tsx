'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getSubscriptionPlans, type SubscriptionPlan } from '@/services/subscription-plans'
import { RobotGuide } from '@/components/common/RobotGuide'

// ---------------------------------------------------------------------------
// Constants & Styling
// ---------------------------------------------------------------------------

const PLAN_STYLES: Record<string, { card: string; badge: string; text: string; ring: string }> = {
  FREE: {
    card: 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900',
    badge: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-slate-400',
  },
  BASIC: {
    card: 'border-blue-200/90 bg-gradient-to-b from-blue-50/40 to-white dark:border-blue-900/50 dark:from-blue-950/20 dark:to-slate-900',
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-500',
  },
  PRO: {
    card: 'border-violet-200/90 bg-gradient-to-b from-violet-50/50 to-white dark:border-violet-900/50 dark:from-violet-950/30 dark:to-slate-900',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300',
    text: 'text-violet-600 dark:text-violet-400',
    ring: 'ring-violet-500',
  },
  ENTERPRISE: {
    card: 'border-amber-200/90 bg-gradient-to-b from-amber-50/40 to-white dark:border-amber-900/50 dark:from-amber-950/20 dark:to-slate-900',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500',
  },
}

function normalizePlanCode(tier: string) {
  return tier.toUpperCase()
}

function formatPlanPrice(plan: SubscriptionPlan) {
  if (plan.price <= 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(plan.price)
}

function formatPlanFeatures(plan: SubscriptionPlan) {
  if (plan.highlights?.length) return plan.highlights.slice(0, 4)
  const limits = plan.limits || {}
  return [
    limits.users != null ? `${String(limits.users)} colaboradores` : 'Colaboradores ilimitados',
    limits.branches != null ? `${String(limits.branches)} sucursales` : 'Sucursales ilimitadas',
    limits.products != null ? `${String(limits.products)} productos` : 'Catálogo ilimitado',
  ]
}

const TIMEZONES = [
  { value: 'America/Asuncion', label: '🇵🇾 Paraguay (UTC-4)' },
  { value: 'America/Buenos_Aires', label: '🇦🇷 Argentina (UTC-3)' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 Brasil (UTC-3)' },
  { value: 'America/Montevideo', label: '🇺🇾 Uruguay (UTC-3)' },
  { value: 'America/Santiago', label: '🇨🇱 Chile (UTC-4/3)' },
  { value: 'America/Bogota', label: '🇨🇴 Colombia (UTC-5)' },
  { value: 'America/Lima', label: '🇵🇪 Perú (UTC-5)' },
  { value: 'America/Mexico_City', label: '🇲🇽 México (UTC-6)' },
  { value: 'America/New_York', label: '🇺🇸 New York (UTC-5/4)' },
]

const CURRENCIES = [
  { value: 'PYG', label: 'Gs. — Guaraní Paraguayo (PYG)' },
  { value: 'USD', label: '$ — Dólar Estadounidense (USD)' },
  { value: 'ARS', label: '$ — Peso Argentino (ARS)' },
  { value: 'BRL', label: 'R$ — Real Brasileño (BRL)' },
]

// ---------------------------------------------------------------------------
// Slug Availability Hook
// ---------------------------------------------------------------------------

function useSlugCheck(slug: string) {
  const [result, setResult] = useState<{ slug: string; state: 'available' | 'taken' } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canCheck = slug.length >= 2 && /^[a-z0-9-]+$/.test(slug)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!canCheck) return

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/organizations?slug=${encodeURIComponent(slug)}`)
        const data = (await res.json()) as { available?: boolean }
        setResult({ slug, state: data.available ? 'available' : 'taken' })
      } catch {
        setResult(null)
      }
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [canCheck, slug])

  if (!canCheck) return 'idle'
  return result?.slug === slug ? result.state : 'checking'
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SuperAdminCreateOrganizationPage() {
  const router = useRouter()

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [plan, setPlan] = useState('FREE')
  const [currency, setCurrency] = useState('PYG')
  const [timezone, setTimezone] = useState('America/Asuncion')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [planOptions, setPlanOptions] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{
    orgName: string
    orgSlug: string
    ownerCreated: boolean
    ownerError: string | null
  } | null>(null)

  const slugStatus = useSlugCheck(slug)
  const selectedPlanOption = planOptions.find((item) => normalizePlanCode(item.tier) === plan)
  const selectedTrialDays =
    typeof selectedPlanOption?.trial_days === 'number' ? selectedPlanOption.trial_days : 14

  useEffect(() => {
    let cancelled = false

    async function loadPlanOptions() {
      setPlansLoading(true)
      try {
        const plans = await getSubscriptionPlans()
        if (cancelled) return
        const activePlans = plans.filter((item) => item.is_active !== false)
        setPlanOptions(activePlans)
        if (activePlans.length > 0) {
          setPlan((currentPlan) =>
            activePlans.some((item) => normalizePlanCode(item.tier) === currentPlan)
              ? currentPlan
              : normalizePlanCode(activePlans[0].tier)
          )
        }
      } finally {
        if (!cancelled) setPlansLoading(false)
      }
    }

    void loadPlanOptions()

    return () => {
      cancelled = true
    }
  }, [])

  // Auto-generate slug from name
  useEffect(() => {
    if (slugEdited) return
    const generated = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    setSlug(generated)
  }, [name, slugEdited])

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre de la organización es obligatorio.'
    if (!slug.trim()) errs.slug = 'El slug de subdominio es obligatorio.'
    if (slug && !/^[a-z0-9-]+$/.test(slug))
      errs.slug = 'Solo letras minúsculas, números y guiones.'
    if (slugStatus === 'taken') errs.slug = `El subdominio "${slug}" ya está en uso.`
    if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))
      errs.ownerEmail = 'Por favor ingresa un correo electrónico válido.'
    if (!planOptions.some((item) => normalizePlanCode(item.tier) === plan))
      errs.plan = 'Selecciona un plan activo válido.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('Por favor revisa los campos requeridos.')
      return
    }
    setErrors({})
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          plan,
          currency,
          timezone,
          owner_email: ownerEmail.trim() || undefined,
          owner_name: ownerName.trim() || undefined,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        organization?: { name: string; slug: string }
        ownerCreated?: boolean
        ownerError?: string | null
      }

      if (!res.ok || !data.success) {
        setErrors({ submit: data.error || 'Error al crear la organización.' })
        toast.error(data.error || 'Error al crear la organización.')
        return
      }

      toast.success('¡Organización creada exitosamente!')
      setResult({
        orgName: data.organization?.name ?? name,
        orgSlug: data.organization?.slug ?? slug,
        ownerCreated: data.ownerCreated ?? false,
        ownerError: data.ownerError ?? null,
      })
    } catch {
      setErrors({ submit: 'Error de conexión. Verifica tu red e intenta de nuevo.' })
      toast.error('Error de red al crear la organización.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Robot speech assistant reactive text
  const robotAdvice = useMemo(() => {
    if (slugStatus === 'taken') {
      return `El subdominio "/${slug}" ya está ocupado por otra empresa. Te sugiero agregar un sufijo como "-py" o "-tienda".`
    }
    if (slugStatus === 'available') {
      return `¡Excelente! El subdominio "/${slug}" está 100% disponible. La tienda pública responderá de inmediato.`
    }
    if (ownerEmail) {
      return `Registrando como owner a ${ownerEmail}. Se creará su cuenta de administrador automáticamente.`
    }
    if (name) {
      return `Configurando ${name} en el plan ${plan} (${formatPlanPrice(selectedPlanOption || { price: 0 } as any)}).`
    }
    return 'Ingresa el nombre de la empresa y seleccionemos su plan de servicio para comenzar el aprovisionamiento.'
  }, [name, ownerEmail, plan, selectedPlanOption, slug, slugStatus])

  // ---------------------------------------------------------------------------
  // Success Screen
  // ---------------------------------------------------------------------------

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pt-6">
        <Card className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 via-white to-white shadow-xl dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 text-center p-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg ring-4 ring-emerald-100 dark:ring-emerald-900/40">
            <Rocket className="h-10 w-10 animate-bounce" />
          </div>

          <h2 className="mt-5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            ¡Organización Aprovisionada!
          </h2>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            La empresa <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{result.orgName}</strong> ya se encuentra activa y lista para operar en la plataforma.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
            <Globe className="h-4 w-4 text-emerald-600" />
            <span>/{result.orgSlug}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${result.orgSlug}/inicio`)
                toast.success('URL pública copiada')
              }}
              className="ml-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Copiar URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {ownerEmail && (
            <div
              className={cn(
                'mt-5 rounded-2xl border p-4 text-xs font-medium text-left',
                result.ownerCreated
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300'
              )}
            >
              <div className="flex items-center gap-2 font-bold">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Gestión de Propietario (Owner)</span>
              </div>
              <p className="mt-1">
                {result.ownerCreated
                  ? `Se despachó la invitación y credenciales de acceso inicial a ${ownerEmail}.`
                  : `Organización creada, pero hubo un aviso al invitar al owner: ${result.ownerError}`}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              className="w-full sm:w-auto gap-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 shadow-md cursor-pointer"
            >
              <Link href={`/superadmin/organizations?q=${encodeURIComponent(result.orgSlug)}`}>
                <Building2 className="h-4 w-4" />
                Ver en Directorio
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto gap-2 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <a href={`/${result.orgSlug}/inicio`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 text-cyan-600" />
                Abrir Tienda Pública
              </a>
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:w-auto rounded-xl text-xs font-bold cursor-pointer"
              onClick={() => {
                setResult(null)
                setName('')
                setSlug('')
                setSlugEdited(false)
                setOwnerEmail('')
                setOwnerName('')
                setPlan('FREE')
              }}
            >
              Crear Otra
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main Form Screen
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-violet-500" />
            Superadmin · Alta Asistida de Tenants
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Nueva Organización
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Aprovisiona una nueva empresa, configura su plan inicial y asigna su propietario.
          </p>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer w-fit"
        >
          <Link href="/superadmin/organizations">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Organizaciones
          </Link>
        </Button>
      </header>

      {/* 🤖 Robot Mascot Supervisor Guidance */}
      <div className="rounded-3xl border border-violet-200/80 bg-gradient-to-r from-violet-50/70 via-white to-purple-50/70 p-4 sm:p-5 shadow-xs dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-purple-950/30">
        <RobotGuide
          variant="black-gold"
          size="md"
          speechTitle="ByteBot · Asistente de Aprovisionamiento de Tenants"
          speechText={robotAdvice}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">

          {/* Left Column: Form Cards */}
          <div className="space-y-6">

            {/* Card 1: Identidad & Subdominio */}
            <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400 font-black text-sm">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                      Identidad & Subdominio
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Nombre comercial y slug de acceso público a la tienda.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre de la Organización <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="org-name"
                    placeholder="Ej: 4G Celulares Paraguay"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn('rounded-xl h-10 text-sm', errors.name && 'border-red-300')}
                  />
                  {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="org-slug" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Subdominio / Slug Público <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-[10px] text-slate-400">Solo minúsculas, números y guiones</span>
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-slate-400">
                      /
                    </span>
                    <Input
                      id="org-slug"
                      className={cn(
                        'pl-7 pr-10 rounded-xl h-10 text-sm font-mono font-bold',
                        errors.slug
                          ? 'border-red-300'
                          : slugStatus === 'available'
                            ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                            : slugStatus === 'taken'
                              ? 'border-red-400 ring-1 ring-red-400/30'
                              : ''
                      )}
                      placeholder="4g-celulares"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value)
                        setSlugEdited(true)
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {slugStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {slugStatus === 'taken' && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  {slugStatus === 'available' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Subdominio disponible para uso ✓
                    </p>
                  )}
                  {slugStatus === 'taken' && (
                    <p className="text-xs text-red-500 font-medium">Este subdominio ya está ocupado.</p>
                  )}
                  {errors.slug && <p className="text-xs text-red-500 font-medium">{errors.slug}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Selección de Plan */}
            <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 font-black text-sm">
                    2
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                      Plan de Suscripción Inicial
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Selecciona la categoría de límites y módulos para este tenant.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {plansLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando catálogo de planes...
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {planOptions.map((p) => {
                      const code = normalizePlanCode(p.tier)
                      const isSelected = plan === code
                      const style = PLAN_STYLES[code] ?? PLAN_STYLES.FREE
                      const features = formatPlanFeatures(p)

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlan(code)}
                          className={cn(
                            'relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer',
                            style.card,
                            isSelected
                              ? cn('ring-2 shadow-md', style.ring)
                              : 'opacity-80 hover:opacity-100 hover:shadow-xs'
                          )}
                        >
                          {p.is_popular && (
                            <span className="absolute -top-2.5 right-3 rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-black text-white shadow-xs">
                              POPULAR
                            </span>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-sm text-slate-900 dark:text-slate-50">
                                {p.name}
                              </span>
                              <Badge variant="outline" className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', style.badge)}>
                                {code}
                              </Badge>
                            </div>
                            <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {formatPlanPrice(p)}
                              {p.price > 0 && <span className="text-[10px] font-normal text-slate-400"> / mes</span>}
                            </p>
                          </div>

                          <ul className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {features.map((feat, idx) => (
                              <li key={idx} className="flex items-center gap-1.5 truncate">
                                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="truncate">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Configuración Regional & Moneda */}
            <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-black text-sm">
                    3
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                      Parámetros Regionales & Moneda
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ajustes predeterminados para reportes, ventas e inventario.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-currency" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Moneda Operativa Principal
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="org-currency" className="rounded-xl h-10 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-xs font-bold">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org-timezone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Zona Horaria del Negocio
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="org-timezone" className="rounded-xl h-10 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value} className="text-xs font-bold">
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Propietario / Owner (Opcional) */}
            <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 font-black text-sm">
                      4
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                        Propietario / Owner
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Opcional — despacho automático de invitación con rol de administrador.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold text-slate-400">
                    OPCIONAL
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="owner-email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Correo Electrónico
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="owner-email"
                      type="email"
                      placeholder="propietario@empresa.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className={cn('pl-9 rounded-xl h-10 text-xs font-medium', errors.ownerEmail && 'border-red-300')}
                    />
                  </div>
                  {errors.ownerEmail && <p className="text-xs text-red-500 font-medium">{errors.ownerEmail}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="owner-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre del Propietario
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="owner-name"
                      placeholder="Ej: Juan Pérez"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="pl-9 rounded-xl h-10 text-xs font-medium"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Message */}
            {errors.submit && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-700 dark:text-red-300">{errors.submit}</p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  slugStatus === 'taken' ||
                  slugStatus === 'checking' ||
                  plansLoading ||
                  planOptions.length === 0
                }
                className="gap-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer h-11 px-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aprovisionando Organización...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Crear Organización
                  </>
                )}
              </Button>
              <Button asChild variant="outline" type="button" className="rounded-xl text-xs font-bold h-11 px-5">
                <Link href="/superadmin/organizations">Cancelar</Link>
              </Button>
            </div>

          </div>

          {/* Right Column: Live Tenant Preview Sidebar */}
          <div className="space-y-6">

            {/* Live Preview Card */}
            <Card className="sticky top-6 overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/80 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Vista Previa del Tenant
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    EN VIVO
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-5">

                {/* Tenant Mini Header */}
                <div className="flex items-start gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white text-lg font-black shadow-md ring-2 ring-white dark:ring-slate-800">
                    {name ? name.slice(0, 2).toUpperCase() : 'OR'}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate font-black text-slate-900 dark:text-slate-50 text-base">
                      {name || 'Nombre de la Empresa'}
                    </h3>
                    <p className="font-mono text-xs text-slate-400 truncate">
                      /{slug || 'subdominio-tenant'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300">
                        PLAN {plan}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                        {currency}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Provisioning Checklist */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-2.5 text-xs">
                  <p className="font-extrabold uppercase tracking-wider text-[10px] text-slate-400">
                    Aprovisionamiento Automático
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Esquema de base de datos aislado</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Sucursal "Casa Central" preconfigurada</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Período de prueba ({selectedTrialDays} días) asignado</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Catálogo & POS listos para operar</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      {ownerEmail ? (
                        <>
                          <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">Invitación a {ownerEmail}</span>
                        </>
                      ) : (
                        <>
                          <span className="h-3.5 w-3.5 rounded-full border border-dashed border-slate-400 shrink-0" />
                          <span className="text-slate-400">Sin owner asignado</span>
                        </>
                      )}
                    </li>
                  </ul>
                </div>

                {/* Trial notice */}
                <div className="flex items-start gap-2.5 rounded-2xl bg-violet-50/50 p-3.5 text-xs text-violet-900 dark:bg-violet-950/20 dark:text-violet-300 border border-violet-200/60 dark:border-violet-900/40">
                  <Clock className="h-4 w-4 shrink-0 text-violet-600 mt-0.5" />
                  <p className="leading-relaxed">
                    La organización se creará en estado <strong>Trialing</strong> con acceso completo a las características del plan seleccionado.
                  </p>
                </div>

              </CardContent>
            </Card>

          </div>

        </div>
      </form>
    </div>
  )
}
