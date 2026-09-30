'use client'

import { useEffect, useMemo, useState } from 'react'
import { checkPlanPriceNote } from '@/lib/saas/plan-price-note'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SubscriptionPlan, updateSubscriptionPlan } from '@/services/subscription-plans'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Info,
  Loader2,
  Package,
  Star,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_FEATURES } from '@/lib/saas/plan-feature-catalog'
import { PLAN_LIMIT_FIELDS, formatPlanLimit, limitsFromPlan, parsePlanLimit, type PlanLimitKey } from '@/lib/saas/plan-limits'
import { computePlanChangeImpact, moduleLabel } from '@/lib/saas/plan-change-impact'
import { effectivePlanFeatures } from '@/lib/saas/plan-modules'
import {
  PlanFeatureToggles,
  PlanLimitFields,
  canonicalLimits,
  featurePayload,
  firstLimitError,
  toggleWithDependencies,
} from './plans/plan-form-fields'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { bar: string; icon: string }> = {
  free: { bar: 'bg-gradient-to-r from-slate-400 to-slate-500', icon: 'bg-slate-100 text-slate-600' },
  basic: { bar: 'bg-gradient-to-r from-blue-400 to-blue-600', icon: 'bg-blue-50 text-blue-600' },
  pro: { bar: 'bg-gradient-to-r from-violet-500 to-purple-700', icon: 'bg-violet-50 text-violet-600' },
  enterprise: { bar: 'bg-gradient-to-r from-amber-400 to-orange-500', icon: 'bg-amber-50 text-amber-600' },
}

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package, basic: CreditCard, pro: Star, enterprise: Crown,
}

const EDIT_TABS = [
  { id: 'info', label: 'Información' },
  { id: 'limits', label: 'Límites' },
  { id: 'features', label: 'Funciones' },
  { id: 'settings', label: 'Ajustes' },
] as const

type TabId = (typeof EDIT_TABS)[number]['id']

function formatPYG(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{children}</p>
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  name: string
  description: string
  highlights: string
  price: string
  priceNote: string
  publicSlug: string
  trialDays: string
  limits: Record<PlanLimitKey, string>
  features: Record<string, boolean>
  isActive: boolean
  isPopular: boolean
}

function formFromPlan(plan: SubscriptionPlan): FormState {
  return {
    name: plan.name ?? '',
    description: plan.description ?? '',
    highlights: (plan.highlights ?? []).join('\n'),
    price: String(plan.price ?? 0),
    priceNote: plan.price_note ?? 'por mes',
    publicSlug: plan.public_slug ?? '',
    trialDays: String(plan.trial_days ?? 0),
    limits: canonicalLimits(limitsFromPlan(plan.limits)),
    // Lo tildado es lo que las tiendas reciben: un módulo que el plan trae por
    // defecto sin estar en la lista se ve prendido (si no, guardar sin tocar
    // nada se lo quitaba).
    features: effectivePlanFeatures(plan.tier, plan.features),
    isActive: plan.is_active,
    isPopular: plan.is_popular,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  plan: SubscriptionPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  /** Tiendas con este plan activo: a ellas se les aplica el cambio al guardar. */
  activeStores?: number
}

export function PlanEditSheet({ plan, open, onOpenChange, onSuccess, activeStores = 0 }: Props) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [form, setForm] = useState<FormState | null>(null)
  const [initial, setInitial] = useState<FormState | null>(null)

  useEffect(() => {
    if (!plan) return
    const next = formFromPlan(plan)
    setForm(next)
    setInitial(next)
    setActiveTab('info')
  }, [plan])

  const priceNum = Number(form?.price) || 0
  const isFree = priceNum === 0

  const features = useMemo(() => (form ? featurePayload(form.features) : []), [form])
  const impact = useMemo(
    () => (plan && form ? computePlanChangeImpact(plan.tier, { features: plan.features, limits: plan.limits }, { features, limits: form.limits }) : null),
    [plan, form, features],
  )

  if (!plan || !form || !initial) return null

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const tierStyle = TIER_STYLES[plan.tier] || TIER_STYLES.basic
  const TierIcon = TIER_ICONS[plan.tier] || Package
  const enabledCount = PLAN_FEATURES.filter((feature) => form.features[feature.key]).length
  const limitError = firstLimitError(form.limits)
  const hasLosses = Boolean(impact && (impact.removedModules.length > 0 || impact.loweredLimits.length > 0))
  const revisionNota = checkPlanPriceNote(priceNum, form.priceNote)
  const avisoNota = revisionNota.ok === false ? revisionNota : null
  const trialDays = isFree ? 0 : Math.max(0, Math.floor(Number(form.trialDays) || 0))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  const setPriceNote = (value: string) => set('priceNote', value)

  function toggleFeature(key: string) {
    setForm((prev) => (prev ? { ...prev, features: toggleWithDependencies(prev.features, key) } : prev))
  }

  async function handleSave() {
    if (!form || !plan) return
    if (!form.name.trim()) {
      toast.error('El nombre del plan es requerido')
      setActiveTab('info')
      return
    }
    if (limitError) {
      toast.error(limitError)
      setActiveTab('limits')
      return
    }

    setLoading(true)
    try {
      await updateSubscriptionPlan(plan.id, {
        name: form.name.trim(),
        price: priceNum,
        price_note: form.priceNote,
        public_slug: form.publicSlug.trim(),
        description: form.description,
        is_active: form.isActive,
        is_popular: form.isPopular,
        trial_days: trialDays,
        limits: form.limits,
        highlights: form.highlights.split('\n').map((line) => line.trim()).filter(Boolean),
        features,
      })
      toast.success(`Plan ${form.name} actualizado`)
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const previewLimits = PLAN_LIMIT_FIELDS.filter((field) => ['users', 'products', 'branches'].includes(field.key))
  const previewHighlights = form.highlights.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {/* ── Header ── */}
        <div className="relative border-b bg-card px-6 pb-3 pt-5">
          <div className={cn('absolute inset-x-0 top-0 h-1', tierStyle.bar)} />
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tierStyle.icon)}>
                <TierIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold">Editar plan · {plan.name}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span>Código <span className="font-mono font-semibold">{plan.tier}</span></span>
                  <span className={cn('font-semibold', form.isActive ? 'text-emerald-600' : 'text-slate-500')}>
                    {form.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {activeStores === 1 ? '1 tienda lo usa' : `${activeStores} tiendas lo usan`}
                  </span>
                </DialogDescription>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xl font-extrabold">{formatPYG(priceNum)}</p>
                {!isFree && <p className="text-[10px] text-slate-500">{form.priceNote || 'por mes'}</p>}
              </div>
            </div>
          </DialogHeader>

          <div role="tablist" className="mt-4 flex gap-1">
            {EDIT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                )}
              >
                {tab.label}
                {tab.id === 'features' && <span className="ml-1.5 text-[10px] opacity-70">{enabledCount}</span>}
                {tab.id === 'limits' && limitError &&<span className="ml-1.5 text-red-500">•</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="grid gap-6 p-6 md:grid-cols-2">
              <div className="space-y-4">
                <SectionTitle>Identidad</SectionTitle>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name" className="text-xs">Nombre público <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={cn('h-9', !form.name.trim() && 'border-red-300 focus-visible:ring-red-400')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-desc" className="text-xs">Descripción</Label>
                  <Textarea id="edit-desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="resize-none text-sm" placeholder="Para quién está pensado este plan…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-hl" className="text-xs">Puntos destacados (uno por línea)</Label>
                  <Textarea id="edit-hl" value={form.highlights} onChange={(e) => set('highlights', e.target.value)} rows={4} className="resize-none text-sm" />
                  <p className="text-[10px] text-slate-400">Se ven en la tarjeta de precios pública.</p>
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle>Precio</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-price" className="text-xs">Precio mensual (₲)</Label>
                    <Input id="edit-price" type="number" min="0" step="1" value={form.price} onChange={(e) => set('price', e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trial" className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" /> Días de prueba</Label>
                    <Input
                      id="edit-trial"
                      type="number"
                      min="0"
                      max="365"
                      disabled={isFree}
                      value={isFree ? '0' : form.trialDays}
                      onChange={(e) => set('trialDays', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                {isFree && <p className="-mt-2 text-[10px] text-slate-400">Un plan gratis no tiene período de prueba y no se muestra.</p>}

                <div className="space-y-1.5">
                  <Label htmlFor="edit-pnote" className="text-xs">Nota del precio</Label>
                  <Input id="edit-pnote" value={form.priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="por mes" className="h-9" />
                  {avisoNota && (
                    <div className="flex flex-wrap items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300" role="alert">
                      <span className="flex-1">{avisoNota.mensaje}</span>
                      <button type="button" onClick={() => setPriceNote(avisoNota.sugerencia)} className="shrink-0 rounded border border-amber-400 px-1.5 py-0.5 font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40">
                        Usar «{avisoNota.sugerencia}»
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-slug" className="text-xs">URL pública del plan</Label>
                  <Input
                    id="edit-slug"
                    value={form.publicSlug}
                    onChange={(e) => set('publicSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="h-9 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">/register?plan=<span className="font-mono">{form.publicSlug || '…'}</span> · debe ser única</p>
                </div>

                {/* Vista previa con los mismos datos que la tarjeta de precios pública. */}
                <div className="overflow-hidden rounded-2xl border">
                  <div className={cn('h-1', tierStyle.bar)} />
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vista previa</p>
                      {form.isPopular && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Más elegido</span>}
                    </div>
                    <p className="font-bold">{form.name || 'Sin nombre'}</p>
                    <p className="text-xl font-extrabold">{formatPYG(priceNum)} {!isFree && <span className="text-xs font-normal text-slate-500">{form.priceNote}</span>}</p>
                    {trialDays > 0 && <p className="text-[11px] text-slate-500">{trialDays} días gratis</p>}
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      {previewLimits.map((field) => {
                        const raw = form.limits[field.key]
                        const value = raw.trim() === '' ? undefined : parsePlanLimit(raw)
                        return (
                          <div key={field.key} className="rounded-lg bg-muted/50 p-1.5">
                            <span className="block font-bold">{value === undefined ? '—' : formatPlanLimit(field.key, value)}</span>
                            <span className="text-slate-500">{field.label.toLowerCase()}</span>
                          </div>
                        )
                      })}
                    </div>
                    {previewHighlights.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        {previewHighlights.map((line) => (
                          <li key={line} className="flex items-start gap-1.5"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-4 p-6">
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Estos números son el tope real de las tiendas con este plan; el texto de venta se genera a partir de ellos.</p>
              </div>
              <PlanLimitFields limits={form.limits} onChange={(limits) => set('limits', limits)} />
            </div>
          )}

          {activeTab === 'features' && (
            <div className="p-6">
              <PlanFeatureToggles features={form.features} onToggle={toggleFeature} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-xl border px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Plan activo</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Un plan inactivo no se puede contratar; las tiendas que ya lo tienen lo conservan.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => set('isActive', checked)} aria-label="Plan activo" />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-5 py-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><Star className="h-3.5 w-3.5 text-primary" /> Más elegido</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Se destaca en la página de precios. Solo un plan a la vez.</p>
                </div>
                <Switch checked={form.isPopular} onCheckedChange={(checked) => set('isPopular', checked)} aria-label="Más elegido" />
              </div>
              <dl className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-4 text-[11px]">
                <dt className="text-slate-400">ID</dt>
                <dd className="truncate font-mono">{plan.id}</dd>
                <dt className="text-slate-400">Creado</dt>
                <dd>{new Date(plan.created_at).toLocaleDateString('es-PY')}</dd>
                <dt className="text-slate-400">Actualizado</dt>
                <dd>{new Date(plan.updated_at).toLocaleDateString('es-PY')}</dd>
              </dl>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="space-y-3 border-t bg-muted/30 px-6 py-4">
          {isDirty && hasLosses && impact && (
            <div role="alert" className="flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {activeStores > 0
                    ? `Al guardar, ${activeStores === 1 ? 'la tienda con este plan pierde' : `las ${activeStores} tiendas con este plan pierden`}:`
                    : 'Este cambio quita funciones al plan:'}
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {impact.removedModules.map((module) => <li key={module}>{moduleLabel(module)}</li>)}
                  {impact.loweredLimits.map((limit) => (
                    <li key={limit.key}>
                      {limit.label}: de {formatPlanLimit(limit.key, limit.before)} a {formatPlanLimit(limit.key, limit.after)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              {isDirty ? 'Hay cambios sin guardar.' : 'Sin cambios.'}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" size="sm" disabled={loading || !isDirty || !form.name.trim()} onClick={handleSave}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {hasLosses && activeStores > 0 ? `Guardar y aplicar a ${activeStores}` : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
