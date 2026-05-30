'use client'

import { useState } from 'react'
import type { ElementType } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, CheckCircle2, ChevronDown, ExternalLink, Globe, Loader2, Mail, MapPin, MessageCircle, Package, Phone, Settings, ShoppingCart, Store, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type OnboardingStep = {
  title: string
  description: string
  href: string
  icon: ElementType
  accent: string
  doneKey: keyof StepProgress
}

type StepProgress = {
  hasCompanyInfo: boolean
  hasProducts: boolean
  hasPublicStore: boolean
  hasTeam: boolean
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
}

type CompanyInfoForm = {
  displayName: string
  currency: string
  timezone: string
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

function buildSteps(slug: string): OnboardingStep[] {
  return [
    {
      title: 'Configura tu negocio',
      description: 'Revisa datos publicos, moneda, zona horaria y datos visibles para clientes.',
      href: '/admin/settings',
      icon: Building2,
      accent: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-800',
      doneKey: 'hasCompanyInfo',
    },
    {
      title: 'Carga productos',
      description: 'Agrega inventario, precios, categorias e imagenes para activar ventas.',
      href: '/dashboard/products',
      icon: Package,
      accent: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800',
      doneKey: 'hasProducts',
    },
    {
      title: 'Prepara tu tienda publica',
      description: 'Abre la pagina publica de la empresa y valida que el carrito este listo.',
      href: `/${slug}/inicio`,
      icon: Store,
      accent: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800',
      doneKey: 'hasPublicStore',
    },
    {
      title: 'Invita tu equipo',
      description: 'Suma vendedores o tecnicos para operar el negocio con permisos separados.',
      href: '/admin/users',
      icon: Users,
      accent: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
      doneKey: 'hasTeam',
    },
  ]
}

const COUNTRY_CODES = [
  { flag: '🇵🇾', name: 'Paraguay',   code: '+595' },
  { flag: '🇦🇷', name: 'Argentina',  code: '+54'  },
  { flag: '🇧🇷', name: 'Brasil',     code: '+55'  },
  { flag: '🇺🇾', name: 'Uruguay',    code: '+598' },
  { flag: '🇧🇴', name: 'Bolivia',    code: '+591' },
  { flag: '🇨🇱', name: 'Chile',      code: '+56'  },
  { flag: '🇨🇴', name: 'Colombia',   code: '+57'  },
  { flag: '🇵🇪', name: 'Perú',       code: '+51'  },
  { flag: '🇻🇪', name: 'Venezuela',  code: '+58'  },
  { flag: '🇲🇽', name: 'México',     code: '+52'  },
  { flag: '🇺🇸', name: 'EE.UU.',     code: '+1'   },
  { flag: '🇪🇸', name: 'España',     code: '+34'  },
]

function parsePhone(full: string): { code: string; local: string } {
  for (const c of COUNTRY_CODES) {
    if (full.startsWith(c.code)) {
      return { code: c.code, local: full.slice(c.code.length).trimStart() }
    }
  }
  // Si ya tiene un + no reconocido, separarlo igual
  if (full.startsWith('+')) {
    const space = full.indexOf(' ')
    if (space > 0) return { code: full.slice(0, space), local: full.slice(space + 1) }
  }
  return { code: '+595', local: full }
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

export function OnboardingClient({ organization, subscription, completedAt, stepProgress, initialCompanyInfo }: OnboardingClientProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CompanyInfoForm>(initialCompanyInfo)
  const [error, setError] = useState('')

  // Estado separado para selector de código de país
  const parsedPhone = parsePhone(initialCompanyInfo.phone)
  const [countryCode, setCountryCode] = useState(parsedPhone.code)
  const [localPhone, setLocalPhone] = useState(parsedPhone.local)

  const handlePhoneChange = (code: string, local: string) => {
    const combined = local.trim() ? `${code} ${local.trim()}` : ''
    setForm(f => ({ ...f, phone: combined }))
  }

  const publicUrl = `/${organization.slug}/inicio`
  const trackUrl = `/${organization.slug}/track`
  const steps = buildSteps(organization.slug)
  const stepsCompleted = steps.filter(s => stepProgress[s.doneKey]).length
  const isRevisit = Boolean(completedAt)

  const updateField = (field: keyof CompanyInfoForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const completeOnboarding = async () => {
    const requiredFields: Array<[keyof CompanyInfoForm, string]> = [
      ['displayName', 'Nombre publico'],
      ['phone', 'Telefono'],
      ['address', 'Direccion'],
      ['city', 'Ciudad'],
    ]
    const missing = requiredFields.find(([field]) => !form[field].trim())

    if (missing) {
      setError(`${missing[1]} es requerido para completar el onboarding.`)
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo finalizar el onboarding')
      }

      toast.success('Onboarding finalizado')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo finalizar el onboarding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-200">
                Onboarding SaaS
              </Badge>
              <Badge variant="outline">Plan {subscription?.plan || organization.plan}</Badge>
              {completedAt
                ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Configuracion completada</Badge>
                : <Badge variant="secondary">{stepsCompleted}/{steps.length} pasos listos</Badge>
              }
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Bienvenido a {organization.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Estos pasos dejan lista la empresa para vender, recibir pedidos desde la tienda publica y permitir que los clientes rastreen sus ordenes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/products">
                  Cargar productos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={publicUrl}>
                  Ver tienda
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Prueba activa</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">
                  Hasta {formatTrialDate(subscription?.trialEndsAt ?? null)}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Empresa</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{organization.slug}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Suscripcion</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{subscription?.status || 'trialing'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-800">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">Informacion de la empresa</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Estos datos se usan en la tienda publica, pedidos, rastreo y sucursal principal.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="displayName">Nombre publico</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) => updateField('displayName', event.target.value)}
                placeholder="4G Celulares"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono / WhatsApp</Label>
              <div className="flex gap-0 overflow-hidden rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {/* Selector de código de país */}
                <div className="relative flex shrink-0 items-center border-r border-input bg-muted/40">
                  <select
                    aria-label="Código de país"
                    value={countryCode}
                    onChange={e => {
                      setCountryCode(e.target.value)
                      handlePhoneChange(e.target.value, localPhone)
                    }}
                    className="h-10 appearance-none bg-transparent py-2 pl-3 pr-7 text-sm font-medium text-foreground focus:outline-none"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                {/* Número local */}
                <div className="relative flex-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="phone"
                    type="tel"
                    value={localPhone}
                    onChange={e => {
                      setLocalPhone(e.target.value)
                      handlePhoneChange(countryCode, e.target.value)
                    }}
                    placeholder="981 000 000"
                    className="h-10 w-full bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
              {form.phone && (
                <p className="text-xs text-muted-foreground">Se guardará como: {form.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo publico</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="ventas@empresa.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Direccion</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  placeholder="Av. principal 123"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                placeholder="Asuncion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                value={form.currency}
                onChange={(event) => updateField('currency', event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="PYG">Guarani paraguayo (PYG)</option>
                <option value="USD">Dolar estadounidense (USD)</option>
                <option value="ARS">Peso argentino (ARS)</option>
                <option value="BRL">Real brasileno (BRL)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <select
                id="timezone"
                value={form.timezone}
                onChange={(event) => updateField('timezone', event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="America/Asuncion">America/Asuncion</option>
                <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekdays">Horario semanal</Label>
              <Input
                id="weekdays"
                value={form.weekdays}
                onChange={(event) => updateField('weekdays', event.target.value)}
                placeholder="Lunes a viernes, 08:00 a 18:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saturday">Horario sabado</Label>
              <Input
                id="saturday"
                value={form.saturday}
                onChange={(event) => updateField('saturday', event.target.value)}
                placeholder="Sabado, 08:00 a 12:00"
              />
            </div>

            {/* Additional info divider */}
            <div className="sm:col-span-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Informacion adicional</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logoUrl">Logo URL <span className="text-xs font-normal text-muted-foreground">— opcional</span></Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="logoUrl"
                  type="url"
                  value={form.logoUrl}
                  onChange={(event) => updateField('logoUrl', event.target.value)}
                  placeholder="https://mi-empresa.com/logo.png"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruc">RUC / Tax ID <span className="text-xs font-normal text-muted-foreground">— opcional</span></Label>
              <Input
                id="ruc"
                value={form.ruc}
                onChange={(event) => updateField('ruc', event.target.value)}
                placeholder="12345678-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Tipo de negocio</Label>
              <select
                id="businessType"
                value={form.businessType}
                onChange={(event) => updateField('businessType', event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Seleccionar...</option>
                <option value="retail">Minorista (tienda fisica)</option>
                <option value="repair">Reparaciones tecnicas</option>
                <option value="wholesale">Mayorista / distribucion</option>
                <option value="service">Servicios profesionales</option>
                <option value="mixed">Mixto (venta + servicio)</option>
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="whatsapp">WhatsApp <span className="text-xs font-normal text-muted-foreground">— opcional, con codigo de pais</span></Label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={(event) => updateField('whatsapp', event.target.value)}
                  placeholder="+595 9XX XXX XXX"
                  className="pl-9"
                />
              </div>
              {form.whatsapp && (
                <p className="text-xs text-muted-foreground">Enlace: wa.me/{form.whatsapp.replace(/\D/g, '')}</p>
              )}
            </div>

            {/* Social media */}
            <div className="sm:col-span-2 pt-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Redes sociales <span className="text-xs font-normal text-muted-foreground">— opcional</span></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <div className="flex overflow-hidden rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-input bg-muted/40 px-3 text-xs text-muted-foreground">instagram.com/</span>
                <Input
                  id="instagram"
                  value={form.instagram}
                  onChange={(event) => updateField('instagram', event.target.value)}
                  placeholder="tu_usuario"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <div className="flex overflow-hidden rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-input bg-muted/40 px-3 text-xs text-muted-foreground">facebook.com/</span>
                <Input
                  id="facebook"
                  value={form.facebook}
                  onChange={(event) => updateField('facebook', event.target.value)}
                  placeholder="tu_pagina"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiktok">TikTok</Label>
              <div className="flex overflow-hidden rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-input bg-muted/40 px-3 text-xs text-muted-foreground">tiktok.com/@</span>
                <Input
                  id="tiktok"
                  value={form.tiktok}
                  onChange={(event) => updateField('tiktok', event.target.value)}
                  placeholder="tu_usuario"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="font-semibold text-slate-950 dark:text-white">Vista previa publica</h3>
          <div className="mt-4 space-y-3 text-sm">
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo" className="h-10 w-auto rounded object-contain" />
            )}
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{form.displayName || organization.name}</p>
            {form.businessType && (
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{form.businessType}</p>
            )}
            <p className="text-slate-600 dark:text-slate-300">{form.address || 'Direccion pendiente'}{form.city ? `, ${form.city}` : ''}</p>
            <p className="text-slate-600 dark:text-slate-300">{form.phone || 'Telefono pendiente'}</p>
            {form.whatsapp && (
              <p className="text-slate-600 dark:text-slate-300">WhatsApp: {form.whatsapp}</p>
            )}
            {form.email && <p className="text-slate-600 dark:text-slate-300">{form.email}</p>}
            {form.ruc && <p className="text-xs text-slate-500 dark:text-slate-400">RUC: {form.ruc}</p>}
            <div className="rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
              <p>{form.weekdays}</p>
              <p>{form.saturday}</p>
            </div>
            {(form.instagram || form.facebook || form.tiktok) && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                {form.instagram && <span>@{form.instagram}</span>}
                {form.facebook && <span>fb/{form.facebook}</span>}
                {form.tiktok && <span>@{form.tiktok}</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon
          const done = stepProgress[step.doneKey]
          const isExternal = step.href.startsWith('/')  && !step.href.startsWith('/admin') && !step.href.startsWith('/dashboard')

          return (
            <Link
              key={step.title}
              href={step.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="group block"
            >
              <Card className={`h-full transition-all hover:-translate-y-0.5 hover:shadow-md ${done ? 'border-emerald-200 dark:border-emerald-800' : ''}`}>
                <CardContent className="flex h-full gap-4 p-5">
                  <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${step.accent}`}>
                    <Icon className="h-5 w-5" />
                    {done && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={`font-semibold group-hover:text-cyan-700 dark:group-hover:text-cyan-300 ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-950 dark:text-white'}`}>
                        {step.title}
                      </h2>
                      {isExternal && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {step.description}
                    </p>
                    {done && (
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">Listo</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex gap-3">
          <Settings className="mt-0.5 h-5 w-5 text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">Ordenes y rastreo sincronizados</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Los pedidos creados desde la tienda se gestionan en el dashboard y el cliente puede ver cambios en {trackUrl}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/orders">Ver pedidos</Link>
          </Button>
          <Button onClick={completeOnboarding} disabled={saving} variant={isRevisit ? 'outline' : 'default'}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isRevisit ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Actualizar datos
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar configuracion
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
