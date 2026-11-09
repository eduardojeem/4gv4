'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Loader2, Save, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter, DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { planLabel, type PlanNames } from '@/lib/superadmin/plan-names'
import { buildOrganizationPatch, organizationEditDefaults, ORGANIZATION_FIELD_LABELS, type OrganizationEditValues } from '@/lib/superadmin/organization-edit'
import { ORGANIZATION_CURRENCIES, ORGANIZATION_TIMEZONES, timezoneOffsetLabel } from '@/lib/superadmin/create-organization'
import { moduleDisplayName } from '@/lib/saas/plan-feature-catalog'

export type EditableOrganization = {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status?: string | null
  currency?: string | null
  timezone?: string | null
  business_vertical?: string | null
  operating_model?: string | null
  enabled_modules?: string[] | null
  effective_modules?: string[]
  trial_ends_at?: string | null
  current_period_ends_at?: string | null
  cancel_at_period_end?: boolean
}

type Props = {
  organization: EditableOrganization | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PLAN_OPTIONS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']
const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'trialing', label: 'En Prueba (Trial)' },
  { value: 'past_due', label: 'Vencida / Pago Pendiente' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
  { value: 'unpaid', label: 'Impaga' },
]

export const VERTICAL_OPTIONS = [
  { value: 'electronics', label: 'Tecnología & Celulares', icon: '📱' },
  { value: 'clothing', label: 'Ropa & Moda', icon: '👗' },
  { value: 'general', label: 'Comercio General', icon: '🏬' },
  { value: 'food', label: 'Alimentos & Gastronomía', icon: '🍔' },
  { value: 'cosmetics', label: 'Cosmética & Belleza', icon: '💄' },
  { value: 'hardware', label: 'Ferretería & Construcción', icon: '🔨' },
  { value: 'barbershop', label: 'Barbería & Peluquería', icon: '💈' },
  { value: 'other', label: 'Otros Rubros', icon: '🏷️' },
]

export const OPERATING_MODELS = [
  { value: 'retail', label: 'Venta Minorista' },
  { value: 'wholesale', label: 'Venta Mayorista' },
  { value: 'service', label: 'Prestación de Servicios' },
  { value: 'repair', label: 'Taller & Reparaciones' },
  { value: 'mixed', label: 'Negocio Mixto' },
]

export const AVAILABLE_MODULES = [
  { key: 'pos', label: moduleDisplayName('pos'), desc: 'Caja rápida y ticket' },
  { key: 'inventory', label: moduleDisplayName('inventory'), desc: 'Control de existencias' },
  { key: 'crm', label: moduleDisplayName('crm'), desc: 'Fidelización e historial' },
  { key: 'ecommerce', label: moduleDisplayName('ecommerce'), desc: 'Catálogo público web' },
  { key: 'repairs', label: moduleDisplayName('repairs'), desc: 'Órdenes de servicio' },
  { key: 'orders', label: moduleDisplayName('orders'), desc: 'Gestión y despachos' },
  { key: 'credits', label: moduleDisplayName('credits'), desc: 'Cobranzas y cuotas' },
  { key: 'services', label: moduleDisplayName('services'), desc: 'Agenda y presupuestos' },
  { key: 'delivery', label: moduleDisplayName('delivery'), desc: 'Rastreo y logística' },
  { key: 'analytics', label: moduleDisplayName('analytics'), desc: 'Estadísticas y KPI' },
  { key: 'web_analytics', label: moduleDisplayName('web_analytics'), desc: 'Tráfico de la tienda online' },
  { key: 'promotions', label: moduleDisplayName('promotions'), desc: 'Cupones y descuentos' },
  { key: 'inventory_admin', label: moduleDisplayName('inventory_admin'), desc: 'Lotes y transferencias' },
  { key: 'security', label: moduleDisplayName('security'), desc: 'Trazabilidad de acciones' },
  { key: 'finances', label: moduleDisplayName('finances'), desc: 'Gastos, nómina y rentabilidad' },
  { key: 'reports', label: moduleDisplayName('reports'), desc: 'CSV, Excel y PDF' },
]

export function EditOrganizationDialog({ organization, open, onClose, onSuccess, planNames }: Props & { planNames?: PlanNames }) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState('FREE')
  const [status, setStatus] = useState('active')
  const [currency, setCurrency] = useState('PYG')
  const [timezone, setTimezone] = useState('America/Asuncion')
  const [businessVertical, setBusinessVertical] = useState('general')
  const [operatingModel, setOperatingModel] = useState('retail')
  const [inheritModules, setInheritModules] = useState(true)
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Confirmation Step State
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    if (organization) {
      setName(organization.name || '')
      setSlug(organization.slug || '')
      setPlan((organization.plan || 'FREE').toUpperCase())
      setStatus(organization.subscription_status === 'canceled' ? 'cancelled' : organization.subscription_status || 'sin_registro')
      setCurrency(organization.currency || 'PYG')
      setTimezone(organization.timezone || 'America/Asuncion')
      setBusinessVertical(organization.business_vertical || 'general')
      setOperatingModel(organization.operating_model || 'retail')
      setInheritModules(organization.enabled_modules == null)
      setEnabledModules(organization.enabled_modules ?? organization.effective_modules ?? [])
      setCancelAtPeriodEnd(Boolean(organization.cancel_at_period_end))
      setError(null)
      setShowConfirmation(false)
    }
  }, [organization, open])

  if (!organization) return null

  // Change detection for danger/confirmation prompts
  const isSlugChanged = slug.trim() !== organization.slug
  const isDangerousStatus = status === 'suspended' || status === 'cancelled' || status === 'past_due'
  
  const draft: OrganizationEditValues = { name, slug, plan, status, currency, timezone, business_vertical: businessVertical, operating_model: operatingModel, enabled_modules: inheritModules ? null : enabledModules, cancel_at_period_end: cancelAtPeriodEnd }
  const changes = buildOrganizationPatch(organization, draft)
  const originalValues = organizationEditDefaults(organization)
  const hasChanges = Object.keys(changes).length > 0
  const restrictiveChange = isDangerousStatus && changes.status !== undefined
  function describeValue(key: keyof OrganizationEditValues, value: unknown) {
    if (value == null) return 'Según el plan'
    if (value === 'sin_registro') return 'Sin suscripción'
    if (key === 'plan') return planLabel(String(value), planNames)
    if (key === 'enabled_modules') return (value as string[]).map(moduleDisplayName).join(', ') || 'Ninguna'
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (key === 'status') return STATUS_OPTIONS.find(item => item.value === value)?.label || String(value)
    if (key === 'business_vertical') return VERTICAL_OPTIONS.find(item => item.value === value)?.label || String(value)
    if (key === 'operating_model') return OPERATING_MODELS.find(item => item.value === value)?.label || String(value)
    return String(value)
  }

  function toggleModule(modKey: string) {
    setEnabledModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    )
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre de la organización es obligatorio.')
      return
    }
    if (!slug.trim()) {
      setError('La dirección pública es obligatoria.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      setError('El slug solo puede contener letras minúsculas, números y guiones.')
      return
    }

    if (status === 'sin_registro' && (changes.plan !== undefined || changes.cancel_at_period_end !== undefined)) {
      setError('Elegí el estado de la nueva suscripción antes de continuar.')
      return
    }
    // Trigger safety confirmation step
    setShowConfirmation(true)
  }

  async function executeSave() {
    if (isSubmitting || !hasChanges) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/superadmin/organizations/${organization?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar los cambios.')
      }

      toast.success('Organización actualizada con éxito')
      router.refresh()
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al actualizar.')
      setShowConfirmation(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isSubmitting) onClose() }}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-3xl rounded-3xl border border-border shadow-2xl">
        
        {/* Header */}
        <div className="border-b border-border bg-muted/30 p-5 pr-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md">
                {organization.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                    {showConfirmation ? 'Revisar cambios' : 'Editar organización'}
                  </DialogTitle>
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    /{organization.slug}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground font-medium">
                  {showConfirmation
                    ? 'Comprobá los campos que van a cambiar antes de guardar.'
                    : 'Datos de empresa, suscripción y funciones, en secciones separadas.'}
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full hidden sm:inline-flex',
                status === 'active'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
              )}
            >
              {status === 'sin_registro' ? 'Sin suscripción' : STATUS_OPTIONS.find(option => option.value === status)?.label || status}
            </Badge>
          </div>
        </div>

        {error && <div role="alert" className="mx-5 mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        {/* ⚠️ STEP 2: CONFIRMATION & IMPACT VIEW */}
        {showConfirmation ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-muted/40">
            
            {/* Danger Hero Warning */}
            <div className={cn("space-y-3 rounded-2xl border p-5", restrictiveChange ? "border-red-300 bg-red-50 dark:border-red-900/70 dark:bg-red-950/30" : "border-border bg-muted/30")}>
              <div className={cn("flex items-center gap-2.5 text-sm font-semibold", restrictiveChange ? "text-red-700 dark:text-red-400" : "text-foreground")}>
                {restrictiveChange ? <ShieldAlert className="size-5 shrink-0 text-red-600"/> : <CheckCircle2 className="size-5 shrink-0 text-primary"/>}
                <span>¿Querés guardar estos cambios?</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Estás a punto de modificar la configuración operativa de <strong className="font-bold text-foreground">{organization.name}</strong>. Solo se guardarán los campos que modificaste. Revisá especialmente los cambios de plan, acceso y dirección pública.
              </p>
            </div>

            {/* Change Diff Summary */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs shadow-2xs">
              <p className="font-semibold uppercase tracking-wider text-xs text-muted-foreground">
                Resumen de Cambios a Aplicar
              </p>
              
              <ul className="divide-y divide-border">{(Object.keys(changes) as (keyof OrganizationEditValues)[]).map(key => <li key={key} className="space-y-2 py-3"><p className="text-sm font-semibold">{ORGANIZATION_FIELD_LABELS[key]}</p><div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]"><span className="break-words text-muted-foreground">{describeValue(key, originalValues[key])}</span><ArrowRight aria-hidden className="size-4 self-center text-muted-foreground"/><span className="break-words font-medium text-foreground">{describeValue(key, changes[key])}</span></div></li>)}</ul>
            </div>

            {/* Confirmation Footer */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setShowConfirmation(false)}
                className="rounded-xl text-xs font-bold cursor-pointer w-full sm:w-auto"
              >
                Volver a editar
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void executeSave()}
                className={cn("min-h-11 w-full gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto", restrictiveChange ? "bg-red-600 text-white hover:bg-red-700" : "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aplicando Cambios...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar y guardar
                  </>
                )}
              </Button>
            </div>

          </div>
        ) : (
          /* 🛠️ STEP 1: MAIN EDIT FORM */
          <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-6 overflow-y-auto bg-background p-5">
            
            {/* Real-time Critical Impact Alert Banners */}
            {isSlugChanged && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-2xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-semibold block">La dirección pública va a cambiar</strong>
                  <p>
                    Cambiar el slug de <code>/{organization.slug}</code> a <code>/{slug}</code> cambiará la URL pública de la tienda para los clientes.
                  </p>
                </div>
              </div>
            )}

            {isDangerousStatus && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50/90 p-4 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 shadow-2xs">
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-semibold block">Alerta de Suspensión / Estado Restrictivo</strong>
                  <p>
                    Marcar la organización como <strong>{status}</strong> restringirá las ventas y el acceso operativo para todos los miembros.
                  </p>
                </div>
              </div>
            )}

            <div><h3 className="text-base font-semibold">1. Datos de la empresa</h3><p className="mt-1 text-sm text-muted-foreground">Identidad, dirección pública y actividad.</p></div>
            {/* Form Fields Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-org-name" className="text-xs font-bold text-foreground/80">
                  Nombre de la Empresa <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-xl text-sm font-medium"
                  placeholder="Nombre comercial"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-org-slug" className="text-xs font-bold text-foreground/80">
                    Dirección de la tienda <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">URL pública: /{slug}/inicio</span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                    /
                  </span>
                  <Input
                    id="edit-org-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className={cn(
                      'pl-7 rounded-xl h-11 text-sm font-mono font-bold',
                      isSlugChanged ? 'text-amber-600 border-amber-400 ring-1 ring-amber-400/30' : 'text-violet-600 dark:text-violet-400'
                    )}
                    placeholder="slug-de-empresa"
                    required
                  />
                </div>
              </div>

              {/* Rubro Comercial & Modelo Operativo */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-org-vertical" className="text-xs font-bold text-foreground/80">
                  Rubro Comercial
                </Label>
                <Select value={businessVertical} onValueChange={setBusinessVertical}>
                  <SelectTrigger id="edit-org-vertical" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {VERTICAL_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value} className="text-xs font-bold">
                        {v.icon} {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-model" className="text-xs font-bold text-foreground/80">
                  Modelo Operativo
                </Label>
                <Select value={operatingModel} onValueChange={setOperatingModel}>
                  <SelectTrigger id="edit-org-model" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {OPERATING_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs font-bold">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 border-t border-border pt-5"><h3 className="text-base font-semibold">2. Plan y acceso</h3><p className="mt-1 text-sm text-muted-foreground">Cambiar estos valores puede modificar las funciones disponibles.</p></div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-org-plan" className="text-xs font-bold text-foreground/80">
                  Plan Asignado
                </Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger id="edit-org-plan" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Array.from(new Set([...PLAN_OPTIONS, plan])).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs font-bold">
                        {planLabel(p, planNames)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-status" className="text-xs font-bold text-foreground/80">
                  Estado de la Suscripción
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="edit-org-status" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {status === 'sin_registro' && <SelectItem value="sin_registro" disabled>Sin suscripción</SelectItem>}
                    {STATUS_OPTIONS.map((st) => (
                      <SelectItem key={st.value} value={st.value} className="text-xs font-bold">
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 border-t border-border pt-5"><h3 className="text-base font-semibold">3. Moneda y horarios</h3><p className="mt-1 text-sm text-muted-foreground">Solo se actualizan si los cambiás.</p></div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-org-currency" className="text-xs font-bold text-foreground/80">
                  Moneda Principal
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="edit-org-currency" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {!ORGANIZATION_CURRENCIES.some(item => item.value === currency) && <SelectItem value={currency}>{currency}</SelectItem>}
                    {ORGANIZATION_CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs font-bold">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-timezone" className="text-xs font-bold text-foreground/80">
                  Zona Horaria
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="edit-org-timezone" className="h-11 w-full rounded-xl text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {!ORGANIZATION_TIMEZONES.some(item => item.value === timezone) && <SelectItem value={timezone}>{timezone}</SelectItem>}
                    {ORGANIZATION_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} className="text-xs font-bold">
                        {tz.country} · {timezoneOffsetLabel(tz.value) ?? tz.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Módulos Habilitados Selector Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-violet-600" />
                  <span className="text-xs font-semibold text-foreground">
                    4. Funciones de la empresa
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {inheritModules ? 'Según el plan' : enabledModules.length + ' seleccionadas'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Estas opciones no agregan funciones que el plan no incluya.
              </p>

              {organization.enabled_modules == null && <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3"><span className="text-sm font-medium">Conservar las funciones del plan<span className="mt-1 block text-xs font-normal text-muted-foreground">Desactivá esta opción solo si querés personalizarlas.</span></span><Switch checked={inheritModules} onCheckedChange={setInheritModules}/></label>}
              {(!inheritModules || Boolean(organization.effective_modules?.length)) && <div className={cn('grid gap-2 sm:grid-cols-2', inheritModules && 'opacity-60')}>
                {AVAILABLE_MODULES.map((mod) => {
                  const isChecked = enabledModules.includes(mod.key)
                  return (
                    <label
                      key={mod.key}
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-all cursor-pointer select-none',
                        isChecked
                          ? 'border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <Checkbox
                        disabled={inheritModules}
                        checked={isChecked}
                        onCheckedChange={() => toggleModule(mod.key)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="font-bold">{mod.label}</p>
                        <p className="text-xs text-muted-foreground">{mod.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>}
            </div>

            {/* Cancel at period end switch */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <div>
                <Label htmlFor="edit-org-cancel" className="text-xs font-semibold cursor-pointer text-foreground">
                  Cancelar al terminar el período
                </Label>
                <p className="text-xs text-muted-foreground font-medium">
                  La cancelación queda programada para la fecha de finalización.
                </p>
              </div>
              <Switch
                id="edit-org-cancel"
                checked={cancelAtPeriodEnd}
                onCheckedChange={setCancelAtPeriodEnd}
              />
            </div>

            {/* Error banner */}

            </div>
            {/* Form Action Buttons */}
            <DialogFooter className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card p-4 [&_button]:min-h-11">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!hasChanges || isSubmitting}
                size="sm"
                className={cn(
                  'gap-1.5 rounded-xl text-xs font-bold shadow-md cursor-pointer h-9 px-4',
                  isDangerousStatus || isSlugChanged
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600'
                )}
              >
                <Save className="h-3.5 w-3.5" />
                Revisar cambios
              </Button>
            </DialogFooter>

          </form>
        )}

      </DialogContent>
    </Dialog>
  )
}