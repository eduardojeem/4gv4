'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SubscriptionPlan, updateSubscriptionPlan } from '@/services/subscription-plans'
import { toast } from 'sonner'
import {
  Boxes,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Crown,
  Download,
  Globe,
  Info,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  TicketPercent,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCommercialFeatureValue } from '@/lib/saas/commercial-plan-features'

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_LIST = [
  { key: 'pos',       label: 'Punto de Venta (POS)',      icon: ShoppingCart },
  { key: 'inventory', label: 'Inventario',                 icon: Boxes        },
  { key: 'users',     label: 'Gestión de usuarios',        icon: Users        },
  { key: 'branches',  label: 'Sucursales múltiples',       icon: Building2    },
  { key: 'repairs',   label: 'Módulo de Reparaciones',     icon: Wrench       },
  { key: 'crm',       label: 'CRM / Clientes',             icon: Users        },
  { key: 'ecommerce', label: 'Ecommerce & Marketplace',    icon: Globe        },
  { key: 'analytics', label: 'Analytics avanzado',         icon: TrendingUp   },
  { key: 'reports',   label: 'Reportes exportables',       icon: Download     },
  { key: 'credits',   label: 'Créditos y cuotas',          icon: CreditCard   },
  { key: 'promotions', label: 'Promociones y descuentos',  icon: TicketPercent },
  { key: 'security',   label: 'Seguridad y auditoría',      icon: ShieldCheck },
  { key: 'support',   label: 'Soporte prioritario',        icon: Sparkles     },
]

const TIER_STYLES: Record<string, { bar: string; icon: string; accent: string }> = {
  free:       { bar: 'bg-gradient-to-r from-slate-400 to-slate-500',   icon: 'bg-slate-100 text-slate-600',   accent: 'text-slate-700'   },
  basic:      { bar: 'bg-gradient-to-r from-blue-400 to-blue-600',     icon: 'bg-blue-50 text-blue-600',      accent: 'text-blue-700'    },
  pro:        { bar: 'bg-gradient-to-r from-violet-500 to-purple-700', icon: 'bg-violet-50 text-violet-600',  accent: 'text-violet-700'  },
  enterprise: { bar: 'bg-gradient-to-r from-amber-400 to-orange-500',  icon: 'bg-amber-50 text-amber-600',    accent: 'text-amber-700'   },
}

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package, basic: CreditCard, pro: Star, enterprise: Crown,
}

const EDIT_TABS = [
  { id: 'info',     label: 'Información' },
  { id: 'limits',   label: 'Límites'     },
  { id: 'features', label: 'Features'    },
  { id: 'settings', label: 'Ajustes'     },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPYG(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{children}</span>
    </div>
  )
}

// ─── LimitInput: fully controlled ────────────────────────────────────────────

type LimitType = 'unlimited' | 'number' | 'custom'

function LimitField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const isUnlimited = value.toLowerCase() === 'ilimitado' || value === '∞'
  const parsed = parseInt(value, 10)
  const isNumber = !isNaN(parsed) && parsed > 0 && String(parsed) === value

  const getType = (): LimitType => {
    if (isUnlimited) return 'unlimited'
    if (isNumber) return 'number'
    return 'custom'
  }

  const [type, setType] = useState<LimitType>(getType)
  const [numVal, setNumVal] = useState(isNumber ? value : '5')
  const [customVal, setCustomVal] = useState(!isUnlimited && !isNumber ? value : '')

  function switchType(t: LimitType) {
    setType(t)
    if (t === 'unlimited') onChange('Ilimitado')
    else if (t === 'number') onChange(numVal)
    else onChange(customVal)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</Label>
      <div className="flex gap-1 rounded-xl border bg-slate-50 p-0.5 dark:bg-slate-900/50">
        {(['unlimited', 'number', 'custom'] as LimitType[]).map((t) => (
          <button key={t} type="button" onClick={() => switchType(t)}
            className={cn(
              'flex-1 rounded-lg py-1 text-[9px] font-bold uppercase tracking-wide transition-all',
              type === t
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            {t === 'unlimited' ? '∞' : t === 'number' ? '#' : '✎'}
          </button>
        ))}
      </div>

      {type === 'unlimited' && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Sin límite</span>
        </div>
      )}
      {type === 'number' && (
        <Input
          type="number" min="1" value={numVal} className="h-8 text-sm"
          onChange={(e) => { setNumVal(e.target.value); onChange(e.target.value) }}
        />
      )}
      {type === 'custom' && (
        <Input
          value={customVal} placeholder="ej. 20/mes" className="h-8 text-sm"
          onChange={(e) => { setCustomVal(e.target.value); onChange(e.target.value) }}
        />
      )}
    </div>
  )
}

// ─── FeatureToggle ────────────────────────────────────────────────────────────

function FeatureToggle({ label, icon: Icon, enabled, onToggle }: {
  label: string; icon: React.ComponentType<{ className?: string }>; enabled: boolean; onToggle: () => void
}) {
  return (
    <button type="button" onClick={onToggle}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]',
        enabled
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
      )}
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className={cn('flex-1 text-xs font-medium',
        enabled ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-slate-400'
      )}>
        {label}
      </span>
      {enabled
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        : <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
      }
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  plan: SubscriptionPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PlanEditSheet({ plan, open, onOpenChange, onSuccess }: Props) {
  // ── ALL state (never rely on FormData — inputs may be unmounted) ──
  const [loading, setLoading]       = useState(false)
  const [activeTab, setActiveTab]   = useState('info')

  // Info tab
  const [name, setName]             = useState('')
  const [description, setDesc]      = useState('')
  const [highlights, setHighlights] = useState('')
  const [price, setPrice]           = useState('0')
  const [priceNote, setPriceNote]   = useState('por mes')
  const [trialDays, setTrialDays]   = useState('14')

  // Limits tab
  const [limUsers, setLimUsers]         = useState('5')
  const [limProducts, setLimProducts]   = useState('100')
  const [limBranches, setLimBranches]   = useState('1')
  const [limRepairs, setLimRepairs]     = useState('')

  // Features tab
  const [featureMap, setFeatureMap] = useState<Map<string, boolean | string>>(new Map())

  // Settings tab
  const [isActive, setIsActive]     = useState(true)
  const [isPopular, setIsPopular]   = useState(false)

  // ── Sync state when plan changes ──
  useEffect(() => {
    if (!plan) return
    setActiveTab('info')
    setName(plan.name ?? '')
    setDesc(plan.description ?? '')
    setHighlights((plan.highlights ?? []).join('\n'))
    setPrice(String(plan.price ?? 0))
    setPriceNote(plan.price_note ?? 'por mes')
    setTrialDays(String(plan.trial_days ?? 14))
    setLimUsers(String(plan.limits?.users ?? '5'))
    setLimProducts(String(plan.limits?.products ?? '100'))
    setLimBranches(String(plan.limits?.branches ?? '1'))
    setLimRepairs(String(plan.limits?.repairs ?? ''))
    setIsActive(plan.is_active)
    setIsPopular(plan.is_popular)
    const m = new Map<string, boolean | string>()
    for (const f of plan.features ?? []) {
      if (f.label) m.set(f.label, f.value ?? false)
    }
    for (const feature of FEATURE_LIST) {
      m.set(feature.label, getCommercialFeatureValue(plan.features, feature.key))
    }
    setFeatureMap(m)
  }, [plan])

  if (!plan) return null

  const tierStyle = TIER_STYLES[plan.tier] || TIER_STYLES.basic
  const TierIcon  = TIER_ICONS[plan.tier]  || Package
  const enabledCount = FEATURE_LIST.filter((f) => Boolean(featureMap.get(f.label))).length

  function toggleFeature(label: string) {
    setFeatureMap((prev) => {
      const next = new Map(prev)
      next.set(label, !prev.get(label))
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('El nombre del plan es requerido')
      setActiveTab('info')
      return
    }

    setLoading(true)
    try {
      const features = FEATURE_LIST.map((f) => ({
        label: f.label,
        value: featureMap.get(f.label) ?? false,
      }))

      await updateSubscriptionPlan(plan.id, {
        name:        name.trim(),
        price:       Number(price) || 0,
        price_note:  priceNote,
        description: description,
        is_active:   isActive,
        is_popular:  isPopular,
        trial_days:  Number(trialDays) || 0,
        limits: {
          users:    limUsers,
          products: limProducts,
          branches: limBranches,
          repairs:  limRepairs,
        },
        highlights: highlights.split('\n').map((l) => l.trim()).filter(Boolean),
        features,
      })

      toast.success(`Plan ${name} actualizado`)
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const priceNum = Number(price) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">

        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
          <div className={cn('absolute inset-x-0 top-0 h-1', tierStyle.bar)} />
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />

          <DialogHeader className="relative gap-2">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tierStyle.icon)}>
                <TierIcon className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">
                  Editar plan · {plan.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Tier <span className="font-mono font-semibold text-slate-300">{plan.tier.toUpperCase()}</span>
                  {' · '}
                  <span className={cn('font-semibold', isActive ? 'text-emerald-400' : 'text-slate-500')}>
                    {isActive ? 'Activo' : 'Inactivo'}
                  </span>
                  {isPopular && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-600/30 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      <Star className="h-2.5 w-2.5 fill-current" />Popular
                    </span>
                  )}
                </DialogDescription>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xl font-extrabold text-white">{formatPYG(priceNum)}</p>
                {priceNum > 0 && <p className="text-[10px] text-slate-400">{priceNote || '/mes'}</p>}
              </div>
            </div>
          </DialogHeader>

          {/* Tab nav */}
          <div className="relative mt-4 flex gap-1">
            {EDIT_TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === tab.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {tab.label}
                {tab.id === 'features' && (
                  <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
                  )}>
                    {enabledCount}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-violet-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* TAB: Información */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <SectionTitle>Identidad</SectionTitle>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-name" className="text-xs">
                    Nombre público <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={cn('h-9', !name.trim() && 'border-red-300 focus-visible:ring-red-400')}
                    placeholder="Nombre visible en la app"
                  />
                  {!name.trim() && (
                    <p className="text-[10px] text-red-500">El nombre es obligatorio</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-desc" className="text-xs">Descripción</Label>
                  <Textarea
                    id="edit-desc"
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                    placeholder="Para quién está pensado este plan…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-hl" className="text-xs">Highlights (1 por línea)</Label>
                  <Textarea
                    id="edit-hl"
                    value={highlights}
                    onChange={(e) => setHighlights(e.target.value)}
                    rows={4}
                    className="resize-none text-sm"
                    placeholder={'POS completo\nReparaciones\nGestión de clientes'}
                  />
                  <p className="text-[10px] text-slate-400">Bullets visibles en la pricing card pública</p>
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle>Precio</SectionTitle>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-price" className="text-xs">Precio (₲ PYG)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-slate-400">₲</span>
                    <Input
                      id="edit-price"
                      type="number"
                      step="1"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="h-9 pl-7"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">0 = plan gratuito</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-pnote" className="text-xs">Nota del precio</Label>
                  <Input
                    id="edit-pnote"
                    value={priceNote}
                    onChange={(e) => setPriceNote(e.target.value)}
                    placeholder="por mes"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-trial" className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3 text-cyan-500" />
                    Días de prueba
                  </Label>
                  <Input
                    id="edit-trial"
                    type="number"
                    min="0"
                    max="365"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[10px] text-slate-400">Días de trial al registrarse</p>
                </div>

                {/* Live preview */}
                <div className="overflow-hidden rounded-2xl border">
                  <div className={cn('h-1', tierStyle.bar)} />
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vista previa</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-800 dark:text-slate-100">{formatPYG(priceNum)}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{description || 'Sin descripción'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Límites */}
          {activeTab === 'limits' && (
            <div className="p-6">
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                {/* eslint-disable react/no-unescaped-entities */}
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>∞</strong> = sin tope · <strong>#</strong> = número máximo exacto · <strong>✎</strong> = texto libre (ej: "20/mes").
                  Estos valores son validados en tiempo real en la app.
                </p>
                {/* eslint-enable react/no-unescaped-entities */}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <LimitField label="Usuarios"      value={limUsers}    onChange={setLimUsers}    />
                <LimitField label="Productos"     value={limProducts} onChange={setLimProducts} />
                <LimitField label="Sucursales"    value={limBranches} onChange={setLimBranches} />
                <LimitField label="Reparaciones"  value={limRepairs}  onChange={setLimRepairs}  />
              </div>
            </div>
          )}

          {/* TAB: Features */}
          {activeTab === 'features' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{enabledCount}</span>
                  {' '}de {FEATURE_LIST.length} módulos habilitados
                </p>
                <div className="flex gap-2">
                  <button type="button" className="text-[10px] font-bold text-violet-600 hover:underline"
                    onClick={() => {
                      const m = new Map(featureMap)
                      FEATURE_LIST.forEach((f) => m.set(f.label, true))
                      setFeatureMap(m)
                    }}
                  >
                    Todos
                  </button>
                  <span className="text-slate-300">·</span>
                  <button type="button" className="text-[10px] font-bold text-slate-400 hover:underline"
                    onClick={() => {
                      const m = new Map(featureMap)
                      FEATURE_LIST.forEach((f) => m.set(f.label, false))
                      setFeatureMap(m)
                    }}
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_LIST.map(({ label, icon }) => (
                  <FeatureToggle
                    key={label}
                    label={label}
                    icon={icon}
                    enabled={Boolean(featureMap.get(label))}
                    onToggle={() => toggleFeature(label)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB: Ajustes */}
          {activeTab === 'settings' && (
            <div className="space-y-4 p-6">
              <SectionTitle>Visibilidad y comportamiento</SectionTitle>

              <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm dark:bg-slate-900">
                <div>
                  <p className="text-sm font-semibold">Plan activo</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Los planes inactivos no aparecen para nuevas contrataciones.
                  </p>
                </div>
                <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm dark:bg-slate-900">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Star className="h-3.5 w-3.5 text-violet-500" />
                    Marcar como popular
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Destacado visualmente. Solo un plan puede ser popular a la vez.
                  </p>
                </div>
                <Switch id="is_popular" checked={isPopular} onCheckedChange={setIsPopular} />
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/40">
                <SectionTitle icon={Info}>Información técnica (solo lectura)</SectionTitle>
                <dl className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">ID</dt>
                    <dd className="truncate font-mono text-slate-600 dark:text-slate-300">{plan.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Tier interno</dt>
                    <dd className="font-mono font-bold uppercase text-slate-600 dark:text-slate-300">{plan.tier}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Creado</dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {new Date(plan.created_at).toLocaleDateString('es-PY')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Actualizado</dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {new Date(plan.updated_at).toLocaleDateString('es-PY')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t bg-slate-50/80 px-6 py-4 dark:bg-slate-900/50">
          <p className="text-[11px] text-slate-400">
            Los cambios se aplican inmediatamente al guardar.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading || !name.trim()}
              onClick={handleSave}
              className="gap-2 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
