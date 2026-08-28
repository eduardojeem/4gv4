'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Coins, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { calculateBasePoints } from '@/lib/loyalty/points'
import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettingsRow } from '@/hooks/use-loyalty'

interface LoyaltySettingsCardProps {
  settings: LoyaltySettingsRow | null
  onSave: (values: Omit<LoyaltySettingsRow, 'organization_id'>) => Promise<boolean>
  canManage: boolean
}

/** Importe de ejemplo para que la tasa deje de ser un número abstracto. */
const PREVIEW_AMOUNT = 150_000

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

  const preview = calculateBasePoints(PREVIEW_AMOUNT, {
    enabled: true,
    currencyPerPoint: Number(draft.currency_per_point) || 1,
    pointsPerUnit: Number(draft.points_per_unit) || 1,
    rounding: draft.rounding,
  })

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
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                  Acumulación de Puntos en Caja (POS)
                </CardTitle>
                <Badge
                  variant={draft.enabled ? 'default' : 'secondary'}
                  className={draft.enabled ? 'bg-emerald-500 text-white font-bold text-[10px]' : 'text-[10px]'}
                >
                  {draft.enabled ? 'Sistema Activo' : 'Pausado'}
                </Badge>
              </div>
              <CardDescription className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Define cuántos puntos reciben los clientes al identificarse y comprar en caja. Se acreditan automáticamente.
              </CardDescription>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 bg-slate-50 dark:bg-slate-900 p-1.5 px-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <Label htmlFor="loyalty-enabled" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {draft.enabled ? 'Puntos habilitados' : 'Desactivado'}
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

      <CardContent className="space-y-6 pt-5">
        {/* Tasa base */}
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency-per-point" className="text-xs font-semibold">
                Monto de Compra Necesario (Moneda)
              </Label>
              <Input
                id="currency-per-point"
                type="number"
                min={1}
                step={1000}
                value={draft.currency_per_point}
                disabled={!canManage}
                onChange={(e) => setDraft((d) => ({ ...d, currency_per_point: Number(e.target.value) }))}
                className="rounded-xl text-xs font-semibold bg-white dark:bg-slate-950 h-10"
              />
              <p className="text-[10px] text-slate-500">Ej: 10.000 Gs de compra</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="points-per-unit" className="text-xs font-semibold">
                Puntos Otorgados
              </Label>
              <Input
                id="points-per-unit"
                type="number"
                min={1}
                value={draft.points_per_unit}
                disabled={!canManage}
                onChange={(e) => setDraft((d) => ({ ...d, points_per_unit: Number(e.target.value) }))}
                className="rounded-xl text-xs font-semibold bg-white dark:bg-slate-950 h-10"
              />
              <p className="text-[10px] text-slate-500">Puntos acreditados por cada tramo</p>
            </div>
          </div>

          {/* Simulador Interactivo en Vivo de Puntos */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-600" />
                Simulador en Vivo de Acreditación de Puntos:
              </span>
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Tasa: Gs. {Number(draft.currency_per_point || 10000).toLocaleString('es-PY')} = {draft.points_per_unit || 1} pt
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-amber-100 dark:border-amber-900/30 shadow-2xs">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Compra Pequeña</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Gs. 50.000</span>
                <p className="text-amber-700 dark:text-amber-300 font-extrabold text-sm mt-0.5">
                  +{calculateBasePoints(50_000, {
                    enabled: true,
                    currencyPerPoint: Number(draft.currency_per_point) || 1,
                    pointsPerUnit: Number(draft.points_per_unit) || 1,
                    rounding: draft.rounding,
                  })} pts
                </p>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-amber-100 dark:border-amber-900/30 shadow-2xs">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Compra Media</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Gs. 150.000</span>
                <p className="text-amber-700 dark:text-amber-300 font-extrabold text-sm mt-0.5">
                  +{calculateBasePoints(150_000, {
                    enabled: true,
                    currencyPerPoint: Number(draft.currency_per_point) || 1,
                    pointsPerUnit: Number(draft.points_per_unit) || 1,
                    rounding: draft.rounding,
                  })} pts
                </p>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-amber-100 dark:border-amber-900/30 shadow-2xs">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Compra Mayor</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Gs. 500.000</span>
                <p className="text-amber-700 dark:text-amber-300 font-extrabold text-sm mt-0.5">
                  +{calculateBasePoints(500_000, {
                    enabled: true,
                    currencyPerPoint: Number(draft.currency_per_point) || 1,
                    pointsPerUnit: Number(draft.points_per_unit) || 1,
                    rounding: draft.rounding,
                  })} pts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reglas avanzadas */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Reglas de Redondeo y Vencimiento
          </h4>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rounding" className="text-xs font-semibold">Cálculo de Fracciones</Label>
              <Select
                value={draft.rounding}
                disabled={!canManage}
                onValueChange={(value) => setDraft((d) => ({ ...d, rounding: value as 'floor' | 'round' }))}
              >
                <SelectTrigger id="rounding" className="rounded-xl text-xs h-9.5"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="floor">Truncar hacia abajo (ej: 14.5 → 14)</SelectItem>
                  <SelectItem value="round">Redondear al más cercano (ej: 14.5 → 15)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="daily-cap" className="text-xs font-semibold">Tope Máximo Diario por Cliente</Label>
              <Input
                id="daily-cap"
                type="number"
                min={1}
                placeholder="Sin tope (ilimitado)"
                value={draft.max_points_per_customer_per_day ?? ''}
                disabled={!canManage}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    max_points_per_customer_per_day: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="rounded-xl text-xs h-9.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiration" className="text-xs font-semibold">Vencimiento de Saldo (Meses)</Label>
              <Input
                id="expiration"
                type="number"
                min={1}
                placeholder="No vencen nunca"
                value={draft.points_expiration_months ?? ''}
                disabled={!canManage}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    points_expiration_months: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="rounded-xl text-xs h-9.5"
              />
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs h-9 px-5 shadow-md shadow-cyan-600/20"
            >
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar Configuración de Puntos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
