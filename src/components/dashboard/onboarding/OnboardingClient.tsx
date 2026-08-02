'use client'

import { useEffect, useMemo, useState, type ElementType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ShieldAlert,
  Store,
  Users,
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
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '@/lib/currency'
import { getAdminSettingsText } from '@/lib/i18n/admin-settings'
import { clearOnboardingStatusCache } from '@/lib/onboarding/status-cache'

type StepProgress = {
  hasCompanyInfo: boolean
  hasProducts: boolean
  hasPublicStore: boolean
  hasTeam: boolean
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
  instagram: string
  facebook: string
  tiktok: string
}

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
  } | null
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

function buildSteps(slug: string): OnboardingStep[] {
  return [
    {
      title: 'Datos del negocio',
      description: 'Identidad, contacto y operación',
      href: '/dashboard/onboarding#company-info',
      icon: Building2,
      doneKey: 'hasCompanyInfo',
    },
    {
      title: 'Productos',
      description: 'Inventario, precios e imágenes',
      href: '/dashboard/products',
      icon: Package,
      doneKey: 'hasProducts',
    },
    {
      title: 'Tienda pública',
      description: 'Revisión de catálogo y carrito',
      href: `/${slug}/inicio`,
      icon: Store,
      doneKey: 'hasPublicStore',
    },
    {
      title: 'Equipo',
      description: 'Usuarios y permisos',
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

function formatTrialDate(value: string | null) {
  if (!value) return 'Sin fecha definida'
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Sin fecha definida'
  }
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
  return <p id={id} role="alert" className="text-xs text-destructive">{message}</p>
}

export function OnboardingClient({
  organization,
  subscription,
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
  const [activeTab, setActiveTab] = useState('essential')
  const [error, setError] = useState('')
  const [confirmCurrencyChange, setConfirmCurrencyChange] = useState(false)
  const initialPhone = parsePhone(initialCompanyInfo.phone)
  const [countryCode, setCountryCode] = useState(initialPhone.code)
  const [localPhone, setLocalPhone] = useState(initialPhone.local)

  const publicUrl = `/${organization.slug}/inicio`
  const steps = buildSteps(organization.slug).filter((step) => step.doneKey !== 'hasTeam' || isAdmin)
  const stepsCompleted = steps.filter((step) => stepProgress[step.doneKey]).length
  const progressValue = steps.length ? Math.round((stepsCompleted / steps.length) * 100) : 0
  const nextStep = steps.find((step) => !stepProgress[step.doneKey])
  const currencyChanged = form.currency !== initialCompanyInfo.currency
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

  const canSubmit = isAdmin
    && Object.keys(fieldErrors).length === 0
    && (!currencyChanged || confirmCurrencyChange)
    && (!isRevisit || hasChanges)

  useEffect(() => {
    if (!hasChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const updateField = (field: keyof CompanyInfoForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'currency') setConfirmCurrencyChange(false)
    setError('')
  }

  const updatePhone = (code: string, local: string) => {
    const combined = local.trim() ? `${code} ${local.trim()}` : ''
    setForm((current) => ({ ...current, phone: combined }))
    setError('')
  }

  const focusFirstError = () => {
    const firstField = Object.keys(fieldErrors)[0]
    if (!firstField) return
    setActiveTab(firstField === 'logoUrl' ? 'public' : 'essential')
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
    if (currencyChanged && !confirmCurrencyChange) {
      setActiveTab('essential')
      setError('Confirmá el impacto del cambio de moneda antes de guardar.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, confirmCurrencyChange }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar la configuración')

      clearOnboardingStatusCache()
      toast.success(isRevisit ? 'Cambios guardados' : 'Configuración inicial completada')
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
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-32 sm:pb-24">
      <header className="space-y-4 border-b pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  {isRevisit ? 'Configuración del negocio' : 'Prepará tu negocio'}
                </h1>
                {isRevisit ? <Badge variant="secondary">Configuración completada</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {organization.name} · Plan {subscription?.plan || organization.plan}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{subscription?.status || 'trialing'}</Badge>
            <span className="text-muted-foreground">Prueba hasta {formatTrialDate(subscription?.trialEndsAt ?? null)}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso general</span>
              <span>{stepsCompleted} de {steps.length} pasos</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
          {nextStep ? <p className="text-xs text-muted-foreground sm:pl-4">Siguiente: <span className="font-medium text-foreground">{nextStep.title}</span></p> : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main id="company-info" className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b p-3">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="essential" className="gap-2 py-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Esenciales</span>
                  <span className="sm:hidden">Datos</span>
                </TabsTrigger>
                <TabsTrigger value="public" className="gap-2 py-2">
                  <Globe className="h-4 w-4" />
                  <span>Público</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="gap-2 py-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Redes</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {error ? (
              <div className="px-5 pt-5">
                <Alert variant="destructive">
                  <ShieldAlert />
                  <AlertTitle>No se pudo continuar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : null}

            <TabsContent value="essential" className="m-0 space-y-6 p-5">
              <div>
                <h2 className="text-base font-semibold">Identidad y contacto</h2>
                <p className="mt-1 text-sm text-muted-foreground">Información utilizada en pedidos y comprobantes.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="displayName">Nombre público <span className="text-destructive">*</span></Label>
                  <Input id="displayName" value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined} />
                  <FieldError id="displayName-error" message={fieldErrors.displayName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono <span className="text-destructive">*</span></Label>
                  <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <div className="relative shrink-0 border-r bg-muted/40">
                      <select
                        aria-label="Código de país"
                        value={countryCode}
                        onChange={(event) => {
                          setCountryCode(event.target.value)
                          updatePhone(event.target.value, localPhone)
                        }}
                        className="h-10 appearance-none bg-transparent py-2 pl-3 pr-7 text-sm focus:outline-none"
                      >
                        {COUNTRY_CODES.map((country) => <option key={country.code} value={country.code}>{country.code}</option>)}
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
                        className="h-10 w-full bg-background py-2 pl-9 pr-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <FieldError id="phone-error" message={fieldErrors.phone} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo público</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="pl-9" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
                  </div>
                  <FieldError id="email-error" message={fieldErrors.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="address" value={form.address} onChange={(event) => updateField('address', event.target.value)} className="pl-9" aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'address-error' : undefined} />
                  </div>
                  <FieldError id="address-error" message={fieldErrors.address} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad <span className="text-destructive">*</span></Label>
                  <Input id="city" value={form.city} onChange={(event) => updateField('city', event.target.value)} aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? 'city-error' : undefined} />
                  <FieldError id="city-error" message={fieldErrors.city} />
                </div>
              </div>

              <div className="border-t pt-5">
                <h2 className="text-base font-semibold">Operación regional</h2>
                <p className="mt-1 text-sm text-muted-foreground">Define cómo se muestran importes y fechas.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <select id="currency" value={form.currency} onChange={(event) => updateField('currency', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {SUPPORTED_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona horaria</Label>
                  <select id="timezone" value={form.timezone} onChange={(event) => updateField('timezone', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {timeZoneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="language">Formato regional</Label>
                  <select id="language" value={form.language} onChange={(event) => updateField('language', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {SUPPORTED_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.locale}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">La interfaz general continúa en español.</p>
                </div>
              </div>

              {currencyChanged ? (
                <Alert variant="destructive">
                  <ShieldAlert />
                  <AlertTitle>Cambio de moneda pendiente</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>Cambiar de {initialCompanyInfo.currency} a {form.currency} no convierte precios, saldos ni operaciones existentes.</p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-destructive/30 bg-background/70 p-3 text-foreground">
                      <Checkbox checked={confirmCurrencyChange} onCheckedChange={(checked) => setConfirmCurrencyChange(checked === true)} />
                      <span className="text-sm leading-5">Entiendo el impacto y revisé los importes existentes.</span>
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}
            </TabsContent>

            <TabsContent value="public" className="m-0 space-y-6 p-5">
              <div>
                <h2 className="text-base font-semibold">Presencia pública</h2>
                <p className="mt-1 text-sm text-muted-foreground">Datos opcionales visibles en la tienda.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weekdays">Horario semanal</Label>
                  <Input id="weekdays" value={form.weekdays} onChange={(event) => updateField('weekdays', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saturday">Horario del sábado</Label>
                  <Input id="saturday" value={form.saturday} onChange={(event) => updateField('saturday', event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="logoUrl">URL del logo</Label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="logoUrl" type="url" value={form.logoUrl} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="https://..." className="pl-9" aria-invalid={Boolean(fieldErrors.logoUrl)} aria-describedby={fieldErrors.logoUrl ? 'logoUrl-error' : undefined} />
                  </div>
                  <FieldError id="logoUrl-error" message={fieldErrors.logoUrl} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruc">RUC / Tax ID</Label>
                  <Input id="ruc" value={form.ruc} onChange={(event) => updateField('ruc', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Tipo de negocio</Label>
                  <select id="businessType" value={form.businessType} onChange={(event) => updateField('businessType', event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sin especificar</option>
                    <option value="retail">Tienda minorista</option>
                    <option value="repair">Reparaciones técnicas</option>
                    <option value="wholesale">Mayorista / distribución</option>
                    <option value="service">Servicios profesionales</option>
                    <option value="mixed">Venta y servicios</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="whatsapp">WhatsApp comercial</Label>
                  <div className="relative">
                    <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="whatsapp" type="tel" value={form.whatsapp} onChange={(event) => updateField('whatsapp', event.target.value)} placeholder="+595 981 000 000" className="pl-9" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="social" className="m-0 space-y-6 p-5">
              <div>
                <h2 className="text-base font-semibold">Redes sociales</h2>
                <p className="mt-1 text-sm text-muted-foreground">Agregá solo los perfiles que uses públicamente.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground">instagram.com/</span>
                    <Input id="instagram" value={form.instagram} onChange={(event) => updateField('instagram', event.target.value)} className="border-0 focus-visible:ring-0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground">facebook.com/</span>
                    <Input id="facebook" value={form.facebook} onChange={(event) => updateField('facebook', event.target.value)} className="border-0 focus-visible:ring-0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground">tiktok.com/@</span>
                    <Input id="tiktok" value={form.tiktok} onChange={(event) => updateField('tiktok', event.target.value)} className="border-0 focus-visible:ring-0" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Lista de preparación</h2>
              <Badge variant="secondary">{stepsCompleted}/{steps.length}</Badge>
            </div>
            <ol className="mt-4 divide-y">
              {steps.map((step) => {
                const Icon = step.icon
                const done = stepProgress[step.doneKey]
                const external = step.href.startsWith(`/${organization.slug}/`)
                return (
                  <li key={step.title} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{step.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                          </div>
                          {done ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Listo</span> : <Circle className="mt-1 h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        {step.doneKey !== 'hasCompanyInfo' ? (
                          <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                            <Link href={step.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
                              {done ? 'Revisar' : 'Completar'}
                              {external ? <ExternalLink className="ml-1 h-3 w-3" /> : <ArrowRight className="ml-1 h-3 w-3" />}
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

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Vista pública</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir tienda pública">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {form.logoUrl ? <Image src={form.logoUrl} alt="Logo" width={160} height={40} unoptimized className="h-10 w-auto object-contain" /> : null}
              <p className="font-semibold">{form.displayName || organization.name}</p>
              <p className="text-muted-foreground">{form.address || 'Dirección pendiente'}{form.city ? `, ${form.city}` : ''}</p>
              <p className="text-muted-foreground">{form.phone || 'Teléfono pendiente'}</p>
              {form.email ? <p className="break-all text-muted-foreground">{form.email}</p> : null}
              <div className="border-t pt-2 text-xs text-muted-foreground">
                <p>{form.weekdays}</p>
                <p>{form.saturday}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur sm:sticky sm:inset-x-auto sm:bottom-3 sm:rounded-lg sm:border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium">
              {!isAdmin ? 'Solo administradores pueden guardar' : hasChanges ? 'Tenés cambios sin guardar' : isRevisit ? 'Todo está actualizado' : 'Listo para finalizar'}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {isRevisit ? 'Los cambios se reflejan también en Configuración.' : 'Después podrás cargar productos y revisar tu tienda.'}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            {isRevisit && hasChanges ? (
              <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => {
                setForm(initialCompanyInfo)
                const phone = parsePhone(initialCompanyInfo.phone)
                setCountryCode(phone.code)
                setLocalPhone(phone.local)
                setConfirmCurrencyChange(false)
                setError('')
              }}>
                Descartar
              </Button>
            ) : null}
            <Button onClick={completeOnboarding} disabled={saving || !canSubmit} className="min-w-0 flex-1 sm:min-w-[150px] sm:flex-none">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {saving ? 'Guardando...' : isRevisit ? 'Guardar cambios' : 'Finalizar configuración'}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
