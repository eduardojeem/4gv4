'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
import {
  calculateRepairPricing,
  validateRepairPricing,
  type RepairPricingMode,
} from '@/lib/repairs/pricing'
import { cn } from '@/lib/utils'
import type { Repair } from '@/types/repairs'

export interface RepairQuickPriceUpdate {
  pricingMode: RepairPricingMode
  laborCost: number
  finalCost: number | null
  discountAmount: number
  priceOverrideReason: string
}

interface RepairQuickPriceDialogProps {
  open: boolean
  repair: Repair
  onOpenChange: (open: boolean) => void
  onSave: (update: RepairQuickPriceUpdate) => Promise<boolean>
}

const MODES: Array<{ id: RepairPricingMode; label: string }> = [
  { id: 'automatic', label: 'Cálculo automático' },
  { id: 'budget', label: 'Presupuesto acordado' },
  { id: 'manual', label: 'Precio manual' },
]

const QUICK_REASONS = [
  'Descuento cliente frecuente',
  'Ajuste acordado con cliente',
  'Garantía previa / Reingreso',
  'Promoción especial vigente',
  'Descuento por demora técnica'
]

const QUICK_DISCOUNT_PERCENTAGES = [5, 10, 15, 20]

function numberFromInput(value: string): number {
  return value === '' ? 0 : Math.max(0, Number(value) || 0)
}

export function RepairQuickPriceDialog({
  ...props
}: RepairQuickPriceDialogProps) {
  return <RepairQuickPriceForm key={`${props.repair.id}-${props.open ? 'open' : 'closed'}`} {...props} />
}

function RepairQuickPriceForm({
  open,
  repair,
  onOpenChange,
  onSave,
}: RepairQuickPriceDialogProps) {
  const [pricingMode, setPricingMode] = useState<RepairPricingMode>(repair.pricingMode || 'automatic')
  const [laborCost, setLaborCost] = useState(String(repair.laborCost || 0))
  const [finalCost, setFinalCost] = useState(repair.finalCost == null ? '' : String(repair.finalCost))
  const [discountAmount, setDiscountAmount] = useState(String(repair.discountAmount || 0))
  const [reason, setReason] = useState(repair.priceOverrideReason || '')
  const [isSaving, setIsSaving] = useState(false)

  const paidAmount = Math.max(0, repair.paidAmount || 0)
  const pricingInput = useMemo(() => ({
    mode: pricingMode,
    currency: 'PYG',
    laborCost: numberFromInput(laborCost),
    finalCost: finalCost === '' ? null : numberFromInput(finalCost),
    discountAmount: numberFromInput(discountAmount),
    paidAmount,
    parts: repair.parts,
  }), [discountAmount, finalCost, laborCost, paidAmount, pricingMode, repair.parts])
  const pricing = useMemo(() => calculateRepairPricing(pricingInput), [pricingInput])
  const violations = useMemo(() => validateRepairPricing(pricingInput), [pricingInput])

  const validationMessage = violations.includes('FINAL_BELOW_PAID_AMOUNT')
    ? 'El precio no puede ser menor que lo ya pagado.'
    : violations.includes('FINAL_REQUIRED')
      ? 'Ingresa el precio acordado con el cliente.'
      : violations.includes('FINAL_BELOW_PARTS_PRICE')
        ? 'El presupuesto no cubre el precio de los repuestos.'
        : violations.includes('DISCOUNT_EXCEEDS_SUBTOTAL')
          ? 'El descuento supera el subtotal de la reparación.'
          : null
  const reasonRequired = numberFromInput(discountAmount) > 0 || pricingMode === 'manual'
  const invalidReason = reasonRequired && reason.trim().length < 5
  const canSave = !isSaving && !validationMessage && !invalidReason

  const changeMode = (mode: RepairPricingMode) => {
    setPricingMode(mode)
    if (mode === 'budget') {
      setFinalCost('')
    } else if (mode === 'automatic') {
      setFinalCost(String(calculateRepairPricing({ ...pricingInput, mode: 'automatic', finalCost: null }).customerTotal))
    }
  }

  const applyDiscountPercent = (percent: number) => {
    const rawSubtotal = (pricing.laborCost || 0) + (pricing.partsPrice || 0)
    const calculated = Math.round((rawSubtotal * percent) / 100)
    setDiscountAmount(String(calculated))
    if (!reason) {
      setReason(`Descuento comercial del ${percent}%`)
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    const saved = await onSave({
      pricingMode,
      laborCost: pricing.laborCost,
      finalCost: pricing.customerTotal,
      discountAmount: pricing.discountAmount,
      priceOverrideReason: reason.trim(),
    })
    setIsSaving(false)
    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Editar precio de reparación</DialogTitle>
          <DialogDescription>
            Ajusta el precio que se cobrará al cliente. El servidor volverá a validar el cálculo al guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Selector de modo */}
          <div className="grid grid-cols-3 gap-2" aria-label="Modo de cálculo">
            {MODES.map((mode) => (
              <Button
                key={mode.id}
                type="button"
                aria-pressed={pricingMode === mode.id}
                variant={pricingMode === mode.id ? 'default' : 'outline'}
                className="h-auto min-h-10 whitespace-normal px-2 text-xs"
                onClick={() => changeMode(mode.id)}
              >
                {mode.label}
              </Button>
            ))}
          </div>

          {paidAmount > 0 && (
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Esta reparación ya tiene pagos. El nuevo precio nunca puede quedar por debajo del monto pagado.</p>
            </div>
          )}

          {/* Entradas de valores */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Mano de obra */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-labor-cost">Mano de obra</Label>
                {pricingMode === 'budget' && (
                  <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground">
                    Derivado
                  </Badge>
                )}
              </div>
              <Input
                id="quick-labor-cost"
                type="text"
                inputMode="numeric"
                value={pricingMode === 'budget' ? formatThousands(pricing.laborCost) : formatThousands(laborCost)}
                disabled={pricingMode === 'budget' || isSaving}
                onChange={(event) => setLaborCost(parseThousands(event.target.value).toString())}
                className="h-9 font-semibold font-mono tabular-nums"
              />
              <span className="text-[11px] font-mono text-muted-foreground block truncate">
                {formatCurrency(pricingMode === 'budget' ? pricing.laborCost : numberFromInput(laborCost))}
              </span>
            </div>

            {/* Precio al cliente */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-final-cost">Precio al cliente</Label>
                {pricingMode === 'automatic' && (
                  <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground">
                    Automático
                  </Badge>
                )}
              </div>
              <Input
                id="quick-final-cost"
                type="text"
                inputMode="numeric"
                value={pricingMode === 'automatic' ? formatThousands(pricing.customerTotal) : formatThousands(finalCost)}
                disabled={pricingMode === 'automatic' || isSaving}
                onChange={(event) => setFinalCost(parseThousands(event.target.value).toString())}
                className="h-9 font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums"
              />
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block truncate">
                {formatCurrency(pricingMode === 'automatic' ? pricing.customerTotal : numberFromInput(finalCost))}
              </span>
            </div>

            {/* Descuento */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-discount">Descuento</Label>
                <div className="flex items-center gap-1">
                  {QUICK_DISCOUNT_PERCENTAGES.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyDiscountPercent(pct)}
                      className="px-1.5 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors font-semibold"
                    >
                      {pct}%
                    </button>
                  ))}
                  {numberFromInput(discountAmount) > 0 && (
                    <button
                      type="button"
                      onClick={() => setDiscountAmount('0')}
                      className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              <Input
                id="quick-discount"
                type="text"
                inputMode="numeric"
                value={formatThousands(discountAmount)}
                disabled={isSaving}
                onChange={(event) => setDiscountAmount(parseThousands(event.target.value).toString())}
                className="h-9 font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400"
              />
            </div>

            {/* Motivo del ajuste */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="quick-reason">Motivo del ajuste</Label>
              <Input
                id="quick-reason"
                value={reason}
                disabled={isSaving}
                placeholder={reasonRequired ? 'Obligatorio, mínimo 5 caracteres' : 'Opcional'}
                onChange={(event) => setReason(event.target.value)}
                className="h-9 text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(validationMessage || invalidReason) && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {validationMessage || 'Especifica un motivo de al menos 5 caracteres.'}
            </p>
          )}

          {/* Desglose Financiero */}
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Ya pagado</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Saldo resultante</dt>
              <dd className={cn('font-semibold tabular-nums', pricing.balance > 0 && 'text-amber-700 dark:text-amber-300')}>
                {formatCurrency(pricing.balance)}
              </dd>
            </div>
          </dl>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave} className="font-semibold">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

