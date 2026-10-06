'use client'

import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { moduleDisplayName } from '@/lib/saas/plan-feature-catalog'
import { AppImage as Image } from '@/components/ui/app-image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarClock,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Coins,
  CreditCard,
  Cpu, ExternalLink,
  Globe,
  Hammer,
  Layers,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package, Phone,
  RotateCcw,
  Scissors,
  ShieldAlert,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store, Truck, Upload, Users,
  Utensils,
  Wrench
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES, formatCurrency } from '@/lib/currency'
import { getAdminSettingsText } from '@/lib/i18n/admin-settings'
import { clearOnboardingStatusCache } from '@/lib/onboarding/status-cache'
import { BRAND_COLORS } from '@/lib/website/brand-colors'
import {
  BUSINESS_VERTICALS,
  OPERATING_MODELS,
  ORGANIZATION_MODULES,
  getSuggestedModules,
  type BusinessVertical,
  type OperatingModel,
  type OrganizationModule,
} from '@/lib/organization/business-profile'
import { cn } from '@/lib/utils'
import {
  isServiceFocused,
  socialHandle,
  splitSuggestedModules,
  subscriptionSummary,
} from '@/lib/onboarding/onboarding-view'
import { checkoutChoicesError, type CheckoutChoices } from '@/lib/onboarding/checkout-choices'
import { siteUrl } from '@/lib/site-url'
import { ShareStoreCard } from './ShareStoreCard'

type StepProgress = {
  hasCompanyInfo: boolean
  hasProducts: boolean
  hasPublicStore: boolean
  hasTeam: boolean
  /** Horario o profesionales cargados en la agenda. */
  hasAgenda?: boolean
}

type OnboardingStep = {
  title: string
  description: string
  href: string
  icon: ElementType
  doneKey: keyof StepProgress
}

type CompanyInfoForm = {
  displayName: string
  currency: string
  timezone: string
  language: string
  phone: string
  email: string
  address: string
  city: string
  weekdays: string
  saturday: string
  logoUrl: string
  ruc: string
  whatsapp: string
  businessType: string
  /** El onboarding ya lo escribia: le fijaba 'blue' en cada guardado. */
  brandColor: string
  /** La tienda arranca sin publicar y nada lo decia. */
  storefrontPublic: boolean
  businessVertical: string
  operatingModel: string
  instagram: string
  facebook: string
  tiktok: string
  /** Cómo cobra y entrega la tienda. */
  checkout: CheckoutChoices
}

/**
 * Los pasos del asistente. La primera vez se recorren en orden con
 * «Siguiente»; después quedan como pestañas para editar cualquiera.
 */
const FORM_STEPS = [
  { id: 'business', label: 'Rubro', icon: Store },
  { id: 'contact', label: 'Datos y contacto', icon: Building2 },
  { id: 'payments', label: 'Cobro y entrega', icon: CreditCard },
  { id: 'public', label: 'Tu tienda', icon: Globe },
  { id: 'social', label: 'Redes', icon: MessageCircle },
] as const
type FormStepId = (typeof FORM_STEPS)[number]['id']

type OnboardingClientProps = {
  organization: {
    id: string
    name: string
    slug: string
    plan: string
  }
  subscription: {
    plan: string
    status: string
    trialEndsAt: string | null
    currentPeriodEndsAt?: string | null
  } | null
  /** Nombre comercial del plan (Pro, Pro Max): «BASIC» no le dice nada al cliente. */
  planName?: string | null
  /** Módulos que el plan incluye o está probando; null si no se pudo leer. */
  entitledModules?: string[] | null
  /** La empresa tiene la agenda (módulo de servicios). */
  servicesEnabled?: boolean
  /** Hay productos o ventas: cambiar la moneda afecta importes existentes. */
  hasBusinessData?: boolean
  completedAt?: string | null
  stepProgress: StepProgress
  initialCompanyInfo: CompanyInfoForm
  serverIsAdmin?: boolean
}

type FieldErrors = Partial<Record<'displayName' | 'phone' | 'email' | 'address' | 'city' | 'logoUrl', string>>

const COUNTRY_CODES = [
  { name: 'Paraguay', code: '+595' },
  { name: 'Argentina', code: '+54' },
  { name: 'Brasil', code: '+55' },
  { name: 'Uruguay', code: '+598' },
  { name: 'Bolivia', code: '+591' },
  { name: 'Chile', code: '+56' },
  { name: 'Colombia', code: '+57' },
  { name: 'Perú', code: '+51' },
  { name: 'Venezuela', code: '+58' },
  { name: 'México', code: '+52' },
  { name: 'Estados Unidos', code: '+1' },
  { name: 'España', code: '+34' },
]

const VERTICAL_METADATA: Record<
  BusinessVertical,
  { label: string; description: string; icon: ElementType }
> = {
  general: {
    label: 'Comercio general',
    description: 'Tiendas multirubro, bazares o venta minorista variada',
    icon: Store,
  },
  clothing: {
    label: 'Ropa y moda',
    description: 'Indumentaria, calzados, indumentaria deportiva y accesorios',
    icon: Shirt,
  },
  cosmetics: {
    label: 'Cosmética y belleza',
    description: 'Perfumerías, cuidado personal, estética y cosméticos',
    icon: Sparkles,
  },
  electronics: {
    label: 'Electrónica y tecnología',
    description: 'Celulares, informática, electrodomésticos y servicio técnico',
    icon: Cpu,
  },
  food: {
    label: 'Alimentos y gastronomía',
    description: 'Almacenes, minimarkets, productos gourmet y alimentos',
    icon: Utensils,
  },
  barbershop: {
    label: 'Barbería y peluquería',
    description: 'Cortes, barba, color y tratamientos con turnos online',
    icon: Scissors,
  },
  hardware: {
    label: 'Ferretería y construcción',
    description: 'Herramientas, repuestos, corralones y pinturerías',
    icon: Hammer,
  },
  other: {
    label: 'Otro rubro',
    description: 'Actividades comerciales especializadas o no listadas',
    icon: Package,
  },
}

const MODEL_METADATA: Record<
  OperatingModel,
  { label: string; description: string; icon: ElementType }
> = {
  retail: {
    label: 'Venta minorista',
    description: 'Venta directa al cliente final en salón comercial o catálogo web',
    icon: ShoppingBag,
  },
  wholesale: {
    label: 'Venta mayorista',
    description: 'Distribución, venta por volumen y listas de precios preferenciales',
    icon: Boxes,
  },
  service: {
    label: 'Prestación de servicios',
    description: 'Servicios profesionales, presupuestos, turnos y mano de obra',
    icon: Briefcase,
  },
  repair: {
    label: 'Taller y reparaciones',
    description: 'Recepción de equipos, órdenes técnicas, diagnóstico y repuestos',
    icon: Wrench,
  },
  mixed: {
    label: 'Negocio mixto',
    description: 'Combina venta de artículos comerciales con servicios técnicos',
    icon: Layers,
  },
}

// Los mismos nombres que el cliente ve en su plan (catálogo de planes).
const MODULE_LABELS = Object.fromEntries(
  ORGANIZATION_MODULES.map((module) => [module, moduleDisplayName(module)]),
) as Record<OrganizationModule, string>

function buildSteps(slug: string, options: { serviceFocused: boolean; servicesEnabled: boolean }): OnboardingStep[] {
  return [
    {
      title: 'Datos del negocio',
      description: 'Identidad, contacto y operación',
      href: '/admin/onboarding#company-info',
      icon: Building2,
      doneKey: 'hasCompanyInfo',
    },
    // Una barbería no carga «inventario e imágenes»: carga sus servicios con precio.
    options.serviceFocused
      ? {
          title: 'Servicios y precios',
          description: 'Cortes, tratamientos y lo que vendés',
          href: '/dashboard/products',
          icon: Package,
          doneKey: 'hasProducts' as const,
        }
      : {
          title: 'Productos y catálogo',
          description: 'Inventario, precios e imágenes',
          href: '/dashboard/products',
          icon: Package,
          doneKey: 'hasProducts' as const,
        },
    ...(options.servicesEnabled
      ? [{
          title: 'Agenda y reservas',
          description: 'Horario, profesionales y turnos online',
          href: '/dashboard/agenda/configuracion',
          icon: CalendarClock,
          doneKey: 'hasAgenda' as const,
        }]
      : []),
    {
      title: 'Tienda pública',
      description: 'Publicada y visible para tus clientes',
      href: `/${slug}/inicio`,
      icon: Store,
      doneKey: 'hasPublicStore',
    },
    {
      title: 'Equipo de trabajo',
      description: 'Usuarios, roles y permisos',
      href: '/admin/users',
      icon: Users,
      doneKey: 'hasTeam',
    },
  ]
}

function parsePhone(full: string) {
  for (const country of COUNTRY_CODES) {
    if (full.startsWith(country.code)) {
      return { code: country.code, local: full.slice(country.code.length).trimStart() }
    }
  }
  return { code: '+595', local: full.replace(/^\+/, '') }
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} role="alert" className="mt-1 text-xs font-medium text-destructive">{message}</p>
}

import {
  clearOnboardingDraft,
  isDraftWorthRestoring,
  readOnboardingDraft,
  writeOnboardingDraft,
} from '@/lib/onboarding/draft'

export function OnboardingClient({
  organization,
  subscription,
  planName,
  entitledModules = null,
  servicesEnabled = false,
  hasBusinessData = true,
  completedAt,
  stepProgress,
  initialCompanyInfo,
  serverIsAdmin,
}: OnboardingClientProps) {
  const router = useRouter()
  const { isAdmin: clientIsAdmin } = useAuth()
  const isAdmin = serverIsAdmin ?? clientIsAdmin
  const isRevisit = Boolean(completedAt)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CompanyInfoForm>(initialCompanyInfo)
  const [activeTab, setActiveTab] = useState<string>('business')
  const wizard = !isRevisit
  const stepIndex = Math.max(0, FORM_STEPS.findIndex((step) => step.id === activeTab))
  const [furthestStep, setFurthestStep] = useState(0)
  const [error, setError] = useState('')
  const [confirmCurrencyChange, setConfirmCurrencyChange] = useState(false)
  const [confirmPublication, setConfirmPublication] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const draftChecked = useRef(false)
  const initialPhone = parsePhone(initialCompanyInfo.phone)
  const [countryCode, setCountryCode] = useState(initialPhone.code)
  const [localPhone, setLocalPhone] = useState(initialPhone.local)

  const publicUrl = `/${organization.slug}/inicio`
  const serviceFocused = isServiceFocused(form.businessVertical, form.operatingModel)
  const steps = buildSteps(organization.slug, { serviceFocused, servicesEnabled }).filter((step) => step.doneKey !== 'hasTeam' || isAdmin)
  const stepsCompleted = steps.filter((step) => stepProgress[step.doneKey]).length
  const subscriptionInfo = subscriptionSummary(subscription)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const progressValue = steps.length ? Math.round((stepsCompleted / steps.length) * 100) : 0
  void (steps.find((step) => !stepProgress[step.doneKey]));
  const currencyChanged = form.currency !== initialCompanyInfo.currency
  // Una empresa nueva, sin productos ni ventas, no tiene importes que se vean afectados.
  const currencyNeedsConfirmation = currencyChanged && hasBusinessData
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialCompanyInfo)
  const timeZoneOptions = Object.entries(getAdminSettingsText('es').regional.timeZones)

  const fieldErrors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {}
    if (form.displayName.trim().length < 2) next.displayName = 'Ingresá un nombre de al menos 2 caracteres.'
    if (form.phone.trim().length < 6) next.phone = 'Ingresá un teléfono válido.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Ingresá un correo válido.'
    if (form.address.trim().length < 4) next.address = 'Ingresá una dirección válida.'
    if (form.city.trim().length < 2) next.city = 'Ingresá una ciudad válida.'
    if (!isValidOptionalUrl(form.logoUrl)) next.logoUrl = 'Usá una URL que comience con http:// o https://.'
    return next
  }, [form])

  // Publicar deja la tienda visible para cualquiera: se confirma, igual que en
  // «Sitio Web», en vez de alcanzar con mover el interruptor.
  const publishingNow = form.storefrontPublic && !initialCompanyInfo.storefrontPublic

  const checkoutError = checkoutChoicesError(form.checkout)

  const canSubmit = isAdmin
    && Object.keys(fieldErrors).length === 0
    && !checkoutError
    && (!currencyNeedsConfirmation || confirmCurrencyChange)
    && (!publishingNow || confirmPublication)
    && (!isRevisit || hasChanges)

  // Suggested modules calculation based on chosen vertical & model
  const suggestedModules = useMemo(() => {
    const vertical = (BUSINESS_VERTICALS.includes(form.businessVertical as BusinessVertical)
      ? form.businessVertical
      : 'general') as BusinessVertical
    const model = (OPERATING_MODELS.includes(form.operatingModel as OperatingModel)
      ? form.operatingModel
      : 'retail') as OperatingModel
    return getSuggestedModules(vertical, model)
  }, [form.businessVertical, form.operatingModel])

  const suggestedSplit = useMemo(
    () => splitSuggestedModules(suggestedModules, entitledModules),
    [suggestedModules, entitledModules],
  )

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/admin/website/logo', { method: 'POST', body })
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        toast.error(payload.error || 'No se pudo subir el logo')
        return
      }
      updateField('logoUrl', payload.url)
      toast.success('Logo subido. Guardá para aplicarlo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const currencyPreview = useMemo(() => {
    return formatCurrency(1234567.89, {
      currency: form.currency,
      language: form.language,
    })
  }, [form.currency, form.language])

  // Se retoma lo que habia quedado a medio cargar en este equipo.
  useEffect(() => {
    if (draftChecked.current) return
    draftChecked.current = true
    const draft = readOnboardingDraft(organization.id)
    if (!isDraftWorthRestoring(draft, initialCompanyInfo, new Date())) return
    // Un borrador viejo puede no tener los campos nuevos (cobro): se completan.
    setForm({ ...initialCompanyInfo, ...(draft!.form as Partial<CompanyInfoForm>) })
    setCountryCode(draft!.countryCode || countryCode)
    setLocalPhone(draft!.localPhone || localPhone)
    setDraftRestored(true)
  }, [organization.id, initialCompanyInfo, countryCode, localPhone])

  // El borrador se escribe mientras escribe, no al final.
  useEffect(() => {
    if (!draftChecked.current) return
    if (!hasChanges) {
      clearOnboardingDraft(organization.id)
      return
    }
    writeOnboardingDraft(organization.id, {
      form: form as unknown as Record<string, unknown>,
      countryCode,
      localPhone,
      savedAt: new Date().toISOString(),
    })
  }, [form, countryCode, localPhone, hasChanges, organization.id])

  useEffect(() => {
    if (!hasChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const updateToggle = (field: 'storefrontPublic', value: boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'storefrontPublic' && !value) setConfirmPublication(false)
    setError('')
  }

  const discardChanges = () => {
    setForm(initialCompanyInfo)
    const phone = parsePhone(initialCompanyInfo.phone)
    setCountryCode(phone.code)
    setLocalPhone(phone.local)
    setConfirmCurrencyChange(false)
    setConfirmPublication(false)
    setDraftRestored(false)
    setError('')
    clearOnboardingDraft(organization.id)
  }

  const updateField = (field: keyof CompanyInfoForm, value: string) => {
    // Una barbería trabaja con turnos: se propone «Prestación de servicios», que se puede cambiar.
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'businessVertical' && value === 'barbershop' ? { operatingModel: 'service' } : {}),
    }))
    if (field === 'currency') setConfirmCurrencyChange(false)
    setError('')
  }

  const updateCheckout = (patch: Partial<CheckoutChoices>) => {
    setForm((current) => ({ ...current, checkout: { ...current.checkout, ...patch } }))
    setError('')
  }

  /** Lo que falta en un paso para poder seguir. null = se puede avanzar. */
  const stepProblem = (stepId: FormStepId): string | null => {
    if (stepId === 'contact') {
      const contactErrors = (['displayName', 'phone', 'email', 'address', 'city'] as const).filter((field) => fieldErrors[field])
      if (contactErrors.length) return 'Completá los datos marcados para seguir.'
      if (currencyNeedsConfirmation && !confirmCurrencyChange) return 'Confirmá el impacto del cambio de moneda para seguir.'
    }
    if (stepId === 'payments') return checkoutError
    if (stepId === 'public') {
      if (fieldErrors.logoUrl) return fieldErrors.logoUrl
      if (publishingNow && !confirmPublication) return 'Confirmá que querés publicar la tienda, o desmarcá la casilla.'
    }
    return null
  }

  const goToStep = (index: number) => {
    const target = FORM_STEPS[Math.min(FORM_STEPS.length - 1, Math.max(0, index))]
    setActiveTab(target.id)
    setFurthestStep((current) => Math.max(current, index))
    setError('')
    document.getElementById('company-info')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const nextStep = () => {
    const problem = stepProblem(FORM_STEPS[stepIndex].id)
    if (problem) {
      setError(problem)
      if (FORM_STEPS[stepIndex].id === 'contact') focusFirstError()
      return
    }
    goToStep(stepIndex + 1)
  }

  const updatePhone = (code: string, local: string) => {
    const combined = local.trim() ? `${code} ${local.trim()}` : ''
    setForm((current) => ({ ...current, phone: combined }))
    setError('')
  }

  const focusFirstError = () => {
    const firstField = Object.keys(fieldErrors)[0]
    if (!firstField) return
    setActiveTab(firstField === 'logoUrl' ? 'public' : 'contact')
    window.setTimeout(() => document.getElementById(firstField)?.focus(), 0)
  }

  const completeOnboarding = async () => {
    if (!isAdmin) {
      toast.error('Solo administradores pueden guardar esta configuración.')
      return
    }
    if (Object.keys(fieldErrors).length > 0) {
      setError('Revisá los campos marcados antes de continuar.')
      focusFirstError()
      return
    }
    if (currencyNeedsConfirmation && !confirmCurrencyChange) {
      setActiveTab('contact')
      setError('Confirmá el impacto del cambio de moneda antes de guardar.')
      return
    }
    if (checkoutError) {
      setActiveTab('payments')
      setError(checkoutError)
      return
    }
    if (publishingNow && !confirmPublication) {
      setActiveTab('public')
      setError('Confirmá que querés publicar la tienda antes de guardar.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, confirmCurrencyChange: confirmCurrencyChange || !currencyNeedsConfirmation, confirmPublication }),
      })
      const payload = await response.json().catch(() => null) as {
        error?: string
        websiteContentIncomplete?: boolean
      } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar la configuración')

      clearOnboardingStatusCache()
      // Lo guardado ya no necesita borrador.
      clearOnboardingDraft(organization.id)
      setDraftRestored(false)
      toast.success(isRevisit ? 'Cambios guardados' : 'Configuración inicial completada')
      // El servidor ya no descarta el error de la siembra: si el contenido
      // inicial del sitio no se pudo escribir, se dice en vez de responder
      // «listo» y dejar la tienda vacia.
      if (payload?.websiteContentIncomplete) {
        toast.warning('Tu tienda quedó sin el contenido inicial. Podés cargarlo desde Sitio Web.')
      }
      if (isRevisit) router.refresh()
      else router.push('/dashboard')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la configuración'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-32 sm:pb-24">
      {/* Encabezado Principal */}
      <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/[0.04] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {isRevisit ? 'Configuración y perfil del negocio' : 'Configuración inicial del negocio'}
                </h1>
                {isRevisit ? (
                  <Badge variant="secondary" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs font-medium">
                    {stepsCompleted} de {steps.length} pasos listos
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong className="text-foreground">{organization.name}</strong> · Plan {planName || subscription?.plan || organization.plan}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                subscriptionInfo.tone === 'danger' && 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
                subscriptionInfo.tone === 'warning' && 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                (subscriptionInfo.tone === 'ok' || subscriptionInfo.tone === 'trial') && 'border-primary/20 bg-background',
              )}
            >
              {subscriptionInfo.label}
            </Badge>
            {subscriptionInfo.dateLabel ? (
              <span className="text-xs text-muted-foreground">{subscriptionInfo.dateLabel}</span>
            ) : null}
          </div>
        </div>

        {/* Barra de Progreso del Onboarding */}
        <div className="mt-6 border-t border-border/60 pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Progreso de activación</span>
            <span>{stepsCompleted} de {steps.length} pasos completados ({progressValue}%)</span>
          </div>
          <Progress value={progressValue} className="h-2 rounded-full" />
        </div>
      </header>

      {/* Grid Principal: Formulario + Barra Lateral */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main id="company-info" className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b border-border/80 bg-muted/20 p-3 sm:p-4">
              {wizard ? (
                // Primera vez: un paso a la vez. Se puede volver a cualquiera ya visitado.
                <ol className="flex items-center gap-1.5 overflow-x-auto" aria-label="Pasos de la configuración">
                  {FORM_STEPS.map((step, index) => {
                    const current = index === stepIndex
                    const reachable = index <= furthestStep
                    return (
                      <li key={step.id} className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!reachable}
                          onClick={() => goToStep(index)}
                          aria-current={current ? 'step' : undefined}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                            current ? 'bg-primary text-primary-foreground' : reachable ? 'bg-background text-foreground hover:bg-muted' : 'text-muted-foreground',
                          )}
                        >
                          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', current ? 'bg-primary-foreground/20' : 'bg-muted')}>
                            {index < stepIndex ? <Check className="h-3 w-3" /> : index + 1}
                          </span>
                          <span className={current ? '' : 'hidden sm:inline'}>{step.label}</span>
                        </button>
                        {index < FORM_STEPS.length - 1 ? <span className="h-px w-3 bg-border" /> : null}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/70 p-1 rounded-xl sm:grid-cols-5">
                  {FORM_STEPS.map((step) => {
                    const Icon = step.icon
                    return (
                      <TabsTrigger key={step.id} value={step.id} className="gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{step.label}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              )}
            </div>

            {draftRestored ? (
              <div className="p-5 pb-0">
                <Alert className="rounded-xl border-primary/30 bg-primary/5">
                  <RotateCcw className="h-5 w-5" />
                  <AlertTitle className="font-semibold">Retomamos lo que habías cargado</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    Quedó guardado en este dispositivo, sin enviarse. Revisalo y guardá, o descartalo para volver a
                    lo que está publicado.
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}

            {error ? (
              <div className="p-5 pb-0">
                <Alert variant="destructive" className="rounded-xl border-destructive/40 bg-destructive/5 shadow-sm">
                  <ShieldAlert className="h-5 w-5" />
                  <AlertTitle className="font-semibold">Atención requerida</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
                </Alert>
              </div>
            ) : null}

            {/* TAB 1: ESENCIALES (RUBRO, IDENTIDAD, MONEDA) */}
            <TabsContent value="business" className="m-0 space-y-8 p-5 sm:p-6 focus-visible:outline-none">
              {/* SECCIÓN 1: SELECCIÓN DE RUBRO Y FORMA DE TRABAJO */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="h-4 w-4" />
                      </div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Rubro y modelo de tu negocio
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Elegí el rubro para que el sistema adapte automáticamente los módulos sugeridos y el catálogo.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:inline-flex border-primary/20 bg-primary/5 text-primary text-xs font-normal">
                    Configuración clave
                  </Badge>
                </div>

                {/* Grid Visual de Rubros */}
                <div className="space-y-2">
                  <Label htmlFor="businessVertical" className="text-xs font-semibold text-foreground">
                    Rubro principal de actividad
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {BUSINESS_VERTICALS.map((verticalKey) => {
                      const meta = VERTICAL_METADATA[verticalKey]
                      const isSelected = form.businessVertical === verticalKey
                      const Icon = meta.icon
                      return (
                        <button
                          key={verticalKey}
                          type="button"
                          onClick={() => updateField('businessVertical', verticalKey)}
                          className={cn(
                            'group relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                            'hover:border-primary/50 hover:bg-muted/30',
                            isSelected
                              ? 'border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/20'
                              : 'border-border/80 bg-card'
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                            <p className="text-[11px] leading-tight text-muted-foreground mt-0.5">{meta.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Fallback Select oculto o complementario para accesibilidad y sincronización */}
                  <select
                    id="businessVertical"
                    aria-label="Rubro de la empresa"
                    value={form.businessVertical}
                    onChange={(event) => updateField('businessVertical', event.target.value)}
                    className="sr-only"
                  >
                    {BUSINESS_VERTICALS.map((key) => (
                      <option key={key} value={key}>{VERTICAL_METADATA[key].label}</option>
                    ))}
                  </select>
                </div>

                {/* Forma de Trabajo (Modelo Operativo) */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="operatingModel" className="text-xs font-semibold text-foreground">
                    Forma de trabajo u operativa
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {OPERATING_MODELS.map((modelKey) => {
                      const meta = MODEL_METADATA[modelKey]
                      const isSelected = form.operatingModel === modelKey
                      const Icon = meta.icon
                      return (
                        <button
                          key={modelKey}
                          type="button"
                          onClick={() => {
                            updateField('operatingModel', modelKey)
                            updateField('businessType', modelKey)
                          }}
                          className={cn(
                            'group relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                            'hover:border-primary/50 hover:bg-muted/30',
                            isSelected
                              ? 'border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/20'
                              : 'border-border/80 bg-card'
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                            <p className="text-[11px] leading-tight text-muted-foreground mt-0.5">{meta.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <select
                    id="operatingModel"
                    aria-label="Forma de trabajo"
                    value={form.operatingModel}
                    onChange={(event) => {
                      updateField('operatingModel', event.target.value)
                      updateField('businessType', event.target.value)
                    }}
                    className="sr-only"
                  >
                    {OPERATING_MODELS.map((key) => (
                      <option key={key} value={key}>{MODEL_METADATA[key].label}</option>
                    ))}
                  </select>
                </div>

                {/* Banner de Módulos Sugeridos Automáticamente */}
                <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {isRevisit ? 'Herramientas que suelen usar los negocios de tu rubro:' : 'Herramientas que se activan para tu actividad:'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {suggestedSplit.included.map((module) => (
                          <Badge key={module} variant="secondary" className="border-primary/20 bg-background text-[11px] font-normal text-foreground">
                            {MODULE_LABELS[module]}
                          </Badge>
                        ))}
                      </div>
                      {suggestedSplit.notIncluded.length > 0 ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Tu plan no incluye: {suggestedSplit.notIncluded.map((module) => MODULE_LABELS[module]).join(', ')}.{' '}
                          <Link href="/admin/subscriptions" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Ver planes</Link>
                        </p>
                      ) : null}
                      {isRevisit ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Cambiar el rubro no activa ni desactiva herramientas. Las activás o apagás en{' '}
                          <Link href="/admin/settings" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Configuración → Empresa</Link>.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

            </TabsContent>

            <TabsContent value="contact" className="m-0 space-y-8 p-5 sm:p-6 focus-visible:outline-none">
              {/* SECCIÓN 2: IDENTIDAD Y CONTACTO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    Identidad y datos de contacto
                  </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="displayName" className="text-xs font-medium text-foreground flex items-center gap-1">
                      Nombre público o comercial <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="displayName"
                      value={form.displayName}
                      onChange={(event) => updateField('displayName', event.target.value)}
                      placeholder="Ej: Tienda Aurora"
                      className="h-10"
                      aria-invalid={Boolean(fieldErrors.displayName)}
                      aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                    />
                    <FieldError id="displayName-error" message={fieldErrors.displayName} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-medium text-foreground flex items-center gap-1">
                      Teléfono de contacto <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 bg-background">
                      <div className="relative shrink-0 border-r bg-muted/40">
                        <select
                          aria-label="Código de país"
                          value={countryCode}
                          onChange={(event) => {
                            setCountryCode(event.target.value)
                            updatePhone(event.target.value, localPhone)
                          }}
                          className="h-10 appearance-none bg-transparent py-2 pl-3 pr-7 text-xs font-medium focus:outline-none"
                        >
                          {COUNTRY_CODES.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.code} ({country.name})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="phone"
                          type="tel"
                          value={localPhone}
                          onChange={(event) => {
                            setLocalPhone(event.target.value)
                            updatePhone(countryCode, event.target.value)
                          }}
                          placeholder="981 000 000"
                          aria-invalid={Boolean(fieldErrors.phone)}
                          className="h-10 w-full bg-transparent py-2 pl-9 pr-3 text-xs outline-none"
                        />
                      </div>
                    </div>
                    <FieldError id="phone-error" message={fieldErrors.phone} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-medium text-foreground">
                      Correo electrónico empresarial
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => updateField('email', event.target.value)}
                        placeholder="contacto@miempresa.com"
                        className="h-10 pl-9"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      />
                    </div>
                    <FieldError id="email-error" message={fieldErrors.email} />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address" className="text-xs font-medium text-foreground flex items-center gap-1">
                      Dirección comercial <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="address"
                        value={form.address}
                        onChange={(event) => updateField('address', event.target.value)}
                        placeholder="Avda. Principal 1234 c/ Calle 1"
                        className="h-10 pl-9"
                        aria-invalid={Boolean(fieldErrors.address)}
                        aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                      />
                    </div>
                    <FieldError id="address-error" message={fieldErrors.address} />
                  </div>

                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="city" className="text-xs font-medium text-foreground flex items-center gap-1">
                      Ciudad <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => updateField('city', event.target.value)}
                      placeholder="Ej: Asunción"
                      className="h-10"
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={fieldErrors.city ? 'city-error' : undefined}
                    />
                    <FieldError id="city-error" message={fieldErrors.city} />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: OPERACIÓN REGIONAL Y MONEDA */}
              <div className="space-y-4 border-t border-border/80 pt-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Coins className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    Moneda y configuración regional
                  </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-xs font-semibold text-foreground">
                      Moneda base
                    </Label>
                    <select
                      id="currency"
                      value={form.currency}
                      onChange={(event) => updateField('currency', event.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-ring"
                    >
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code} — {currency.name}
                        </option>
                      ))}
                    </select>
                    <div className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Vista previa de importe:</span>
                      <strong className="text-foreground font-mono">{currencyPreview}</strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-xs font-semibold text-foreground">
                      Zona horaria
                    </Label>
                    <select
                      id="timezone"
                      value={form.timezone}
                      onChange={(event) => updateField('timezone', event.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-ring"
                    >
                      {timeZoneOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">Aplica a cierres de caja y fecha de comprobantes.</p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="language" className="text-xs font-semibold text-foreground">
                      Formato regional
                    </Label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(event) => updateField('language', event.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-ring"
                    >
                      {SUPPORTED_LANGUAGES.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.name} · {language.locale}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">Define separadores de miles y fechas. La interfaz se mantiene en español.</p>
                  </div>
                </div>

                {currencyNeedsConfirmation ? (
                  <Alert variant="destructive" className="rounded-xl border-destructive/40 bg-destructive/5 shadow-sm">
                    <ShieldAlert className="h-5 w-5" />
                    <AlertTitle className="font-semibold">Cambio de moneda pendiente</AlertTitle>
                    <AlertDescription className="space-y-3 text-xs leading-relaxed">
                      <p>Cambiar de <strong>{initialCompanyInfo.currency}</strong> a <strong>{form.currency}</strong> no convierte precios, saldos ni operaciones existentes.</p>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/30 bg-background/80 p-3 text-foreground transition-colors hover:bg-background">
                        <Checkbox checked={confirmCurrencyChange} onCheckedChange={(checked) => setConfirmCurrencyChange(checked === true)} />
                        <span className="text-xs font-medium leading-5">Entiendo el impacto y revisé los importes existentes.</span>
                      </label>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </TabsContent>

            {/* COBRO Y ENTREGA: lo mínimo para que el cliente pueda comprar. */}
            <TabsContent value="payments" className="m-0 space-y-6 p-5 sm:p-6 focus-visible:outline-none">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">Cómo cobrás y entregás</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Es lo que ve el cliente al comprar en tu tienda. Las instrucciones y las zonas con precio se ajustan después en Sitio Web.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Formas de pago que aceptás</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ['cash', 'Efectivo', 'Al retirar o al recibir'],
                    ['card', 'Tarjeta', 'Débito o crédito con posnet'],
                    ['transfer', 'Transferencia', 'Le mostrás tus datos bancarios'],
                    ['wallet', 'Billetera o QR', 'Tigo Money, QR del banco…'],
                  ] as const).map(([key, label, hint]) => (
                    <label key={key} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', form.checkout[key] ? 'border-primary bg-primary/[0.04]' : 'border-border/80 hover:bg-muted/30')}>
                      <Checkbox checked={form.checkout[key]} onCheckedChange={(checked) => updateCheckout({ [key]: checked === true })} className="mt-0.5" />
                      <span>
                        <span className="block text-xs font-semibold text-foreground">{label}</span>
                        <span className="block text-[11px] text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {form.checkout.transfer ? (
                <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2">
                  <p className="text-xs font-semibold text-foreground sm:col-span-2">Datos para transferencias</p>
                  <div className="space-y-1">
                    <Label htmlFor="transferBank" className="text-xs">Banco</Label>
                    <Input id="transferBank" value={form.checkout.transferBank} onChange={(event) => updateCheckout({ transferBank: event.target.value })} placeholder="Ej: Banco Itaú" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transferAccount" className="text-xs">Número de cuenta</Label>
                    <Input id="transferAccount" value={form.checkout.transferAccount} onChange={(event) => updateCheckout({ transferAccount: event.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transferHolder" className="text-xs">Titular</Label>
                    <Input id="transferHolder" value={form.checkout.transferHolder} onChange={(event) => updateCheckout({ transferHolder: event.target.value })} placeholder="Nombre o razón social" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="transferAlias" className="text-xs">Alias (opcional)</Label>
                    <Input id="transferAlias" value={form.checkout.transferAlias} onChange={(event) => updateCheckout({ transferAlias: event.target.value })} placeholder="Ej: tu RUC o celular" className="h-9" />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Cómo recibe el pedido el cliente</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', form.checkout.pickup ? 'border-primary bg-primary/[0.04]' : 'border-border/80 hover:bg-muted/30')}>
                    <Checkbox checked={form.checkout.pickup} onCheckedChange={(checked) => updateCheckout({ pickup: checked === true })} className="mt-0.5" />
                    <span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Store className="h-3.5 w-3.5" /> Retiro en el local</span>
                      <span className="block text-[11px] text-muted-foreground">En {form.address || 'tu dirección'}</span>
                    </span>
                  </label>
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', form.checkout.delivery ? 'border-primary bg-primary/[0.04]' : 'border-border/80 hover:bg-muted/30')}>
                    <Checkbox checked={form.checkout.delivery} onCheckedChange={(checked) => updateCheckout({ delivery: checked === true })} className="mt-0.5" />
                    <span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Truck className="h-3.5 w-3.5" /> Envío a domicilio</span>
                      <span className="block text-[11px] text-muted-foreground">Delivery propio o por encomienda</span>
                    </span>
                  </label>
                </div>
              </div>

              {form.checkout.delivery ? (
                <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="deliveryCost" className="text-xs">Costo del envío</Label>
                    <Input id="deliveryCost" type="number" min={0} value={form.checkout.deliveryCost} onChange={(event) => updateCheckout({ deliveryCost: Math.max(0, Number(event.target.value) || 0) })} className="h-9" />
                    <p className="text-[11px] text-muted-foreground">0 = «a coordinar» o gratis.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deliveryZones" className="text-xs">Zonas a las que llegás</Label>
                    <Input id="deliveryZones" value={form.checkout.deliveryZones} onChange={(event) => updateCheckout({ deliveryZones: event.target.value })} placeholder="Ej: Asunción y Gran Asunción" className="h-9" />
                  </div>
                </div>
              ) : null}

              {checkoutError ? <FieldError id="checkout-error" message={checkoutError} /> : null}
            </TabsContent>

            {/* TAB 2: PÚBLICO (HORARIOS, LOGO, WHATSAPP) */}
            <TabsContent value="public" className="m-0 space-y-6 p-5 sm:p-6 focus-visible:outline-none">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    Presencia pública e información de tienda
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Datos visibles para tus clientes en la página y recibos.</p>
                </div>
              </div>

              {/* Visibilidad de la tienda.
                  Una organización nueva arranca con la tienda apagada y nada lo
                  decía: la lista de preparación marcaba «Tienda pública · Listo»
                  y el enlace llevaba a una página sin publicar. */}
              <div className={cn(
                'rounded-xl border p-4 transition-colors',
                form.storefrontPublic
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                  : 'border-border/80 bg-muted/20'
              )}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="storefrontPublic"
                    checked={form.storefrontPublic}
                    onCheckedChange={(checked) => updateToggle('storefrontPublic', checked === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="storefrontPublic" className="text-sm font-semibold text-foreground cursor-pointer">
                      Publicar mi tienda en internet
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {form.storefrontPublic
                        ? <>Cualquiera con el enlace va a poder ver tu catálogo en <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{publicUrl}</code>. Podés apagarla cuando quieras.</>
                        : <>Tu tienda existe pero <strong className="text-foreground">nadie puede verla todavía</strong>. Marcá esta casilla cuando quieras abrirla al público.</>}
                    </p>
                  </div>
                </div>

                {form.storefrontPublic && !stepProgress.hasProducts ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Tu tienda todavía no tiene {serviceFocused ? 'servicios' : 'productos'}: quien entre va a ver el catálogo vacío.{' '}
                      <Link href="/dashboard/products" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Cargar {serviceFocused ? 'servicios' : 'productos'}</Link>
                    </span>
                  </p>
                ) : null}

                {publishingNow ? (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-500/40 bg-background/80 p-3 transition-colors hover:bg-background">
                    <Checkbox
                      checked={confirmPublication}
                      onCheckedChange={(checked) => setConfirmPublication(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs font-medium leading-5 text-foreground">
                      Entiendo que al guardar, mi tienda queda visible para cualquiera con el enlace.
                    </span>
                  </label>
                ) : null}
              </div>

              {/* Color de marca.
                  El onboarding ya lo escribía: le fijaba 'blue' en cada
                  guardado, pisando lo elegido en Sitio Web. */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">Color principal de tu tienda</Label>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLORS.map((color) => {
                    const selected = form.brandColor === color.key
                    return (
                      <button
                        key={color.key}
                        type="button"
                        onClick={() => updateField('brandColor', color.key)}
                        aria-pressed={selected}
                        title={color.name}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all',
                          selected
                            ? 'border-primary ring-2 ring-primary/25'
                            : 'border-border/80 hover:border-primary/40'
                        )}
                      >
                        <span className={cn('h-6 w-6 rounded-md', color.swatch)} />
                        <span className={cn(
                          'text-[10px]',
                          selected ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        )}>
                          {color.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {form.brandColor === 'custom' ? (
                  <p className="text-[11px] text-muted-foreground">
                    Ya tenés un color propio configurado en <strong className="text-foreground">Sitio Web</strong>.
                    Elegí uno de acá solo si querés reemplazarlo.
                  </p>
                ) : null}

                {/* Se abre en otra pestaña a proposito: el formulario de esta
                    pantalla tiene cambios sin guardar, y la navegacion interna
                    de Next no dispara el aviso de `beforeunload`. */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                  <p className="text-xs font-semibold text-foreground">
                    Acá elegís lo esencial. El sitio completo se configura aparte.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    En <strong className="text-foreground">Sitio Web</strong> están el encabezado y la
                    portada, la barra de confianza, el carrusel de promociones, las ofertas, el
                    catálogo de servicios, los pasos del proceso y las formas de pago y entrega.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2.5 h-8 gap-1.5 text-xs" asChild>
                    <Link href="/admin/website" target="_blank" rel="noopener noreferrer">
                      Abrir Sitio Web en otra pestaña
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Se abre en una pestaña nueva para que no pierdas lo que cargaste acá.
                  </p>
                </div>
              </div>

              {servicesEnabled && serviceFocused ? (
                <p className="rounded-xl border border-border/80 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  Este horario es el texto que ve el cliente en la tienda. Los horarios en los que se pueden reservar turnos se configuran en{' '}
                  <Link href="/dashboard/agenda/configuracion" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Agenda → Configurar</Link>
                  : mantené los dos iguales.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weekdays" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Horario semanal (Lunes a Viernes)
                  </Label>
                  <Input
                    id="weekdays"
                    value={form.weekdays}
                    onChange={(event) => updateField('weekdays', event.target.value)}
                    placeholder="Lunes a viernes, 08:00 a 18:00"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saturday" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Horario de Sábados
                  </Label>
                  <Input
                    id="saturday"
                    value={form.saturday}
                    onChange={(event) => updateField('saturday', event.target.value)}
                    placeholder="Sábado, 08:00 a 12:00"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="logoUrl" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Logotipo
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={uploadingLogo || !isAdmin} asChild>
                      <label className="cursor-pointer">
                        {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploadingLogo ? 'Subiendo…' : form.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="sr-only"
                          disabled={uploadingLogo || !isAdmin}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (file) void uploadLogo(file)
                          }}
                        />
                      </label>
                    </Button>
                    <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP o SVG, hasta 2 MB. O pegá un enlace:</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="logoUrl"
                      type="url"
                      value={form.logoUrl}
                      onChange={(event) => updateField('logoUrl', event.target.value)}
                      placeholder="https://ejemplo.com/logo.png"
                      className="h-10"
                      aria-invalid={Boolean(fieldErrors.logoUrl)}
                      aria-describedby={fieldErrors.logoUrl ? 'logoUrl-error' : undefined}
                    />
                  </div>
                  <FieldError id="logoUrl-error" message={fieldErrors.logoUrl} />
                  <p className="text-[11px] text-muted-foreground">Formato recomendado: PNG transparente o SVG.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ruc" className="text-xs font-medium text-foreground">
                    RUC / Identificación Fiscal
                  </Label>
                  <Input
                    id="ruc"
                    value={form.ruc}
                    onChange={(event) => updateField('ruc', event.target.value)}
                    placeholder="Ej: 80012345-6"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    WhatsApp comercial de atención
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={form.whatsapp}
                    onChange={(event) => updateField('whatsapp', event.target.value)}
                    placeholder="+595 981 000 000"
                    className="h-10"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: REDES SOCIALES */}
            <TabsContent value="social" className="m-0 space-y-6 p-5 sm:p-6 focus-visible:outline-none">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    Perfiles de redes sociales
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Conectá tus canales públicos para que aparezcan en el pie de página de tu tienda.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="text-xs font-medium text-foreground">
                    Perfil de Instagram
                  </Label>
                  <div className="flex overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring bg-background">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground font-mono">
                      instagram.com/
                    </span>
                    <Input
                      id="instagram"
                      value={form.instagram}
                      onChange={(event) => updateField('instagram', event.target.value)}
                      onBlur={(event) => updateField('instagram', socialHandle(event.target.value, 'instagram'))}
                      placeholder="usuario"
                      className="h-10 border-0 focus-visible:ring-0 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook" className="text-xs font-medium text-foreground">
                    Página de Facebook
                  </Label>
                  <div className="flex overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring bg-background">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground font-mono">
                      facebook.com/
                    </span>
                    <Input
                      id="facebook"
                      value={form.facebook}
                      onChange={(event) => updateField('facebook', event.target.value)}
                      onBlur={(event) => updateField('facebook', socialHandle(event.target.value, 'facebook'))}
                      placeholder="pagina"
                      className="h-10 border-0 focus-visible:ring-0 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="text-xs font-medium text-foreground">
                    Canal de TikTok
                  </Label>
                  <div className="flex overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring bg-background">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground font-mono">
                      tiktok.com/@
                    </span>
                    <Input
                      id="tiktok"
                      value={form.tiktok}
                      onChange={(event) => updateField('tiktok', event.target.value)}
                      onBlur={(event) => updateField('tiktok', socialHandle(event.target.value, 'tiktok'))}
                      placeholder="usuario"
                      className="h-10 border-0 focus-visible:ring-0 text-xs"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* Barra Lateral: Checklist y Vista Previa */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {/* Checklist de Preparación */}
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground">Lista de preparación</h2>
              <Badge variant="secondary" className="font-semibold text-xs">
                {stepsCompleted}/{steps.length}
              </Badge>
            </div>

            <ol className="divide-y divide-border/60">
              {steps.map((step) => {
                const Icon = step.icon
                const done = stepProgress[step.doneKey]
                // Sin publicar, el enlace a la tienda lleva a una pagina que
                // nadie puede ver: mientras el paso este pendiente, apunta al
                // interruptor que lo resuelve.
                const pendingStorefront = step.doneKey === 'hasPublicStore' && !done
                const href = pendingStorefront ? '/admin/onboarding#company-info' : step.href
                // Todo lo que saca de esta pantalla se abre en otra pestaña: el
                // formulario puede tener cambios sin guardar, y la navegacion
                // interna de Next no dispara el aviso de `beforeunload`. La
                // unica excepcion es el enlace que lleva a esta misma pantalla.
                const leavesOnboarding = !pendingStorefront && !href.startsWith('/admin/onboarding')
                return (
                  <li key={step.title} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors shadow-xs',
                        done
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-semibold text-foreground leading-tight">{step.title}</p>
                          {done ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Listo</span>
                          ) : (
                            <Circle className="mt-0.5 h-3 w-3 text-muted-foreground/40" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{step.description}</p>

                        {step.doneKey !== 'hasCompanyInfo' ? (
                          <Button variant="link" size="sm" className="mt-1.5 h-auto p-0 text-xs font-medium text-primary" asChild>
                            <Link
                              href={href}
                              target={leavesOnboarding ? '_blank' : undefined}
                              rel={leavesOnboarding ? 'noopener noreferrer' : undefined}
                              onClick={pendingStorefront ? () => setActiveTab('public') : undefined}
                            >
                              {done ? 'Revisar' : pendingStorefront ? 'Publicar' : 'Configurar'}
                              {leavesOnboarding ? <ExternalLink className="ml-1 h-3 w-3" /> : <ArrowRight className="ml-1 h-3 w-3" />}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <ShareStoreCard
            url={siteUrl(publicUrl)}
            storeName={initialCompanyInfo.displayName || organization.name}
            published={initialCompanyInfo.storefrontPublic}
            onPublish={() => {
              setActiveTab('public')
              setFurthestStep(FORM_STEPS.length - 1)
              document.getElementById('company-info')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
            }}
          />

          {/* Tarjeta de Vista Previa de Tienda Pública */}
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground">Vista previa de tienda</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                <Link href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir tienda pública">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2 text-xs">
              {form.logoUrl ? (
                <div className="flex justify-center rounded-lg bg-background p-2 border">
                  <Image
                    src={form.logoUrl}
                    alt="Logo"
                    width={140}
                    height={36}
                    unoptimized
                    className="h-8 w-auto object-contain"
                  />
                </div>
              ) : null}

              <div>
                <p className="font-bold text-foreground text-sm">{form.displayName || organization.name}</p>
                <p className="text-muted-foreground">{form.address || 'Dirección pendiente'}{form.city ? `, ${form.city}` : ''}</p>
                <p className="text-muted-foreground">{form.phone || 'Teléfono pendiente'}</p>
              </div>

              {form.email ? (
                <p className="break-all text-muted-foreground font-mono text-[11px]">{form.email}</p>
              ) : null}

              <div className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground space-y-0.5">
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" /> {form.weekdays || 'Lun a Vie'}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" /> {form.saturday || 'Sábados'}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Barra Fija / Flotante de Acciones */}
      {/* El panel dibuja su propia navegacion fija abajo en pantallas chicas:
          sin este z-index y este margen, tapaba el boton de guardar. */}
      <footer className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[60] mx-2 rounded-2xl border bg-background/95 px-4 py-3 backdrop-blur-md shadow-lg lg:bottom-4 lg:mx-0 lg:sticky lg:inset-x-auto">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-foreground">
              {!isAdmin
                ? 'Solo administradores pueden guardar'
                : hasChanges
                  ? 'Tenés cambios sin guardar'
                  : isRevisit
                    ? 'Todo está actualizado'
                    : wizard
                      ? `Paso ${stepIndex + 1} de ${FORM_STEPS.length}: ${FORM_STEPS[stepIndex].label}`
                      : 'Listo para completar tu configuración'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRevisit
                ? 'Los cambios se sincronizan en tiempo real con la Configuración general.'
                : 'Luego podrás gestionar productos, ventas en POS y revisar tu tienda online.'}
            </p>
          </div>

          <div className="flex w-full items-center gap-2.5 sm:w-auto sm:shrink-0">
            {isRevisit && hasChanges ? (
              <Button
                type="button"
                variant="outline"
                onClick={discardChanges}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Descartar
              </Button>
            ) : null}

            {wizard && stepIndex > 0 ? (
              <Button type="button" variant="outline" onClick={() => goToStep(stepIndex - 1)} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </Button>
            ) : null}

            {wizard && stepIndex < FORM_STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep} className="min-w-0 flex-1 sm:min-w-[170px] sm:flex-none gap-2 shadow-sm text-xs font-semibold">
                Siguiente: {FORM_STEPS[stepIndex + 1].label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
            <Button
              onClick={completeOnboarding}
              disabled={saving || !canSubmit}
              className="min-w-0 flex-1 sm:min-w-[170px] sm:flex-none gap-2 shadow-sm text-xs font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving ? 'Guardando…' : isRevisit ? 'Guardar cambios' : 'Finalizar configuración'}
            </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
