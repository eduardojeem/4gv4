'use client'

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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-amber-500" />
              Acumulación de puntos
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Cuántos puntos deja cada compra. Se acreditan solos al cobrar en el POS.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor="loyalty-enabled" className="text-xs font-semibold">
              {draft.enabled ? 'Activo' : 'Apagado'}
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

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currency-per-point" className="text-xs">Moneda necesaria por punto</Label>
            <Input
              id="currency-per-point"
              type="number"
              min={1}
              value={draft.currency_per_point}
              disabled={!canManage}
              onChange={(e) => setDraft((d) => ({ ...d, currency_per_point: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="points-per-unit" className="text-xs">Puntos que otorga</Label>
            <Input
              id="points-per-unit"
              type="number"
              min={1}
              value={draft.points_per_unit}
              disabled={!canManage}
              onChange={(e) => setDraft((d) => ({ ...d, points_per_unit: Number(e.target.value) }))}
            />
          </div>
        </div>

        {/* La tasa sola no dice nada: se muestra traducida a una compra real. */}
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-3.5 py-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-amber-900 dark:text-amber-200">
            Una compra de <strong>{formatCurrency(PREVIEW_AMOUNT)}</strong> deja{' '}
            <strong>{preview} punto{preview === 1 ? '' : 's'}</strong>.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rounding" className="text-xs">Fracciones</Label>
            <Select
              value={draft.rounding}
              disabled={!canManage}
              onValueChange={(value) => setDraft((d) => ({ ...d, rounding: value as 'floor' | 'round' }))}
            >
              <SelectTrigger id="rounding"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="floor">Truncar (hacia abajo)</SelectItem>
                <SelectItem value="round">Redondear</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="daily-cap" className="text-xs">Tope diario por cliente</Label>
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
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expiration" className="text-xs">Vencen a los (meses)</Label>
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
            />
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar configuración
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
