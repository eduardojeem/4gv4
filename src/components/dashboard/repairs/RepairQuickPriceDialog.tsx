'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { formatCurrency } from '@/lib/currency'
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
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar precio de reparación</DialogTitle>
          <DialogDescription>
            Ajusta el precio que se cobrará al cliente. El servidor volverá a validar el cálculo al guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-labor-cost">Mano de obra</Label>
              <Input
                id="quick-labor-cost"
                type="number"
                min="0"
                value={pricingMode === 'budget' ? pricing.laborCost : laborCost}
                disabled={pricingMode === 'budget' || isSaving}
                onChange={(event) => setLaborCost(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-final-cost">Precio al cliente</Label>
              <Input
                id="quick-final-cost"
                type="number"
                min="0"
                value={pricingMode === 'automatic' ? pricing.customerTotal : finalCost}
                disabled={pricingMode === 'automatic' || isSaving}
                onChange={(event) => setFinalCost(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-discount">Descuento</Label>
              <Input
                id="quick-discount"
                type="number"
                min="0"
                value={discountAmount}
                disabled={isSaving}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-reason">Motivo del ajuste</Label>
              <Input
                id="quick-reason"
                value={reason}
                disabled={isSaving}
                placeholder={reasonRequired ? 'Obligatorio, mínimo 5 caracteres' : 'Opcional'}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>

          {(validationMessage || invalidReason) && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {validationMessage || 'Especifica un motivo de al menos 5 caracteres.'}
            </p>
          )}

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

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
