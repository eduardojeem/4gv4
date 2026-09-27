'use client'

import { useMemo, useState } from 'react'
import {
  Check, Coins, Loader2, Percent, Plus, RotateCcw, Save, Tag, Trash2, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { CreditPlanDefault, ProductCreditDefaults } from '@/types/website-settings'
import {
  CREDIT_BASE_LABELS,
  buildCreditPlanPreviews,
} from '@/lib/credits/product-credit-defaults'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const FREQUENCY_LABELS: Record<ProductCreditDefaults['frequency'], string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

const PLAN_PRESETS = [2, 3, 4, 6, 9, 12, 18, 24]

/** Precio de ejemplo para la vista previa cuando no hay un producto real. */
const SAMPLE_SALE_PRICE = 1_000_000
const SAMPLE_PURCHASE_PRICE = 600_000

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function ProductCreditDefaultsEditor() {
  const { settings, isLoading, error, isSaving, updateSetting, refetch } = useAdminWebsiteSettings()
  const fallback = getWebsiteSettingsDefaults().product_credit_defaults!
  const [draft, setDraft] = useState<ProductCreditDefaults | null>(null)

  const saved = settings?.product_credit_defaults ?? fallback
  const current = draft ?? saved
  const hasChanges = draft !== null

  const patch = <K extends keyof ProductCreditDefaults>(key: K, value: ProductCreditDefaults[K]) => {
    setDraft((previous) => ({ ...(previous ?? current), [key]: value }))
  }

  const setPlans = (plans: CreditPlanDefault[]) => patch('plans', plans)

  const addPlan = (count: number) => {
    if (current.plans.some((plan) => plan.count === count)) return
    setPlans([...current.plans, { count, rate: 0 }].sort((a, b) => a.count - b.count))
  }

  const removePlan = (count: number) => {
    setPlans(current.plans.filter((plan) => plan.count !== count))
  }

  const setPlanRate = (count: number, rate: number) => {
    setPlans(current.plans.map((plan) => (plan.count === count ? { ...plan, rate } : plan)))
  }

  // Vista previa en vivo sobre un producto de ejemplo, para ver el efecto de
  // cambiar la base sin tener que abrir un producto real.
  const preview = useMemo(
    () => buildCreditPlanPreviews(
      {
        purchase_price: SAMPLE_PURCHASE_PRICE,
        sale_price: SAMPLE_SALE_PRICE,
        offer_price: null,
        has_offer: false,
      },
      current,
    ),
    [current],
  )

  const handleSave = async () => {
    if (!draft) return

    const normalized: ProductCreditDefaults = {
      ...draft,
      costMarkupPercent: clamp(Number(draft.costMarkupPercent), 0, 1000, fallback.costMarkupPercent),
      downPaymentPercent: clamp(Number(draft.downPaymentPercent), 0, 90, fallback.downPaymentPercent),
      plans: [...draft.plans]
        .filter((plan) => Number.isFinite(plan.count) && plan.count >= 1)
        .map((plan) => ({
          count: Math.round(clamp(Number(plan.count), 1, 60, 1)),
          rate: clamp(Number(plan.rate), 0, 300, 0),
        }))
        .sort((a, b) => a.count - b.count),
    }

    const result = await updateSetting('product_credit_defaults', normalized)
    if (!result.success) {
      toast.error(result.error || 'No se pudieron guardar los datos predeterminados')
      return
    }
    toast.success('Datos predeterminados guardados', { icon: <Check className="h-4 w-4" /> })
    setDraft(null)
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
    <div className="space-y-5">
      {/* ── Interruptor general ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="credit-defaults-enabled" className="text-sm font-bold">
                  Ofrecer estos datos al activar cuotas
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
                Al activar cuotas en un producto se ofrece elegir entre estos datos o cargar unos nuevos.
                Si lo apagás, siempre se cargan desde cero.
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
      </Card>

      {/* ── Base de cálculo ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Base de cálculo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sobre qué precio del producto se calculan las cuotas.
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
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                )}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {option === 'sale' ? 'Precio de venta' : 'Precio de costo'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {option === 'sale'
                    ? 'Financia sobre lo que paga el cliente al contado.'
                    : 'Financia sobre lo que te costó, más el margen que definas.'}
                </p>
              </button>
            ))}
          </div>

          {current.calculationBase === 'sale' ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
              <div>
                <Label htmlFor="respect-offer" className="text-sm font-semibold">Respetar el precio de oferta</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Si el producto está en oferta, financia sobre el precio rebajado.
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
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                value={current.costMarkupPercent}
                onChange={(event) => patch('costMarkupPercent', Number(event.target.value))}
                className="h-9 max-w-[200px]"
              />
              <p className="text-[11px] text-muted-foreground">
                0% financia el costo puro. Con 25%, un costo de {formatCurrency(SAMPLE_PURCHASE_PRICE)} financia {formatCurrency(SAMPLE_PURCHASE_PRICE * 1.25)}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Condiciones ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Condiciones
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Periodicidad</Label>
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
                      ? 'border-indigo-500 bg-indigo-600 text-white'
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
              type="number"
              inputMode="decimal"
              min={0}
              max={90}
              value={current.downPaymentPercent}
              onChange={(event) => patch('downPaymentPercent', Number(event.target.value))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">Se descuenta antes de financiar. Máximo 90%.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="public-by-default" className="text-sm font-semibold">Mostrar en la tienda pública</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los productos con cuotas muestran los planes en la web, sin tener que activarlo uno por uno.
              </p>
            </div>
            <Switch
              id="public-by-default"
              checked={current.publicByDefault}
              onCheckedChange={(value) => patch('publicByDefault', value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Planes ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Planes de cuotas
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cantidad de cuotas y su recargo. La vista previa usa un producto de ejemplo
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
                  disabled={already}
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

          {current.plans.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin planes configurados</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agregá al menos uno para poder ofrecerlos al activar cuotas en un producto.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Cuotas</th>
                    <th className="pb-2 font-medium">Recargo %</th>
                    <th className="pb-2 font-medium">Valor de cuota</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {preview.previews.map((row) => (
                    <tr key={row.count} className="border-b last:border-0" data-testid={`plan-row-${row.count}`}>
                      <td className="py-2 font-semibold text-slate-900 dark:text-slate-100">{row.count}</td>
                      <td className="py-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={300}
                          step="0.1"
                          aria-label={`Recargo del plan de ${row.count} cuotas`}
                          value={current.plans.find((plan) => plan.count === row.count)?.rate ?? 0}
                          onChange={(event) => setPlanRate(row.count, Number(event.target.value))}
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="py-2 font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                        {formatCurrency(row.installmentAmount)}
                      </td>
                      <td className="py-2 tabular-nums text-muted-foreground">
                        {formatCurrency(row.totalWithDownPayment)}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          aria-label={`Quitar el plan de ${row.count} cuotas`}
                          onClick={() => removePlan(row.count)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        </CardContent>
      </Card>

      {/* ── Acciones ────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDraft(null)}
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Descartar
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
