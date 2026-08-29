'use client'

import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Boxes, Building2, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, Clock, CreditCard, Crown, Download, Globe,
  Loader2, Package, ShoppingCart, Sparkles, Star,
  TrendingUp, Users, Wrench,
  TicketPercent,
  ShieldCheck,
  ClipboardList,
  Handshake,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createSubscriptionPlan } from '@/services/subscription-plans'

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    value: 'free' as const,
    label: 'FREE',
    icon: Package,
    bar: 'bg-gradient-to-r from-slate-400 to-slate-500',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ring: 'ring-slate-300',
    desc: 'Acceso básico sin costo. Ideal para probar la plataforma.',
  },
  {
    value: 'basic' as const,
    label: 'BASIC',
    icon: CreditCard,
    bar: 'bg-gradient-to-r from-blue-400 to-blue-600',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    ring: 'ring-blue-300',
    desc: 'Para negocios chicos que recién empiezan a digitalizar.',
  },
  {
    value: 'pro' as const,
    label: 'PRO',
    icon: Star,
    bar: 'bg-gradient-to-r from-violet-500 to-purple-700',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    ring: 'ring-violet-400',
    desc: 'Funcionalidades completas para equipos en crecimiento.',
  },
  {
    value: 'enterprise' as const,
    label: 'ENTERPRISE',
    icon: Crown,
    bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    ring: 'ring-amber-400',
    desc: 'Sin límites. Soporte dedicado y acceso total.',
  },
]

const FEATURE_LIST = [
  { label: 'Punto de Venta (POS)',    icon: ShoppingCart },
  { label: 'Inventario',              icon: Boxes        },
  { label: 'Inventario avanzado',      icon: Boxes        },
  { label: 'Gestión de usuarios',     icon: Users        },
  { label: 'Sucursales múltiples',    icon: Building2    },
  { label: 'Módulo de Reparaciones',  icon: Wrench       },
  { label: 'Servicios',               icon: Handshake    },
  { label: 'Pedidos',                 icon: ClipboardList },
  { label: 'Entregas',                icon: Truck        },
  { label: 'CRM / Clientes',          icon: Users        },
  { label: 'Ecommerce & Marketplace', icon: Globe        },
  { label: 'Analytics avanzado',      icon: TrendingUp   },
  { label: 'Reportes exportables',    icon: Download     },
  { label: 'Créditos y cuotas',       icon: CreditCard   },
  { label: 'Promociones y descuentos', icon: TicketPercent },
  { label: 'Seguridad y auditoría',     icon: ShieldCheck },
  { label: 'Soporte prioritario',     icon: Sparkles     },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ['Tier', 'Identidad', 'Precio & Límites', 'Features']

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold transition-all',
              i < step  ? 'bg-violet-600 text-white'
              : i === step ? 'bg-white/15 text-white ring-2 ring-violet-400'
              : 'bg-white/5 text-white/40',
            )}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn('hidden text-[10px] font-semibold sm:inline transition-colors',
              i === step ? 'text-white' : i < step ? 'text-violet-300' : 'text-white/30'
            )}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn('mx-2 h-px w-6 transition-colors', i < step ? 'bg-violet-500' : 'bg-white/10')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Feature Toggle ───────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  existingTiers: string[]
}

export function PlanCreateSheet({ open, onOpenChange, onSuccess, existingTiers }: Props) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)

  const availableTiers = TIERS.filter((t) => !existingTiers.includes(t.value))
  const [selectedTier, setSelectedTier] = useState<typeof TIERS[0]>(availableTiers[0] ?? TIERS[1])

  // Step 1
  const [planName, setPlanName]     = useState('')
  const [description, setDesc]      = useState('')
  const [highlights, setHighlights] = useState('')

  // Step 2
  const [price, setPrice]           = useState('0')
  const [priceNote, setPriceNote]   = useState('por mes')
  const [trialDays, setTrialDays]   = useState('14')
  const [limits, setLimits]         = useState({ users: '5', products: '100', branches: '1', repairs: '20/mes' })

  // Step 3
  const [enabledFeatures, setEnabled] = useState<Set<string>>(new Set())

  function toggle(label: string) {
    setEnabled((previous) => {
      const next = new Set(previous)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function reset() {
    setStep(0); setPlanName(''); setDesc(''); setHighlights('')
    setPrice('0'); setPriceNote('por mes'); setTrialDays('14')
    setLimits({ users: '5', products: '100', branches: '1', repairs: '20/mes' })
    setEnabled(new Set())
    if (availableTiers[0]) setSelectedTier(availableTiers[0])
  }

  function close() { reset(); onOpenChange(false) }

  async function create() {
    setLoading(true)
    try {
      const features = FEATURE_LIST.map((f) => ({ label: f.label, value: enabledFeatures.has(f.label) }))
      await createSubscriptionPlan({
        tier:        selectedTier.value,
        name:        planName.trim() || selectedTier.label,
        price:       Number(price) || 0,
        price_note:  priceNote,
        description, trial_days: Number(trialDays) || 0,
        highlights:  highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        limits, features,
      })
      toast.success(`Plan ${selectedTier.label} creado`)
      onSuccess(); close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el plan')
    } finally { setLoading(false) }
  }

  const enabledCount = enabledFeatures.size

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">

        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-6 py-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
          {selectedTier && <div className={cn('absolute inset-x-0 top-0 h-1', selectedTier.bar)} />}

          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Nuevo Plan
              {selectedTier && (
                <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase', selectedTier.badge)}>
                  {selectedTier.label}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Completá los pasos para configurar el nuevo plan SaaS.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4">
            <StepIndicator step={step} />
          </div>
        </div>

        {/* ── Content ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {availableTiers.length === 0 ? (
            <div className="flex flex-col items-center gap-4 p-12 text-center">
              <Crown className="h-12 w-12 text-slate-200" />
              <div>
                <p className="font-bold text-slate-600 dark:text-slate-400">Todos los tiers ya existen</p>
                <p className="mt-1 text-sm text-slate-400">Editá los planes existentes para hacer cambios.</p>
              </div>
              <Button variant="outline" onClick={close}>Cerrar</Button>
            </div>
          ) : (
            <>
              {/* STEP 0: Elegir tier */}
              {step === 0 && (
                <div className="p-6">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Elegí el tier del nuevo plan
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {availableTiers.map((t) => {
                      const Icon = t.icon
                      const isSelected = selectedTier?.value === t.value
                      return (
                        <button key={t.value} type="button"
                          onClick={() => { setSelectedTier(t); if (!planName) setPlanName(t.label) }}
                          className={cn(
                            'relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.99]',
                            isSelected
                              ? `border-2 ring-2 ring-offset-1 ${t.ring} border-transparent bg-slate-50 dark:bg-slate-900`
                              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                          )}
                        >
                          <div className={cn('h-1 w-full rounded-full', t.bar)} />
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider', t.badge)}>
                              {t.label}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-500">{t.desc}</p>
                          {isSelected && (
                            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white shadow">
                              ✓
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* STEP 1: Identidad */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-6 p-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-name" className="text-xs">Nombre público</Label>
                      <Input id="c-name" value={planName} onChange={(e) => setPlanName(e.target.value)}
                        placeholder={selectedTier?.label} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-desc" className="text-xs">Descripción</Label>
                      <Textarea id="c-desc" value={description} onChange={(e) => setDesc(e.target.value)}
                        rows={4} placeholder="Para quién está pensado este plan…" className="resize-none text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-hl" className="text-xs">Highlights (1 por línea)</Label>
                    <Textarea id="c-hl" value={highlights} onChange={(e) => setHighlights(e.target.value)}
                      rows={7} placeholder={'POS completo\nGestión de clientes\nAnalytics avanzado'} className="resize-none text-sm" />
                    <p className="text-[10px] text-slate-400">Bullets de venta visibles en la pricing card pública</p>
                  </div>
                </div>
              )}

              {/* STEP 2: Precio & Límites */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-6 p-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Precio</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-price" className="text-xs">Precio (₲ PYG)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-slate-400">₲</span>
                        <Input id="c-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 pl-7" />
                      </div>
                      <p className="text-[10px] text-slate-400">0 = plan gratuito</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-note" className="text-xs">Nota del precio</Label>
                      <Input id="c-note" value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="por mes" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-trial" className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3 text-cyan-500" /> Días de trial
                      </Label>
                      <Input id="c-trial" type="number" min="0" max="365" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Límites del sistema</p>
                    {[
                      { key: 'users',    label: 'Usuarios'     },
                      { key: 'products', label: 'Productos'    },
                      { key: 'branches', label: 'Sucursales'   },
                      { key: 'repairs',  label: 'Reparaciones' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`lim-${key}`} className="text-xs">{label}</Label>
                        <Input id={`lim-${key}`} value={limits[key as keyof typeof limits]}
                          onChange={(e) => setLimits((p) => ({ ...p, [key]: e.target.value }))} className="h-9" />
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400">
                      Usá <code className="rounded bg-muted px-1">Ilimitado</code> para sin tope.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: Features */}
              {step === 3 && (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Módulos habilitados</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-bold text-emerald-600">{enabledCount}</span> de {FEATURE_LIST.length} seleccionados
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEnabled(new Set(FEATURE_LIST.map(f => f.label)))}
                        className="text-[10px] font-bold text-violet-600 hover:underline">Todos</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => setEnabled(new Set())}
                        className="text-[10px] font-bold text-slate-400 hover:underline">Ninguno</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FEATURE_LIST.map(({ label, icon }) => (
                      <FeatureToggle key={label} label={label} icon={icon}
                        enabled={enabledFeatures.has(label)} onToggle={() => toggle(label)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {availableTiers.length > 0 && (
          <div className="flex items-center justify-between border-t bg-slate-50/80 px-6 py-4 dark:bg-slate-900/50">
            <Button type="button" variant="ghost" size="sm"
              onClick={() => step === 0 ? close() : setStep((s) => s - 1)}
              className="gap-1.5 text-slate-500 hover:text-slate-700"
            >
              {step === 0 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4" /> Anterior</>}
            </Button>

            <div className="flex items-center gap-3">
              {/* Progress dots */}
              <div className="flex gap-1">
                {STEP_LABELS.map((_, i) => (
                  <div key={i} className={cn('h-1.5 rounded-full transition-all',
                    i === step ? 'w-5 bg-violet-600' : i < step ? 'w-1.5 bg-violet-300' : 'w-1.5 bg-slate-200'
                  )} />
                ))}
              </div>

              {step < STEP_LABELS.length - 1 ? (
                <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1.5">
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={create} disabled={loading}
                  className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Crear plan
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
