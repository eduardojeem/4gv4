'use client'

import { parseFixedInstallmentInput } from '@/lib/credits/plan-definition'

import { useMemo, useRef, useState } from 'react'
import {
  Check, Coins, Loader2, Percent, Plus, RotateCcw, Save, ShieldCheck, Tag, Trash2, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { CreditPlanDefault, ProductCreditDefaults } from '@/types/website-settings'
import {
  CREDIT_BASE_LABELS,
  buildCreditPlanPreviews,
  creditDefaultsWarnings,
} from '@/lib/credits/product-credit-defaults'
import { MAX_CREDIT_INSTALLMENTS, MAX_CREDIT_INTEREST_RATE } from '@/lib/credits/installments'
import { normalizeCreditPosPolicy, type CreditPosPolicy } from '@/lib/credits/pos-credit-policy'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ProductCreditDefaultsSchema } from '@/lib/validation/website-settings'
import { useUnsavedCreditDefaults } from '@/hooks/use-unsaved-credit-defaults'
import { CreditSectionExample } from './CreditSectionExample'

const FREQUENCY_LABELS: Record<ProductCreditDefaults['frequency'], string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

const PLAN_PRESETS = [2, 3, 4, 6, 9, 12, 18, 24]

/** Precio de ejemplo para la vista previa cuando no hay un producto real. */
const SAMPLE_SALE_PRICE = 1_000_000
const SAMPLE_PURCHASE_PRICE = 600_000

export function ProductCreditDefaultsEditor() {
  const { settings, isLoading, error, isSaving, updateSetting, refetch, creditDefaultsRevision, organizationId } = useAdminWebsiteSettings()
  const editVersion = useRef<{ revision?: string; organizationId?: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [customCount, setCustomCount] = useState('')
  const [exampleOffer, setExampleOffer] = useState(false)
  const [numericDraft, setNumericDraft] = useState<Record<string, string>>({})
  const fallback = getWebsiteSettingsDefaults().product_credit_defaults!
  const [draft, setDraft] = useState<ProductCreditDefaults | null>(null)

  const saved = settings?.product_credit_defaults ?? fallback
  const current = draft ?? saved
  const hasChanges = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved)
  const [pending, setPending] = useState(false)
  const saveLock = useRef(false)
  const busy = pending || isSaving
  const validation = ProductCreditDefaultsSchema.safeParse(current)
  const fieldErrors: Record<string, string> = validation.success ? {} : Object.fromEntries(validation.error.issues.map(issue => [issue.path.join('.'), issue.code === 'invalid_type' ? 'Ingresá un número válido.' : issue.message]))
  useUnsavedCreditDefaults(hasChanges)
  const numberValue = (value: string) => value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'))
  const numberText = (value: number, key: string) => numericDraft[key] ?? (Number.isFinite(value) ? String(value) : '')
  const editNumber = (key: string, raw: string, apply: (value: number) => void) => { setNumericDraft(previous => ({ ...previous, [key]: raw })); apply(numberValue(raw)) }
  const errorFor = (key: string) => fieldErrors[key] ? <p id={key + '-error'} aria-live="polite" className="mt-1 text-xs text-destructive">{fieldErrors[key]}</p> : null


  const patch = <K extends keyof ProductCreditDefaults>(key: K, value: ProductCreditDefaults[K]) => {
    if (!editVersion.current) editVersion.current = { revision: creditDefaultsRevision, organizationId }
    setSaveError(null)
    setDraft((previous) => ({ ...(previous ?? current), [key]: value }))
  }

  const setPlans = (plans: CreditPlanDefault[]) => patch('plans', plans)

  const posPolicy = current.posPolicy ?? normalizeCreditPosPolicy(undefined)
  const patchPolicy = (changes: Partial<CreditPosPolicy>) => patch('posPolicy', { ...posPolicy, ...changes })

  const customCountError = !customCount ? null : !Number.isInteger(Number(customCount)) || Number(customCount) < 1 || Number(customCount) > MAX_CREDIT_INSTALLMENTS ? 'Ingresá una cantidad entera entre 1 y ' + MAX_CREDIT_INSTALLMENTS + '.' : current.plans.some(plan => plan.count === Number(customCount)) ? 'Ya existe un plan con esa cantidad.' : current.plans.length >= 12 ? 'Podés configurar hasta 12 planes.' : null

  const addPlan = (count: number) => {
    if (!Number.isInteger(count) || count < 1 || count > MAX_CREDIT_INSTALLMENTS || current.plans.length >= 12 || current.plans.some((plan) => plan.count === count)) return
    setPlans([...current.plans, { count, rate: 0 }].sort((a, b) => a.count - b.count))
  }

  const removePlan = (count: number) => {
    setNumericDraft(previous => { const next = { ...previous }; delete next['plan.' + count]; delete next['amount.' + count]; return next })
    setPlans(current.plans.filter((plan) => plan.count !== count))
  }

  const setPlanRate = (count: number, rate: number) => {
    setPlans(current.plans.map((plan) => (plan.count === count ? { ...plan, rate } : plan)))
  }

  const setPlanMode = (count: number, mode: 'percent' | 'amount') => {
    const row = preview.previews.find(plan => plan.count === count)
    setNumericDraft(previous => { const next = { ...previous }; delete next['plan.' + count]; delete next['amount.' + count]; return next })
    setPlans(current.plans.map(plan => plan.count !== count ? plan : mode === 'amount'
      ? { count, rate: 0, mode: 'amount', installmentAmount: Math.max(1, Math.ceil((row?.financedTotal ?? SAMPLE_SALE_PRICE) / count)) }
      : { count, rate: Math.max(0, Math.min(MAX_CREDIT_INTEREST_RATE, row?.rate ?? 0)) }))
  }

  // Vista previa en vivo sobre un producto de ejemplo, para ver el efecto de
  // cambiar la base sin tener que abrir un producto real.
  const preview = useMemo(
    () => buildCreditPlanPreviews(
      {
        purchase_price: SAMPLE_PURCHASE_PRICE,
        sale_price: SAMPLE_SALE_PRICE,
        offer_price: SAMPLE_SALE_PRICE * 0.8,
        has_offer: exampleOffer,
      },
      current,
    ),
    [current, exampleOffer],
  )

  const handleSave = async () => {
    if (!draft) return

    if (saveLock.current || !validation.success) return
    saveLock.current = true
    setPending(true)
    setSaveError(null)
    try {
      const normalized = validation.data
      const result = await updateSetting('product_credit_defaults', normalized, editVersion.current ?? { revision: creditDefaultsRevision, organizationId })
      if (!result.success) {
        setSaveError(result.error || 'No se pudo guardar. Tu borrador se conserva.')
        toast.error(result.error || 'No se pudieron guardar los datos predeterminados')
        return
      }
      toast.success('Datos predeterminados guardados', { icon: <Check className="h-4 w-4" /> })
      setDraft(null); setNumericDraft({})
      editVersion.current = null
    } catch {
      setSaveError('No se pudo confirmar el guardado. Tu borrador se conserva; recargá para comprobar el estado.')
    } finally { saveLock.current = false; setPending(false) }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const isForbidden = /403|forbidden|permiso|unauthorized|401/i.test(error)
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No se pudo cargar la configuración
          </p>
          <p className="text-xs text-muted-foreground">
            {isForbidden
              ? 'Necesitás rol de administrador para editar los datos predeterminados.'
              : error}
          </p>
          {!isForbidden && (
            <Button type="button" variant="outline" size="sm" className="mx-auto" onClick={() => void refetch()}>
              Reintentar
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <fieldset aria-label="Predeterminados de cuotas" aria-busy={busy} disabled={busy} className="min-w-0 space-y-5">
      {/* ── Interruptor general ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="credit-defaults-enabled" className="text-sm font-bold">
                  Ofrecer planes predeterminados
                </Label>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px]',
                    current.enabled
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {current.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
                {hasChanges && (
                  <Badge variant="secondary" className="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Sin guardar
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Al activar cuotas en un producto, podés aplicar estos planes o cargar otros.
              </p>
            </div>
          </div>
          <Switch
            id="credit-defaults-enabled"
            checked={current.enabled}
            onCheckedChange={(value) => patch('enabled', value)}
            aria-label="Ofrecer los datos predeterminados al activar cuotas"
          />
        </CardContent>
        <div className="px-6 pb-5"><CreditSectionExample section="activar los predeterminados"><p>Si tenés un plan de 6 cuotas con 20% de recargo, al activar cuotas en un producto podés elegir ese plan y copiarlo. Si apagás esta opción, los productos que ya tenían cuotas las conservan.</p></CreditSectionExample></div>
      </Card>

      {/* ── Planes ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-primary" />
            Planes de cuotas
          </h2>
          <p className="text-xs text-muted-foreground">
            Elegí porcentaje o monto fijo para cada plan. La vista previa usa un producto de ejemplo
            de {formatCurrency(SAMPLE_SALE_PRICE)} de venta y {formatCurrency(SAMPLE_PURCHASE_PRICE)} de costo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Agregar:</span>
            {PLAN_PRESETS.map((count) => {
              const already = current.plans.some((plan) => plan.count === count)
              return (
                <button
                  key={count}
                  type="button"
                  disabled={already || current.plans.length >= 12}
                  onClick={() => addPlan(count)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition-colors',
                    already
                      ? 'cursor-default border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900',
                  )}
                >
                  {already ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {count}c
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-end gap-2"><div className="space-y-1"><Label htmlFor="new-plan-count" className="text-xs">Otra cantidad (1–{MAX_CREDIT_INSTALLMENTS})</Label><Input id="new-plan-count" aria-invalid={Boolean(customCountError)} aria-describedby={customCountError ? 'new-plan-count-error' : undefined} inputMode="numeric" value={customCount} onChange={event => setCustomCount(event.target.value)} className="h-11 w-40" /></div><Button type="button" variant="outline" className="h-11" disabled={!Number.isInteger(Number(customCount)) || Number(customCount) < 1 || Number(customCount) > MAX_CREDIT_INSTALLMENTS || current.plans.some(plan => plan.count === Number(customCount)) || current.plans.length >= 12} onClick={() => { addPlan(Number(customCount)); setCustomCount('') }}>Agregar plan</Button><p className="w-full text-xs text-muted-foreground">Hasta 12 planes, sin repetir cantidades. El recargo es total, no mensual.</p></div>
          {customCountError && <p id="new-plan-count-error" className="text-xs text-destructive">{customCountError}</p>}
          {!!fieldErrors.plans && <p role="alert" className="text-sm text-destructive">{fieldErrors.plans}</p>}
          {!validation.success && <p role="status" className="text-sm text-destructive">Corregí los campos marcados antes de guardar; el ejemplo puede estar incompleto.</p>}

          {current.plans.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin planes configurados</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agregá al menos uno para poder ofrecerlos al activar cuotas en un producto.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {preview.previews.map(row => {
                const index = current.plans.findIndex(plan => plan.count === row.count)
                const fixed = current.plans[index]?.mode === 'amount'
                const key = 'plans.' + index + (fixed ? '.installmentAmount' : '.rate')
                return <article key={row.count} data-testid={'plan-row-' + row.count} className="min-w-0 rounded-xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{row.count} cuotas</h3><Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label={'Quitar el plan de ' + row.count + ' cuotas'} onClick={() => removePlan(row.count)}><Trash2 className="h-4 w-4" /></Button></div>
                  <div role="group" aria-label={'Tipo del plan de ' + row.count + ' cuotas'} className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1"><Button type="button" variant={!fixed ? 'secondary' : 'ghost'} className="h-11 text-xs" aria-pressed={!fixed} onClick={() => setPlanMode(row.count, 'percent')}>Porcentaje</Button><Button type="button" variant={fixed ? 'secondary' : 'ghost'} className="h-11 text-xs" aria-pressed={fixed} onClick={() => setPlanMode(row.count, 'amount')}>Monto fijo</Button></div>
                  <Label htmlFor={'plan-rate-' + row.count} className="text-xs">{fixed ? 'Monto fijo de cada cuota' : 'Recargo total (%)'}</Label>
                  <Input id={'plan-rate-' + row.count} type="text" inputMode="decimal" aria-label={(fixed ? 'Monto fijo' : 'Recargo') + ' del plan de ' + row.count + ' cuotas'} value={fixed ? numberText(current.plans[index]?.installmentAmount ?? 0, 'amount.' + row.count) : numberText(current.plans[index]?.rate ?? 0, 'plan.' + row.count)} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? key + '-error' : undefined} onChange={event => {
                    if (fixed) {
                      const raw = event.target.value
                      setNumericDraft(previous => ({ ...previous, ['amount.' + row.count]: raw }))
                      setPlans(current.plans.map(plan => plan.count === row.count ? { ...plan, rate: 0, installmentAmount: parseFixedInstallmentInput(raw) } : plan))
                    } else editNumber('plan.' + row.count, event.target.value, value => setPlanRate(row.count, value))
                  }} className="mt-1 h-11" />
                  {errorFor(key)}
                  {row.error && <p role="status" className="mt-3 text-xs text-destructive">Con el importe del ejemplo: {row.error}</p>}
                  {fixed && !row.error && <p className="mt-2 text-xs text-muted-foreground">Recargo equivalente del ejemplo: {row.rate}%</p>}
                  {fixed && <p className="mt-2 text-xs text-muted-foreground">El monto queda fijo al aplicarlo a otro producto. Se verifica que cubra su precio y respete los límites.</p>}
                  <div className="mt-4 space-y-1 text-xs text-muted-foreground"><p>Cuota de ejemplo <strong className="text-foreground">{formatCurrency(row.installmentAmount)}</strong></p>{row.lastInstallmentAmount !== row.installmentAmount && <p>Última cuota: {formatCurrency(row.lastInstallmentAmount)}</p>}<p>Total con entrega: {formatCurrency(row.totalWithDownPayment)}</p><p>{FREQUENCY_LABELS[current.frequency]} · simulación</p></div>
                </article>
              })}
            </div>
          )}

          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Base usada: {CREDIT_BASE_LABELS[preview.base.source]} — {formatCurrency(preview.base.baseAmount)}
            </p>
            {preview.base.downPayment > 0 && (
              <p className="mt-0.5 text-muted-foreground">
                Entrega inicial {formatCurrency(preview.base.downPayment)} · se financian {formatCurrency(preview.base.financedAmount)}
              </p>
            )}
          </div>
          <CreditSectionExample section="planes por porcentaje o por monto"><p><strong>Por porcentaje:</strong> sobre Gs. 1.000.000, un recargo total del 20% da Gs. 1.200.000: 6 cuotas de Gs. 200.000.</p><p><strong>Por monto:</strong> 6 cuotas de Gs. 200.000 también suman Gs. 1.200.000. El recargo equivalente depende del importe que se financia; el mismo monto no sirve para todos los precios.</p></CreditSectionExample>
        </CardContent>
      </Card>

      {/* ── Base de cálculo ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-primary" />
            Cómo se calcula · simulador
          </h2>
          <p className="text-xs text-muted-foreground">
            Elegí una base para el ejemplo. No cambia el precio ni la base real usada por el POS o la tienda.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['sale', 'cost'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => patch('calculationBase', option)}
                aria-pressed={current.calculationBase === option}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  current.calculationBase === option
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                )}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {option === 'sale' ? 'Precio de venta' : 'Precio de costo'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {option === 'sale'
                    ? 'Simula con el precio de venta del ejemplo.'
                    : 'Simula con el costo y el margen que definas.'}
                </p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><Label htmlFor="example-offer" className="text-sm">Probar una oferta de ejemplo de {formatCurrency(SAMPLE_SALE_PRICE * 0.8)}</Label><Switch id="example-offer" checked={exampleOffer} onCheckedChange={setExampleOffer} /></div>
          {current.calculationBase === 'sale' ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
              <div>
                <Label htmlFor="respect-offer" className="text-sm font-semibold">Respetar el precio de oferta</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Solo cambia la simulación cuando el ejemplo tiene una oferta.
                </p>
              </div>
              <Switch
                id="respect-offer"
                checked={current.respectOffer}
                onCheckedChange={(value) => patch('respectOffer', value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cost-markup" className="text-xs font-medium">Margen sobre el costo (%)</Label>
              <Input
                id="cost-markup"
                type="text"
                inputMode="decimal"
                min={0}
                max={1000}
                value={numberText(current.costMarkupPercent, 'costMarkupPercent')}
                aria-invalid={Boolean(fieldErrors['costMarkupPercent'])}
                aria-describedby={fieldErrors['costMarkupPercent'] ? 'costMarkupPercent-error' : undefined}
                onChange={(event) => editNumber('costMarkupPercent', event.target.value, value => patch('costMarkupPercent', value))}
                className="h-9 max-w-[200px]"
              />
              {errorFor('costMarkupPercent')}
              <p className="text-[11px] text-muted-foreground">
                0% financia el costo puro. Con 25%, un costo de {formatCurrency(SAMPLE_PURCHASE_PRICE)} financia {formatCurrency(SAMPLE_PURCHASE_PRICE * 1.25)}.
              </p>
            </div>
          )}
          <CreditSectionExample section="la base del simulador"><p>Con costo de Gs. 600.000 y margen del 25%, la base del ejemplo es Gs. 750.000. Con precio de venta de Gs. 1.000.000, la base es Gs. 1.000.000.</p><p>Si probás una oferta de Gs. 800.000 y activás «Respetar el precio de oferta», la simulación usa Gs. 800.000. Estas elecciones no cambian el precio real del producto ni el saldo de una venta.</p></CreditSectionExample>
        </CardContent>
      </Card>

      {/* ── Condiciones ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-primary" />
            Frecuencia y entrega
          </h2>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Frecuencia de los planes globales del POS</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FREQUENCY_LABELS) as ProductCreditDefaults['frequency'][]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => patch('frequency', option)}
                  aria-pressed={current.frequency === option}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    current.frequency === option
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900',
                  )}
                >
                  {FREQUENCY_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="down-payment" className="text-xs font-medium">Entrega inicial (%)</Label>
            <Input
              id="down-payment"
              type="text"
              inputMode="decimal"
              min={0}
              max={90}
              value={numberText(current.downPaymentPercent, 'downPaymentPercent')}
                aria-invalid={Boolean(fieldErrors['downPaymentPercent'])}
                aria-describedby={fieldErrors['downPaymentPercent'] ? 'downPaymentPercent-error' : undefined}
              onChange={(event) => editNumber('downPaymentPercent', event.target.value, value => patch('downPaymentPercent', value))}
              className="h-9"
            />
              {errorFor('downPaymentPercent')}
            <p className="text-[11px] text-muted-foreground">Solo para el ejemplo. Para exigir una entrega al vender, configurá la entrega mínima del POS. Máximo 90%.</p>
          </div>


          <CreditSectionExample section="frecuencia y entrega"><p>6 cuotas semanales se distribuyen en ciclos de 7 días; 6 mensuales, en ciclos mensuales. La frecuencia global se ofrece en el POS; los planes copiados al producto y la tienda pública se muestran mensuales.</p><p>En una simulación de Gs. 1.000.000, una entrega del 20% son Gs. 200.000 y quedan Gs. 800.000 para financiar. Para exigir esa entrega al vender, configurá el mínimo en las reglas del POS.</p></CreditSectionExample>
        </CardContent>
      </Card>

      {/* ── Reglas del POS ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Reglas para vender a crédito en el POS
          </h2>
          <p className="text-xs text-muted-foreground">
            Las aplica el servidor en cada venta, en la web y en la app. Dueños y administradores pueden salirse
            de estas reglas; esas ventas quedan marcadas.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="pos-custom-terms" className="text-sm font-semibold">El cajero puede cambiar las condiciones</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Apagado: solo se venden los planes del producto o los planes de esta página.
              </p>
            </div>
            <Switch
              id="pos-custom-terms"
              checked={posPolicy.allowCustomTerms}
              onCheckedChange={(value) => patchPolicy({ allowCustomTerms: value })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="pos-installment-amounts" className="text-sm font-semibold">Permitir cuotas por monto</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Además del recargo %, cargar el valor de cada cuota (por ejemplo, 10 cuotas de Gs. 150.000) o montos a mano.
              </p>
            </div>
            <Switch
              id="pos-installment-amounts"
              checked={posPolicy.allowInstallmentAmounts}

              onCheckedChange={(value) => patchPolicy({ allowInstallmentAmounts: value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-max-rate" className="text-xs font-medium">Recargo máximo personalizado (%)</Label>
            <Input
              id="pos-max-rate"
              type="text"
              inputMode="decimal"
              min={0}
              max={MAX_CREDIT_INTEREST_RATE}
              value={numberText(posPolicy.maxInterestRate, 'posPolicy.maxInterestRate')}
              aria-invalid={Boolean(fieldErrors['posPolicy.maxInterestRate'])}
              aria-describedby={fieldErrors['posPolicy.maxInterestRate'] ? 'posPolicy.maxInterestRate-error' : undefined}
              onChange={(event) => editNumber('posPolicy.maxInterestRate', event.target.value, value => patchPolicy({ maxInterestRate: value }))}
              className="h-9"
            />
            {errorFor('posPolicy.maxInterestRate')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-max-installments" className="text-xs font-medium">Máximo de cuotas personalizadas</Label>
            <Input
              id="pos-max-installments"
              type="text"
              inputMode="numeric"
              min={1}
              max={MAX_CREDIT_INSTALLMENTS}
              value={numberText(posPolicy.maxInstallments, 'posPolicy.maxInstallments')}
              aria-invalid={Boolean(fieldErrors['posPolicy.maxInstallments'])}
              aria-describedby={fieldErrors['posPolicy.maxInstallments'] ? 'posPolicy.maxInstallments-error' : undefined}
              onChange={(event) => editNumber('posPolicy.maxInstallments', event.target.value, value => patchPolicy({ maxInstallments: value }))}
              className="h-9"
            />
            {errorFor('posPolicy.maxInstallments')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-min-down" className="text-xs font-medium">Entrega mínima en el POS (%)</Label>
            <Input
              id="pos-min-down"
              type="text"
              inputMode="decimal"
              min={0}
              max={90}
              value={numberText(posPolicy.minDownPaymentPercent, 'posPolicy.minDownPaymentPercent')}
              aria-invalid={Boolean(fieldErrors['posPolicy.minDownPaymentPercent'])}
              aria-describedby={fieldErrors['posPolicy.minDownPaymentPercent'] ? 'posPolicy.minDownPaymentPercent-error' : undefined}
              onChange={(event) => editNumber('posPolicy.minDownPaymentPercent', event.target.value, value => patchPolicy({ minDownPaymentPercent: value }))}
              className="h-9"
            />
            {errorFor('posPolicy.minDownPaymentPercent')}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Frecuencias permitidas</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FREQUENCY_LABELS) as ProductCreditDefaults['frequency'][]).map((option) => {
                const active = posPolicy.allowedFrequencies.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = active
                        ? posPolicy.allowedFrequencies.filter((frequency) => frequency !== option)
                        : [...posPolicy.allowedFrequencies, option]
                      if (next.length > 0) patchPolicy({ allowedFrequencies: next })
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                  >
                    {FREQUENCY_LABELS[option]}
                  </button>
                )
              })}
            </div>
          </div>
          <CreditSectionExample section="las reglas del cajero"><p>Si permitís condiciones personalizadas con máximo de 6 cuotas y 15% de recargo, un cajero no puede confirmar 12 cuotas o 20%. Una entrega mínima del 20% exige Gs. 200.000 en una venta de Gs. 1.000.000.</p><p>Con «Solo planes configurados», sus cantidades, recargos y frecuencias se aceptan como excepciones a los máximos personalizados. Dueños y administradores pueden autorizar excepciones; el servidor las registra.</p></CreditSectionExample>
        </CardContent>
      </Card>

      {creditDefaultsWarnings(current).length > 0 && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><p className="font-semibold">Revisá la coherencia de tus planes</p><ul className="mt-2 list-disc space-y-1 pl-5">{creditDefaultsWarnings(current).map(message => <li key={message}>{message}</li>)}</ul></div>}
      <p className="text-xs text-muted-foreground">Los planes del producto y la tienda usan frecuencia mensual. La frecuencia global se ofrece además en el POS.</p>
      <Card><CardHeader><h2 className="font-semibold text-base">Tienda pública</h2><p className="text-xs text-muted-foreground">Esta preferencia se copia al aplicar predeterminados en un producto. No modifica productos existentes. La tienda calcula sobre el precio efectivo y muestra cuotas mensuales.</p></CardHeader><CardContent>          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="public-by-default" className="text-sm font-semibold">Mostrar en la tienda pública</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Al aplicar predeterminados, marca las cuotas de ese producto como visibles en la tienda.
              </p>
            </div>
            <Switch
              id="public-by-default"
              checked={current.publicByDefault}
              onCheckedChange={(value) => patch('publicByDefault', value)}
            />
          </div><CreditSectionExample section="mostrar cuotas en la tienda"><p>Al aplicar predeterminados con esta opción activa, ese producto queda marcado para mostrar sus planes en la tienda. Si después apagás la opción, el producto existente no cambia: tenés que editar su visibilidad individual.</p></CreditSectionExample></CardContent></Card>
      {saveError && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p className="text-destructive">{saveError}</p><Button type="button" variant="outline" className="mt-3" onClick={async () => { try { await refetch(); setDraft(null); setNumericDraft({}); editVersion.current = null; setSaveError(null) } catch { setSaveError('No se pudo recargar. Tu borrador se conserva.') } }}>Descartar y recargar</Button></div>}
      <CreditSectionExample section="guardar o descartar"><p>Si cambiás un recargo de 10% a 15%, «Guardar» lo deja disponible para los próximos usos. «Descartar» vuelve al último valor guardado. Si otro administrador guardó antes, se conserva tu borrador y se pide recargar para no sobrescribirlo.</p></CreditSectionExample>
      {/* ── Acciones ────────────────────────────────────────────────────────── */}
      {(hasChanges || busy) && <div className="sticky bottom-4 grid grid-cols-2 items-center gap-2 sm:flex sm:justify-end rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <p className="sr-only text-xs text-muted-foreground sm:not-sr-only sm:mr-auto" aria-live="polite">{busy ? 'Guardando…' : hasChanges ? 'Cambios pendientes' : 'Sin cambios pendientes'}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setDraft(null); setNumericDraft({}); editVersion.current = null; setSaveError(null) }}
          disabled={!hasChanges || busy}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Descartar
        </Button>
        <Button aria-label="Guardar cambios" type="button" size="sm" onClick={handleSave} disabled={!hasChanges || busy || !validation.success} className="gap-2">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar<span className="hidden sm:inline"> cambios</span>
        </Button>
      </div>}
    </fieldset>
  )
}
