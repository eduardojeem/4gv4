'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock,
  Copy,
  Globe,
  Loader2,
  Mail,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Store,
  User,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { normalizeTenantSlug, validateTenantSlug } from '@/lib/saas/reserved-slugs'
import {
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  ORGANIZATION_CURRENCIES,
  ORGANIZATION_NAME_MAX,
  ORGANIZATION_TIMEZONES,
  OWNER_EMAIL_PATTERN,
  describePlanLimit,
  sanitizeSlugTyping,
  timezoneOffsetLabel,
  trialEndDate,
  type CreateOrganizationField,
  type OwnerLookup,
  type OwnerOutcome,
  type PlanOption,
  type SlugAvailability,
} from '@/lib/superadmin/create-organization'

// ── Consultas mientras se completa el formulario ────────────────────────────

type SlugState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string; suggestion: string | null }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; message: string; suggestion: string | null }
  | { status: 'error' }

/**
 * Formato y reservas se validan en el navegador, sin red, con la misma funcion
 * que usa el servidor. Solo la disponibilidad se consulta. Un fallo de la
 * consulta es «no se pudo verificar», nunca «disponible».
 */
function useSlugAvailability(slug: string): SlugState {
  const local = slug ? validateTenantSlug(slug) : null
  const localOk = local?.ok === true
  const [remote, setRemote] = useState<{ slug: string; state: SlugState } | null>(null)

  useEffect(() => {
    if (!localOk) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/organizations?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setRemote({ slug, state: { status: 'error' } })
          return
        }
        const data = (await res.json()) as SlugAvailability
        setRemote({
          slug,
          state: data.available
            ? { status: 'available' }
            : {
                status: 'unavailable',
                message: data.message ?? 'Esa dirección no está disponible.',
                suggestion: data.suggestion ?? null,
              },
        })
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setRemote({ slug, state: { status: 'error' } })
      }
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [slug, localOk])

  if (!slug) return { status: 'idle' }
  if (local && local.ok === false) {
    return {
      status: 'invalid',
      message: local.message,
      suggestion: local.reason === 'reserved' ? `${slug}-tienda` : null,
    }
  }
  return remote?.slug === slug ? remote.state : { status: 'checking' }
}

type OwnerState =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'checking' }
  | { status: 'done'; lookup: OwnerLookup }
  | { status: 'error' }

function useOwnerLookup(rawEmail: string): OwnerState {
  const email = rawEmail.trim().toLowerCase()
  const valid = OWNER_EMAIL_PATTERN.test(email)
  const [remote, setRemote] = useState<{ email: string; state: OwnerState } | null>(null)

  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/organizations?owner_email=${encodeURIComponent(email)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setRemote({ email, state: { status: 'error' } })
          return
        }
        setRemote({ email, state: { status: 'done', lookup: (await res.json()) as OwnerLookup } })
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setRemote({ email, state: { status: 'error' } })
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [email, valid])

  if (!email) return { status: 'empty' }
  if (!valid) return { status: 'invalid' }
  return remote?.email === email ? remote.state : { status: 'checking' }
}

// ── Formato ─────────────────────────────────────────────────────────────────

const formatGs = (value: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value)

/**
 * Con zona horaria explicita. Sin ella, el servidor formatea en la suya (UTC en
 * produccion) y el navegador en la del usuario: entre las 21:00 y las 24:00 de
 * Paraguay el HTML del servidor traia el dia siguiente y la hidratacion no
 * coincidia.
 */
const formatDate = (value: Date | string, timeZone: string) =>
  new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric', timeZone }).format(
    new Date(value)
  )

const LIMIT_KEYS = [
  { key: 'users', label: 'Colaboradores' },
  { key: 'branches', label: 'Sucursales' },
  { key: 'products', label: 'Productos' },
] as const

function PlanLimitText({ limits, limitKey }: { limits: Record<string, unknown> | null; limitKey: string }) {
  const d = describePlanLimit(limits, limitKey)
  if (d.kind === 'number') return <>{d.value.toLocaleString('es-PY')}</>
  if (d.kind === 'unlimited') return <>Sin tope</>
  return <span className="font-normal text-muted-foreground">No definido</span>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-red-600 dark:text-red-400">{message}</p>
}

// ── Aviso sobre el propietario ──────────────────────────────────────────────

function OwnerNotice({ state }: { state: OwnerState }) {
  if (state.status === 'empty') {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Sin propietario, nadie puede entrar a esta organización hasta que le asignes uno.
      </p>
    )
  }
  if (state.status === 'invalid') return null
  if (state.status === 'checking') {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verificando si ya tiene cuenta…
      </p>
    )
  }
  if (state.status === 'error') {
    return <p className="text-xs text-amber-700 dark:text-amber-400">No se pudo verificar el correo. Se confirma al crear.</p>
  }

  const { lookup } = state

  if (lookup.exists && lookup.suspended) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Esta cuenta está suspendida: no puede ser propietaria. Reactivala primero o usá otro correo.
      </p>
    )
  }

  if (lookup.exists) {
    return (
      <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
        <p className="flex items-start gap-2">
          <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ya tiene una cuenta
            {lookup.organizations > 0
              ? ` y forma parte de ${lookup.organizations} ${lookup.organizations === 1 ? 'organización' : 'organizaciones'}`
              : ''}
            . Se la asigna como propietaria <strong>sin enviar correo</strong>: entra con su contraseña de siempre.
          </span>
        </p>
        {lookup.superAdmin && (
          <p className="flex items-start gap-2 pl-5.5 text-sky-800 dark:text-sky-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Es superadmin y conserva su acceso a este panel.
          </p>
        )}
      </div>
    )
  }

  if (lookup.lookupIncomplete) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        No se pudo confirmar si ya tiene cuenta. Si creás ahora, la organización puede quedar sin propietario.
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground">
      <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
      No tiene cuenta. Se le envía una invitación con un enlace para crear su contraseña y completar la
      configuración del negocio.
    </p>
  )
}

// ── Asignar propietario después ─────────────────────────────────────────────

function AssignOwnerForm({
  organizationId,
  onAssigned,
}: {
  organizationId: string
  onAssigned: (outcome: OwnerOutcome) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownerState = useOwnerLookup(email)
  const bloqueado =
    sending ||
    !OWNER_EMAIL_PATTERN.test(email.trim().toLowerCase()) ||
    (ownerState.status === 'done' && ownerState.lookup.suspended)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_email: email.trim(), owner_name: name.trim() || undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as { owner?: OwnerOutcome; error?: string }
      if (!res.ok || !data.owner) {
        setError(data.error ?? 'No se pudo asignar el propietario.')
        return
      }
      onAssigned(data.owner)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-3 space-y-3 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="retry-owner-email" className="text-xs font-semibold">
            Correo del propietario
          </Label>
          <Input
            id="retry-owner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="propietario@empresa.com"
            className="h-9 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="retry-owner-name" className="text-xs font-semibold">
            Nombre (opcional)
          </Label>
          <Input
            id="retry-owner-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Pérez"
            className="h-9 text-xs"
          />
        </div>
      </div>
      {email && <OwnerNotice state={ownerState} />}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" size="sm" disabled={bloqueado} className="h-8 gap-1.5 text-xs font-bold">
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Asignar propietario
      </Button>
    </form>
  )
}

// ── Pantalla de resultado ───────────────────────────────────────────────────

interface CreatedResult {
  organization: { id: string; name: string; slug: string; plan: string }
  subscription: { status: string; trialDays: number; trialEndsAt: string }
  owner: OwnerOutcome
}

function OwnerResult({ result, onOwner }: { result: CreatedResult; onOwner: (o: OwnerOutcome) => void }) {
  const { owner } = result

  if (owner.status === 'invited') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-left text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        <Mail className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Se envió una invitación a <strong>{owner.email}</strong>. El enlace le permite crear su contraseña y lo lleva
          a la configuración del negocio.
        </p>
      </div>
    )
  }

  if (owner.status === 'assigned_existing') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-left text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>{owner.email}</strong> ya tenía cuenta y quedó como propietaria. <strong>No se le envió correo</strong>:
          avisale que ya puede entrar con su contraseña.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-left text-xs',
        owner.status === 'failed'
          ? 'border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          : 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
      )}
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {owner.status === 'failed'
          ? `No se pudo asignar a ${owner.email}: ${owner.message}`
          : 'La organización quedó sin propietario: nadie puede entrar todavía.'}
      </p>
      <AssignOwnerForm organizationId={result.organization.id} onAssigned={onOwner} />
    </div>
  )
}

// ── Formulario ──────────────────────────────────────────────────────────────

export function CreateOrganizationForm({ plans, plansFailed }: { plans: PlanOption[]; plansFailed: boolean }) {
  const planPorDefecto = plans.find((p) => p.code === 'FREE')?.code ?? plans[0]?.code ?? ''

  const [name, setName] = useState('')
  const [slugInput, setSlugInput] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [plan, setPlan] = useState(planPorDefecto)
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<CreateOrganizationField | 'submit', string>>>({})
  const [result, setResult] = useState<CreatedResult | null>(null)

  // El subdominio se deriva del nombre hasta que alguien lo edita a mano.
  const slug = slugEdited ? slugInput : normalizeTenantSlug(name)
  const slugState = useSlugAvailability(slug)
  const ownerState = useOwnerLookup(ownerEmail)
  const planElegido = plans.find((p) => p.code === plan) ?? null

  function reiniciar() {
    setName('')
    setSlugInput('')
    setSlugEdited(false)
    setPlan(planPorDefecto)
    setCurrency(DEFAULT_CURRENCY)
    setTimezone(DEFAULT_TIMEZONE)
    setOwnerEmail('')
    setOwnerName('')
    setErrors({})
    setResult(null)
  }

  const emailInvalido = ownerEmail.trim() !== '' && ownerState.status === 'invalid'
  const ownerSuspendido = ownerState.status === 'done' && ownerState.lookup.suspended

  // Por que no se puede crear todavia, dicho en una frase.
  const bloqueo = submitting
    ? null
    : plans.length === 0
      ? 'No hay planes activos para asignar.'
      : !name.trim()
        ? 'Falta el nombre de la organización.'
        : slugState.status === 'checking'
          ? 'Verificando la dirección…'
          : slugState.status === 'error'
            ? 'No se pudo verificar la dirección.'
            : slugState.status !== 'available'
              ? 'La dirección no está disponible.'
              : !planElegido
                ? 'Elegí un plan.'
                : emailInvalido
                  ? 'El correo del propietario no es válido.'
                  : ownerSuspendido
                    ? 'La cuenta del propietario está suspendida.'
                    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (bloqueo) return
    setSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          plan,
          currency,
          timezone,
          owner_email: ownerEmail.trim() || undefined,
          owner_name: ownerName.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<CreatedResult> & {
        error?: string
        field?: CreateOrganizationField
      }

      if (!res.ok || !data.organization || !data.owner || !data.subscription) {
        const message = data.error ?? 'No se pudo crear la organización.'
        setErrors(data.field ? { [data.field]: message } : { submit: message })
        toast.error(message)
        return
      }

      toast.success('Organización creada')
      setResult(data as CreatedResult)
    } catch {
      setErrors({ submit: 'Error de conexión. Verificá la red e intentá de nuevo.' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Resultado ─────────────────────────────────────────────────────────────

  if (result) {
    const { organization, subscription } = result
    return (
      <div className="mx-auto max-w-2xl space-y-6 pt-4">
        <Card className="rounded-2xl border border-border bg-card">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Organización creada</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <strong className="text-foreground">{organization.name}</strong> · plan {organization.plan}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/${organization.slug}/inicio`)
                    toast.success('Dirección copiada')
                  }}
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-violet-600 hover:underline dark:text-violet-400"
                >
                  /{organization.slug}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Lo que la pantalla anterior afirmaba sin serlo: «activa y lista
                para operar». Esta en prueba, sin configurar y sin publicar. */}
            <ul className="space-y-2 rounded-xl border border-border p-4 text-xs">
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span>
                  {subscription.trialDays > 0
                    ? `En prueba ${subscription.trialDays} días, hasta el ${formatDate(subscription.trialEndsAt, timezone)}.`
                    : 'El plan no tiene período de prueba.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>Configuración inicial pendiente: la completa el propietario la primera vez que entra.</span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>La tienda pública todavía no está publicada: nadie puede verla hasta que el propietario la publique.</span>
              </li>
            </ul>

            <OwnerResult result={result} onOwner={(owner) => setResult({ ...result, owner })} />

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button asChild className="gap-1.5 text-xs font-bold">
                <Link href={`/superadmin/organizations/${organization.slug}`}>
                  <Building2 className="h-4 w-4" />
                  Ver expediente
                </Link>
              </Button>
              <Button variant="outline" className="gap-1.5 text-xs font-bold" onClick={reiniciar}>
                <RotateCcw className="h-4 w-4" />
                Crear otra
              </Button>
              <Button asChild variant="ghost" className="text-xs font-bold">
                <Link href="/superadmin/organizations">Ir al directorio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva organización</h1>
          <p className="text-sm text-muted-foreground">
            Crea la empresa, su suscripción de prueba y su sucursal principal, y le asigna un propietario.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit gap-1.5 text-xs font-bold">
          <Link href="/superadmin/organizations">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
        </Button>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {/* Identidad */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  La empresa
                </CardTitle>
                <CardDescription className="text-xs">
                  El nombre comercial y la dirección de su tienda pública.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="text-xs font-semibold">
                    Nombre de la empresa <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="org-name"
                    placeholder="Ej: HCA Celular"
                    value={name}
                    maxLength={ORGANIZATION_NAME_MAX}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    className="h-10 text-sm"
                  />
                  <FieldError message={errors.name} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="org-slug" className="text-xs font-semibold">
                      Dirección de la tienda <span className="text-red-500">*</span>
                    </Label>
                    {slugEdited && (
                      <button
                        type="button"
                        onClick={() => {
                          setSlugEdited(false)
                          setSlugInput('')
                        }}
                        className="text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
                      >
                        Volver a generarla desde el nombre
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                      /
                    </span>
                    <Input
                      id="org-slug"
                      placeholder="hca-celular"
                      value={slug}
                      onChange={(e) => {
                        setSlugEdited(true)
                        setSlugInput(sanitizeSlugTyping(e.target.value))
                      }}
                      aria-invalid={slugState.status === 'invalid' || slugState.status === 'unavailable'}
                      aria-describedby="org-slug-status"
                      className={cn(
                        'h-10 pl-6 pr-9 font-mono text-sm',
                        slugState.status === 'available' && 'border-emerald-400',
                        (slugState.status === 'invalid' || slugState.status === 'unavailable') && 'border-red-400'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugState.status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {slugState.status === 'available' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {(slugState.status === 'invalid' || slugState.status === 'unavailable') && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </span>
                  </div>

                  <div id="org-slug-status" aria-live="polite" className="min-h-[1.25rem] text-xs">
                    {slugState.status === 'idle' && (
                      <span className="text-muted-foreground">Se genera sola a partir del nombre.</span>
                    )}
                    {slugState.status === 'available' && (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Disponible</span>
                    )}
                    {slugState.status === 'error' && (
                      <span className="text-amber-700 dark:text-amber-400">No se pudo verificar. Se confirma al crear.</span>
                    )}
                    {(slugState.status === 'invalid' || slugState.status === 'unavailable') && (
                      <span className="text-red-600 dark:text-red-400">
                        {slugState.message}
                        {slugState.suggestion && (
                          <>
                            {' '}
                            <button
                              type="button"
                              onClick={() => {
                                setSlugEdited(true)
                                setSlugInput(slugState.suggestion!)
                              }}
                              className="font-semibold text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                            >
                              Usar «{slugState.suggestion}»
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <FieldError message={errors.slug} />
                </div>
              </CardContent>
            </Card>

            {/* Plan */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Store className="h-4 w-4 text-violet-500" />
                  Plan
                </CardTitle>
                <CardDescription className="text-xs">
                  Los topes que se muestran son los que el sistema aplica al crear cada recurso.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                {plans.length === 0 ? (
                  <p className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {plansFailed
                      ? 'No se pudieron cargar los planes. Recargá la página.'
                      : 'No hay planes activos. Activá al menos uno en Planes antes de crear una organización.'}
                  </p>
                ) : (
                  <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
                    {plans.map((p) => {
                      const elegido = plan === p.code
                      return (
                        <button
                          key={p.code}
                          type="button"
                          role="radio"
                          aria-checked={elegido}
                          aria-label={`Plan ${p.name}, ${p.price > 0 ? `${formatGs(p.price)} por mes` : 'gratis'}`}
                          onClick={() => setPlan(p.code)}
                          className={cn(
                            'flex flex-col rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                            elegido
                              ? 'border-violet-500 bg-violet-50/60 ring-1 ring-violet-500 dark:bg-violet-950/30'
                              : 'border-border hover:border-violet-300 hover:bg-muted/40'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-foreground">{p.name}</p>
                              <p className="mt-0.5 text-xs font-semibold text-foreground">
                                {p.price > 0 ? (
                                  <>
                                    {formatGs(p.price)}
                                    <span className="font-normal text-muted-foreground"> / mes</span>
                                  </>
                                ) : (
                                  'Gratis'
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-bold">
                                {p.code}
                              </Badge>
                              {p.isPopular && (
                                <Badge className="bg-violet-600 px-1.5 py-0 text-[9px] font-bold text-white">
                                  Popular
                                </Badge>
                              )}
                            </div>
                          </div>

                          <dl className="mt-3 space-y-1 border-t border-border/60 pt-2.5 text-[11px]">
                            {LIMIT_KEYS.map((item) => (
                              <div key={item.key} className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">{item.label}</dt>
                                <dd className="font-semibold tabular-nums text-foreground">
                                  <PlanLimitText limits={p.limits} limitKey={item.key} />
                                </dd>
                              </div>
                            ))}
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">Prueba</dt>
                              <dd className="font-semibold text-foreground">
                                {p.trialDays > 0 ? `${p.trialDays} días` : 'Sin prueba'}
                              </dd>
                            </div>
                            {p.moduleCount !== null && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Módulos</dt>
                                <dd className="font-semibold tabular-nums text-foreground">{p.moduleCount}</dd>
                              </div>
                            )}
                          </dl>

                          {p.limitsSource !== 'technical' && (
                            <p className="mt-2 text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                              {p.limitsSource === 'missing'
                                ? 'Este plan no tiene límites cargados: el sistema le aplicaría los de Free.'
                                : 'Límites de la ficha comercial: el plan no está en la tabla técnica.'}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                <FieldError message={errors.plan} />
              </CardContent>
            </Card>

            {/* Region */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <MapPin className="h-4 w-4 text-violet-500" />
                  Moneda y zona horaria
                </CardTitle>
                <CardDescription className="text-xs">
                  Con qué moneda vende y a qué hora cierran sus reportes del día.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-currency" className="text-xs font-semibold">
                    Moneda
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="org-currency" className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANIZATION_CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-xs">
                          {c.symbol} · {c.label} ({c.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.currency} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org-timezone" className="text-xs font-semibold">
                    Zona horaria
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="org-timezone" className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANIZATION_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value} className="text-xs">
                          {tz.country}
                          {timezoneOffsetLabel(tz.value) ? ` · ${timezoneOffsetLabel(tz.value)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.timezone} />
                </div>
              </CardContent>
            </Card>

            {/* Propietario */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <User className="h-4 w-4 text-violet-500" />
                  Propietario
                </CardTitle>
                <CardDescription className="text-xs">
                  Quien administra la cuenta. Podés dejarlo para después, pero hasta entonces nadie puede entrar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-email" className="text-xs font-semibold">
                      Correo del propietario
                    </Label>
                    <Input
                      id="owner-email"
                      type="email"
                      placeholder="propietario@empresa.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      aria-invalid={emailInvalido}
                      className="h-10 text-xs"
                    />
                    {emailInvalido && <FieldError message="El correo no es válido." />}
                    <FieldError message={errors.ownerEmail} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-name" className="text-xs font-semibold">
                      Nombre del propietario
                    </Label>
                    <Input
                      id="owner-name"
                      placeholder="Ej: Juan Pérez"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="h-10 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Solo se usa si no tiene cuenta. Si ya tiene, se conserva su nombre.
                    </p>
                  </div>
                </div>
                <OwnerNotice state={ownerState} />
              </CardContent>
            </Card>

            {errors.submit && (
              <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errors.submit}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={Boolean(bloqueo) || submitting} className="h-10 gap-2 px-5 text-xs font-bold">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {submitting ? 'Creando…' : 'Crear organización'}
              </Button>
              <Button asChild variant="ghost" className="h-10 text-xs font-bold">
                <Link href="/superadmin/organizations">Cancelar</Link>
              </Button>
              {bloqueo && <span className="text-xs text-muted-foreground">{bloqueo}</span>}
            </div>
          </div>

          {/* Lo que se va a crear. La vista previa anterior prometia un
              «esquema de base de datos aislado» —es un esquema compartido con
              RLS—, una sucursal «Casa Central» —se llama «Sucursal
              principal»— y «catálogo y POS listos para operar», con la
              configuración inicial todavía pendiente. */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-sm font-bold">Qué se va a crear</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5 text-xs">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
                    {(name.trim() || '··').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{name.trim() || 'Sin nombre'}</p>
                    <p className="truncate font-mono text-muted-foreground">/{slug || '…'}</p>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2">
                    <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span>
                      Plan <strong>{planElegido?.name ?? '—'}</strong>
                      {planElegido ? ` · ${planElegido.price > 0 ? `${formatGs(planElegido.price)} / mes` : 'gratis'}` : ''}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span>
                      {planElegido && planElegido.trialDays > 0
                        ? `Suscripción en prueba ${planElegido.trialDays} días, hasta el ${formatDate(trialEndDate(planElegido.trialDays), timezone)}`
                        : 'Suscripción sin período de prueba'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span>Una sucursal: «Sucursal principal»</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Configuración inicial pendiente: la completa el propietario al entrar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>Tienda pública sin publicar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    {ownerState.status === 'done' && ownerState.lookup.exists && !ownerState.lookup.suspended ? (
                      <>
                        <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="min-w-0 break-words">Propietario: {ownerState.lookup.email}, sin enviar correo</span>
                      </>
                    ) : ownerState.status === 'empty' ? (
                      <>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span>Sin propietario</span>
                      </>
                    ) : (
                      <>
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                        <span className="min-w-0 break-words">Invitación a {ownerEmail.trim()}</span>
                      </>
                    )}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  )
}
