'use client'

/**
 * Cómo se ganan los puntos.
 *
 * La tarjeta pedía seis números de entrada —monto, puntos, fracciones, tope
 * diario, vencimiento— y encima un simulador de tres columnas, todo al mismo
 * nivel. Pero para arrancar un programa de puntos hace falta decidir **una**
 * cosa: cada cuánto gasto se gana un punto. El resto son ajustes que casi
 * nadie toca y que sirven con el valor por defecto.
 *
 * Así que arriba queda esa única pregunta y la frase que se le dice al
 * cliente; lo demás está plegado abajo.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Coins, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { calculateBasePoints } from '@/lib/loyalty/points'
import { explainEarning } from '@/lib/loyalty/explain'
import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettingsRow } from '@/hooks/use-loyalty'

interface LoyaltySettingsCardProps {
  settings: LoyaltySettingsRow | null
  onSave: (values: Omit<LoyaltySettingsRow, 'organization_id'>) => Promise<boolean>
  canManage: boolean
}

/** Una compra cualquiera, para que la tasa deje de ser un número abstracto. */
const COMPRA_DE_EJEMPLO = 150_000

export function LoyaltySettingsCard({ settings, onSave, canManage }: LoyaltySettingsCardProps) {
  const [draft, setDraft] = useState(() => settings ?? DEFAULT_LOYALTY_SETTINGS)
  const [saving, setSaving] = useState(false)

  // Cuando llegan los datos del servidor se rellena el formulario. Se ajusta
  // durante el render y no en un efecto: así no hay un frame con los valores
  // por defecto antes de mostrar los reales.
  const [syncedFrom, setSyncedFrom] = useState(settings)
  if (settings && settings !== syncedFrom) {
    setSyncedFrom(settings)
    setDraft(settings)
  }

  const puntosDelEjemplo = calculateBasePoints(COMPRA_DE_EJEMPLO, {
    enabled: true,
    currencyPerPoint: Number(draft.currency_per_point) || 1,
    pointsPerUnit: Number(draft.points_per_unit) || 1,
    rounding: draft.rounding,
  })

  const regla = explainEarning(draft)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      enabled: draft.enabled,
      currency_per_point: Number(draft.currency_per_point),
      points_per_unit: Number(draft.points_per_unit),
      rounding: draft.rounding,
      max_points_per_customer_per_day: draft.max_points_per_customer_per_day
        ? Number(draft.max_points_per_customer_per_day)
        : null,
      points_expiration_months: draft.points_expiration_months
        ? Number(draft.points_expiration_months)
        : null,
    })
    setSaving(false)
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50">
                Puntos por compra
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {draft.enabled
                  ? 'Cada venta a un cliente con ficha le suma puntos sola, en caja y en la tienda.'
                  : 'Mientras esté apagado, ninguna venta suma puntos.'}
              </CardDescription>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <Label htmlFor="loyalty-enabled" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {draft.enabled ? 'Prendido' : 'Apagado'}
            </Label>
            <Switch
              id="loyalty-enabled"
              checked={draft.enabled}
              disabled={!canManage}
              onCheckedChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* La única decisión que hay que tomar para arrancar. */}
        <div className="space-y-2">
          <Label htmlFor="currency-per-point" className="text-sm font-semibold">
            ¿Cada cuánto gasto das un punto?
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="currency-per-point"
              type="number"
              min={1}
              step={1000}
              value={draft.currency_per_point}
              disabled={!canManage}
              onChange={(e) => setDraft((d) => ({ ...d, currency_per_point: Number(e.target.value) }))}
              className="h-10 w-40 rounded-xl bg-white text-sm font-semibold tabular-nums dark:bg-slate-950"
            />
            {regla && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {regla}
              </p>
            )}
          </div>

          {/* Un ejemplo con plata de verdad: es como se entiende una tasa. */}
          <p className="text-xs text-muted-foreground tabular-nums">
            Una compra de {formatCurrency(COMPRA_DE_EJEMPLO)} suma{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">
              {puntosDelEjemplo} {puntosDelEjemplo === 1 ? 'punto' : 'puntos'}
            </strong>
            .
          </p>
        </div>

        {/* Todo lo que casi nadie toca, y que anda con el valor por defecto. */}
        <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
            <span>Ajustes finos</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              <span className="group-open:hidden">Ver ↓</span>
              <span className="hidden group-open:inline">Ocultar ↑</span>
            </span>
          </summary>

          <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 dark:border-slate-800">
            <div className="space-y-1.5">
              <Label htmlFor="points-per-unit" className="text-xs font-semibold">
                Puntos por cada tramo
              </Label>
              <Input
                id="points-per-unit"
                type="number"
                min={1}
                value={draft.points_per_unit}
                disabled={!canManage}
                onChange={(e) => setDraft((d) => ({ ...d, points_per_unit: Number(e.target.value) }))}
                className="h-9.5 rounded-xl text-xs tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">Normalmente 1.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rounding" className="text-xs font-semibold">Fracciones de punto</Label>
              <Select
                value={draft.rounding}
                disabled={!canManage}
                onValueChange={(value) => setDraft((d) => ({ ...d, rounding: value as 'floor' | 'round' }))}
              >
                <SelectTrigger id="rounding" className="h-9.5 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="floor">Para abajo (14,5 → 14)</SelectItem>
                  <SelectItem value="round">Al más cercano (14,5 → 15)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="daily-cap" className="text-xs font-semibold">Tope de puntos por día y cliente</Label>
              <Input
                id="daily-cap"
                type="number"
                min={1}
                placeholder="Sin tope"
                value={draft.max_points_per_customer_per_day ?? ''}
                disabled={!canManage}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    max_points_per_customer_per_day: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="h-9.5 rounded-xl text-xs tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiration" className="text-xs font-semibold">Los puntos vencen a los (meses)</Label>
              <Input
                id="expiration"
                type="number"
                min={1}
                placeholder="No vencen"
                value={draft.points_expiration_months ?? ''}
                disabled={!canManage}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    points_expiration_months: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="h-9.5 rounded-xl text-xs tabular-nums"
              />
            </div>
          </div>
        </details>

        {canManage && (
          <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl px-5 text-xs font-semibold">
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
