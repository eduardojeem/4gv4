'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  Loader2,
  Mail,
  Settings,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Plan data
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: 'FREE', name: 'Free', price: 'Gratis',
    color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800',
    badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    features: ['2 usuarios', '1 sucursal', '50 productos', 'Trial 14 días'],
  },
  {
    id: 'BASIC', name: 'Basic', price: '70.000 Gs',
    color: 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20',
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',
    features: ['10 usuarios', '2 sucursales', '500 productos', 'Trial 14 días'],
  },
  {
    id: 'PRO', name: 'Pro', price: '150.000 Gs',
    color: 'border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/20',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300',
    popular: true,
    features: ['25 usuarios', '5 sucursales', '5.000 productos', 'Marketplace'],
  },
  {
    id: 'ENTERPRISE', name: 'Enterprise', price: '300.000 Gs',
    color: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
    features: ['Ilimitados', 'Ilimitadas', 'Ilimitados', 'Todo incluido'],
  },
]

const TIMEZONES = [
  { value: 'America/Asuncion', label: 'Paraguay (UTC-4)' },
  { value: 'America/Buenos_Aires', label: 'Argentina (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (UTC-3)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Santiago', label: 'Chile (UTC-4/3)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/New_York', label: 'New York (UTC-5/4)' },
]

// ---------------------------------------------------------------------------
// Slug availability hook
// ---------------------------------------------------------------------------

function useSlugCheck(slug: string) {
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!slug || slug.length < 2) { setState('idle'); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setState('idle'); return }

    setState('checking')
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/organizations?slug=${encodeURIComponent(slug)}`)
        const data = await res.json() as { available?: boolean }
        setState(data.available ? 'available' : 'taken')
      } catch {
        setState('idle')
      }
    }, 500)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [slug])

  return state
}

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
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

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ orgName: string; orgSlug: string; ownerCreated: boolean; ownerError: string | null } | null>(null)

  const slugStatus = useSlugCheck(slug)

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
    if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    if (!slug.trim()) errs.slug = 'El slug es obligatorio.'
    if (slug && !/^[a-z0-9-]+$/.test(slug)) errs.slug = 'Solo letras minúsculas, números y guiones.'
    if (slugStatus === 'taken') errs.slug = `El slug "${slug}" ya está en uso.`
    if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) errs.ownerEmail = 'Email inválido.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, plan, currency, timezone, owner_email: ownerEmail, owner_name: ownerName }),
      })
      const data = await res.json() as { success?: boolean; error?: string; organization?: { name: string; slug: string }; ownerCreated?: boolean; ownerError?: string | null }

      if (!res.ok || !data.success) {
        setErrors({ submit: data.error || 'Error al crear la organización.' })
        return
      }

      setResult({
        orgName: data.organization?.name ?? name,
        orgSlug: data.organization?.slug ?? slug,
        ownerCreated: data.ownerCreated ?? false,
        ownerError: data.ownerError ?? null,
      })
    } catch {
      setErrors({ submit: 'Error de red. Intentá de nuevo.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  if (result) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">
            Organización creada
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold">{result.orgName}</span> ya está activa en la plataforma.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-mono text-slate-500">
            /{result.orgSlug}
          </div>

          {ownerEmail && (
            <div className={cn(
              'mt-4 rounded-xl border p-3 text-sm',
              result.ownerCreated
                ? 'border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-emerald-950/10'
                : 'border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20'
            )}>
              {result.ownerCreated ? (
                <p className="text-emerald-700 dark:text-emerald-300">
                  ✓ Invitación enviada a <strong>{ownerEmail}</strong>
                </p>
              ) : (
                <p className="text-orange-700 dark:text-orange-300">
                  ⚠ No se pudo invitar al owner: {result.ownerError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild className="gap-2">
            <Link href="/superadmin/organizations">
              <Building2 className="h-4 w-4" />
              Ver todas las organizaciones
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => {
            setResult(null)
            setName(''); setSlug(''); setSlugEdited(false)
            setOwnerEmail(''); setOwnerName(''); setPlan('FREE')
          }}>
            Crear otra organización
          </Button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
            <Link href="/superadmin/organizations">
              <ArrowLeft className="h-3.5 w-3.5" />
              Organizaciones
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Nueva organización</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Alta asistida de tenant — crea empresa, configura el plan inicial y opcionalmente invita al owner.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Trial de 14 días incluido en todos los planes
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

          {/* Left col: main form */}
          <div className="space-y-6">

            {/* Empresa */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">Datos de la empresa</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Nombre de la organización" required error={errors.name}>
                  <Input
                    placeholder="Ej: 4G Celulares Paraguay"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={errors.name ? 'border-red-300' : ''}
                  />
                </Field>

                <Field
                  label="Slug (subdominio)"
                  required
                  error={errors.slug}
                  hint="URL pública: ejemplo.com/{slug}/inicio — solo letras minúsculas, números y guiones"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">/</span>
                    <Input
                      className={cn('pl-6', errors.slug ? 'border-red-300' : slugStatus === 'available' ? 'border-emerald-300' : slugStatus === 'taken' ? 'border-red-300' : '')}
                      placeholder="4g-celulares-py"
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {slugStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {slugStatus === 'taken' && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  {slugStatus === 'available' && <p className="text-xs text-emerald-600 dark:text-emerald-400">Slug disponible ✓</p>}
                  {slugStatus === 'taken' && <p className="text-xs text-red-500">Slug en uso — elegí otro.</p>}
                </Field>
              </CardContent>
            </Card>

            {/* Config */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <Settings className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">Configuración inicial</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Moneda" hint="Moneda por defecto para ventas y productos">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="PYG">PYG — Guaraní paraguayo</option>
                    <option value="USD">USD — Dólar americano</option>
                    <option value="ARS">ARS — Peso argentino</option>
                    <option value="BRL">BRL — Real brasileño</option>
                  </select>
                </Field>

                <Field label="Zona horaria">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>

            {/* Owner */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-400">
                      <User className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">Owner de la organización</CardTitle>
                  </div>
                  <Badge variant="outline" className="rounded-full text-xs text-slate-400">Opcional</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Si ingresás un email, se enviará una invitación al usuario para que complete el acceso.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email del owner" error={errors.ownerEmail}>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="owner@empresa.com"
                        className={cn('pl-9', errors.ownerEmail ? 'border-red-300' : '')}
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Nombre del owner" hint="Opcional — para personalizar la invitación">
                    <Input
                      placeholder="Nombre completo"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Submit error */}
            {errors.submit && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting || slugStatus === 'taken' || slugStatus === 'checking'} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isSubmitting ? 'Creando organización...' : 'Crear organización'}
              </Button>
              <Button asChild variant="outline" type="button">
                <Link href="/superadmin/organizations">Cancelar</Link>
              </Button>
            </div>
          </div>

          {/* Right col: plan selector */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Plan inicial</h2>
            </div>

            <div className="space-y-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    'relative w-full rounded-xl border p-4 text-left transition-all',
                    p.color,
                    plan === p.id ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : 'hover:shadow-sm'
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      Popular
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {plan === p.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-50">{p.name}</span>
                          <Badge variant="outline" className={cn('rounded-full text-[10px]', p.badge)}>{p.id}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.price}/mes</p>
                      </div>
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-xs text-slate-500">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Resumen de creación</p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Organización con plan {plan}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Suscripción trialing (14 días)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Sucursal principal creada
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Settings con {currency} / {timezone.split('/')[1] ?? timezone}
                </li>
                <li className="flex items-center gap-2">
                  {ownerEmail
                    ? <><Mail className="h-3.5 w-3.5 text-blue-500" /> Invitación a {ownerEmail}</>
                    : <><span className="h-3.5 w-3.5 rounded-full border border-dashed" /> Sin owner (asignar después)</>
                  }
                </li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
