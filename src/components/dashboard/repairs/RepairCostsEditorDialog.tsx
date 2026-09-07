'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleDollarSign,
  Loader2,
  Package,
  Tags,
  Wrench,
  Sparkles,
  TrendingUp,
  HelpCircle,
  ShieldCheck,
  Wallet,
  Scale
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { calculateRepairCost, validateRepairCost, type RepairCostViolation } from '@/lib/repairs/cost-breakdown'
import type { Repair } from '@/types/repairs'
import { RepairCostLiveSummary } from './RepairCostLiveSummary'
import { RepairPartsEditor, type EditableRepairPart } from './RepairPartsEditor'
import { RepairFinanceGuideModal } from './RepairFinanceGuideModal'
import { useCanViewCost } from '@/hooks/use-can-view-cost'
import { cn } from '@/lib/utils'

const violationMessages: Record<RepairCostViolation['code'], string> = {
  NEGATIVE_AMOUNT: 'Los importes no pueden ser negativos.',
  PART_DISCOUNT_EXCEEDS_GROSS: 'El descuento de una pieza supera su importe.',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'Los descuentos superan el subtotal.',
  DISCOUNT_LIMIT_EXCEEDED: 'El descuento supera el límite permitido.',
  PART_BELOW_COST: 'Una pieza queda debajo del costo de inventario.',
  OVERRIDE_REASON_REQUIRED: 'La excepción administrativa requiere un motivo de al menos 5 caracteres.',
  FINAL_BELOW_PAID_AMOUNT: 'El total no puede quedar por debajo del monto pagado.',
}

export function RepairCostsEditorDialog({
  open,
  repair,
  maxDiscountPercent = 20,
  laborTaxRate = 10,
  onOpenChange,
  onSaved
}: {
  open: boolean
  repair: Repair
  maxDiscountPercent?: number
  laborTaxRate?: 0 | 5 | 10
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return (
    <RepairCostsEditorForm
      key={`${repair.id}-${open}`}
      open={open}
      repair={repair}
      maxDiscountPercent={maxDiscountPercent}
      laborTaxRate={laborTaxRate}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  )
}

function RepairCostsEditorForm({
  open,
  repair,
  maxDiscountPercent,
  laborTaxRate,
  onOpenChange,
  onSaved
}: {
  open: boolean
  repair: Repair
  maxDiscountPercent: number
  laborTaxRate: 0 | 5 | 10
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const { isAdmin } = useAuth()
  const canViewCost = useCanViewCost()
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [laborAmount, setLaborAmount] = useState(repair.laborCost || 0)
  const [parts, setParts] = useState<EditableRepairPart[]>(
    repair.parts.map((part, index) => ({
      key: part.databaseId || String(part.id || index),
      productId: part.productId,
      name: part.name,
      partNumber: part.partNumber,
      supplier: part.supplier,
      quantity: part.quantity,
      unitPrice: part.cost,
      unitCost: part.internalCost ?? part.cost,
      discountAmount: part.discountAmount ?? 0,
      taxRate: part.taxRate ?? laborTaxRate,
      availableStock: part.stockAvailable,
      lineType: part.lineType ?? 'charged_part',
    }))
  )
  const [additionalCharges, setAdditionalCharges] = useState(repair.additionalCharges || 0)
  const [deductions, setDeductions] = useState(repair.deductions || 0)
  const [discountAmount, setDiscountAmount] = useState(repair.discountAmount || 0)
  const [reason, setReason] = useState(repair.priceOverrideReason || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [manualServiceOpen, setManualServiceOpen] = useState(false)
  const [manualServiceName, setManualServiceName] = useState('Servicio técnico')
  const [manualServiceAmount, setManualServiceAmount] = useState(0)
  const [financeGuideOpen, setFinanceGuideOpen] = useState(false)

  const input = useMemo(() => ({
    currency: 'PYG',
    laborAmount,
    laborTaxRate,
    parts: parts.map((part) => ({
      key: part.key,
      quantity: part.quantity,
      unitPrice: part.unitPrice,
      unitCost: part.unitCost,
      discountAmount: part.discountAmount,
      taxRate: part.taxRate,
      lineType: part.lineType,
    })),
    additionalCharges,
    deductions,
    discountAmount,
    paidAmount: repair.paidAmount || 0,
  }), [additionalCharges, deductions, discountAmount, laborAmount, laborTaxRate, parts, repair.paidAmount])

  const summary = useMemo(() => calculateRepairCost(input), [input])
  const violations = useMemo(() => validateRepairCost(input, { maxDiscountPercent, isAdmin, overrideReason: reason }), [input, isAdmin, maxDiscountPercent, reason])

  const save = async () => {
    if (violations.length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`/api/repairs/${repair.id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laborAmount,
          additionalCharges,
          deductions,
          discountAmount,
          overrideReason: reason.trim() || null,
          idempotencyKey: crypto.randomUUID(),
          parts,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudieron guardar los costos.')
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los costos.')
      setStep('edit')
    } finally {
      setSaving(false)
    }
  }

  const deviceLabel = [repair.brand, repair.model].filter(Boolean).join(' ') || repair.device
  const customerType = String(repair.customer.customer_type ?? '').toLowerCase()
  const customerIsWholesale = Boolean(repair.customer.is_wholesale || customerType === 'wholesale' || customerType === 'mayorista')
  const costKind = laborAmount > 0 || parts.some((part) => part.lineType === 'service') ? 'service' : parts.length > 0 ? 'parts' : 'pending'
  const invalidPartKeys = new Set(violations.filter((item) => item.partKey).map((item) => item.partKey as string))

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex h-[96dvh] max-h-[96dvh] w-[calc(100%-1rem)] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px] lg:w-[calc(100%-2rem)]">
        {/* Cabecera del diálogo */}
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold">
                {step === 'edit' ? 'Editar costos y repuestos' : 'Vista previa de costos'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                {repair.customer.name} · {deviceLabel}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CostKindBadge kind={costKind} />
                {customerIsWholesale && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    <Tags className="h-3.5 w-3.5" />
                    Cliente mayorista
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFinanceGuideOpen(true)}
                  className="h-6 px-2 text-[11px] font-semibold rounded-full border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 gap-1 shadow-2xs"
                >
                  <HelpCircle className="h-3 w-3 text-cyan-600" />
                  <span>¿Cómo funciona y cómo impacta en las finanzas?</span>
                </Button>
              </div>
            </div>
            <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium">
              Paso {step === 'edit' ? '1' : '2'} de 2
            </span>
          </div>
          <div aria-label="Progreso" className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium">
            <Step number={1} label="Editar costos" active />
            <Step number={2} label="Confirmar" active={step === 'preview'} />
          </div>
        </DialogHeader>

        {/* Cuerpo del Diálogo */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-5">
          {step === 'edit' ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(340px,0.8fr)]">
              <div className="min-w-0 space-y-4">
                {/* Formulario de Servicio Manual */}
                {manualServiceOpen && (
                  <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
                    <div>
                      <h3 className="font-semibold text-sm">Agregar servicio manual</h3>
                      <p className="text-xs text-muted-foreground">
                        Se mostrará como servicio cobrado y no modificará el inventario.
                      </p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="manual-service-name">Nombre del servicio</Label>
                        <Input
                          id="manual-service-name"
                          value={manualServiceName}
                          onChange={(event) => setManualServiceName(event.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="manual-service-amount">Precio al cliente</Label>
                        <MoneyInput
                          id="manual-service-amount"
                          value={manualServiceAmount}
                          onChange={setManualServiceAmount}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setManualServiceOpen(false)}>
                        Cancelar servicio
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={manualServiceAmount <= 0 || !manualServiceName.trim()}
                        onClick={() => {
                          setParts((current) => [
                            ...current,
                            {
                              key: `service-${crypto.randomUUID()}`,
                              productId: null,
                              name: manualServiceName.trim(),
                              supplier: 'Carga manual',
                              quantity: 1,
                              unitPrice: manualServiceAmount,
                              unitCost: 0,
                              discountAmount: 0,
                              taxRate: laborTaxRate,
                              availableStock: null,
                              lineType: 'service',
                            },
                          ])
                          setManualServiceOpen(false)
                          setManualServiceAmount(0)
                        }}
                      >
                        Agregar servicio
                      </Button>
                    </div>
                  </section>
                )}

                {/* Mano de Obra Adicional */}
                <section className="rounded-xl border bg-card p-4 shadow-2xs">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <div>
                      <h3 className="font-semibold text-sm">Mano de obra adicional</h3>
                      <p className="text-xs text-muted-foreground">
                        {costKind === 'service'
                          ? 'El servicio ya conserva su precio completo. Usá este campo solo si existe una mano de obra adicional explícita.'
                          : costKind === 'parts'
                          ? 'Esta reparación no tiene mano de obra cargada. Podés dejarla en cero.'
                          : 'Todavía no se cargaron costos para esta reparación.'}
                      </p>
                    </div>
                  </div>
                  <Label htmlFor="fixed-labor" className="text-xs font-semibold">
                    Mano de obra adicional opcional
                  </Label>
                  <MoneyInput
                    id="fixed-labor"
                    value={laborAmount}
                    onChange={setLaborAmount}
                    prominent
                  />
                </section>

                {/* Lista de Servicios, Repuestos y Materiales */}
                <section className="rounded-xl border bg-card p-4 shadow-2xs">
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm">Servicios, repuestos y materiales</h3>
                    <p className="text-xs text-muted-foreground">
                      Los servicios se cobran una vez; los materiales incluidos solo forman parte del costo interno.
                    </p>
                  </div>
                  <RepairPartsEditor
                    parts={parts}
                    onChange={setParts}
                    onAddService={() => {
                      setManualServiceAmount(0)
                      setManualServiceOpen(true)
                    }}
                    repairId={repair.id}
                    customerIsWholesale={customerIsWholesale}
                    disabled={saving}
                    invalidPartKeys={invalidPartKeys}
                  />
                </section>

                {/* Ajustes del Total (Cargos, Descuentos, Deducciones) */}
                <section className="rounded-xl border bg-card p-4 shadow-2xs">
                  <div className="mb-3">
                    <h3 className="font-semibold text-sm">Ajustes del total</h3>
                    <p className="text-xs text-muted-foreground">
                      Aplicá cargos o deducciones al presupuesto consolidado. Usá los botones rápidos para sumar montos fácilmente.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MoneyField
                      id="additional-charges"
                      label="Cargos adicionales"
                      value={additionalCharges}
                      onChange={setAdditionalCharges}
                    />
                    <MoneyField
                      id="general-discount"
                      label="Descuento general"
                      value={discountAmount}
                      onChange={setDiscountAmount}
                    />
                    <MoneyField
                      id="deductions"
                      label="Deducciones"
                      value={deductions}
                      onChange={setDeductions}
                    />
                  </div>
                </section>

                {/* Excepción Administrativa */}
                {(isAdmin || reason) && (
                  <div className="rounded-xl border bg-card p-4 shadow-2xs">
                    <Label htmlFor="cost-override-reason" className="text-xs font-semibold">
                      Motivo de excepción administrativa
                    </Label>
                    <Input
                      id="cost-override-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explicá por qué autorizás esta excepción"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Mensajes de Alerta / Violaciones */}
                {(violations.length > 0 || saveError) && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{saveError || violationMessages[violations[0].code]}</span>
                  </div>
                )}
              </div>

              {/* Barra Lateral con Resumen e Impacto Financiero en Tiempo Real */}
              <RepairCostLiveSummary
                summary={summary}
                onOpenFinanceGuide={() => setFinanceGuideOpen(true)}
              />
            </div>
          ) : (
            <Preview summary={summary} parts={parts} canViewCost={canViewCost} />
          )}
        </div>

        {/* Footer fijo con botones de acción */}
        <DialogFooter className="flex-row justify-between gap-2 border-t bg-background px-3 py-3 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => (step === 'preview' ? setStep('edit') : onOpenChange(false))}
          >
            {step === 'preview' && <ArrowLeft className="mr-2 h-4 w-4" />}
            {step === 'preview' ? 'Volver a editar' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            disabled={saving || violations.length > 0}
            onClick={() => (step === 'edit' ? setStep('preview') : void save())}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : step === 'preview' ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {step === 'edit' ? 'Revisar y confirmar' : 'Confirmar costos'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal de Educación Financiera y Ejemplos Prácticos */}
      <RepairFinanceGuideModal
        open={financeGuideOpen}
        onClose={() => setFinanceGuideOpen(false)}
      />
    </Dialog>
  )
}

function Step({ number, label, active }: { number: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? '' : 'text-muted-foreground'}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {number}
      </span>
      <span>{label}</span>
    </div>
  )
}

function CostKindBadge({ kind }: { kind: 'service' | 'parts' | 'pending' }) {
  const label = kind === 'service' ? 'Servicio técnico' : kind === 'parts' ? 'Solo repuestos' : 'Costos pendientes'
  const Icon = kind === 'service' ? Wrench : Package
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function MoneyInput({
  id,
  value,
  onChange,
  prominent,
  quickPresets = [10000, 50000, 100000, 200000]
}: {
  id: string
  value: number
  onChange: (value: number) => void
  prominent?: boolean
  quickPresets?: number[]
}) {
  return (
    <div className="space-y-1.5 mt-1">
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className={`pr-10 text-right tabular-nums font-mono ${prominent ? 'h-11 font-bold text-base' : 'h-9'}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
          Gs.
        </span>
      </div>

      {/* Vista previa en formato legible de Guaraníes y botones rápidos */}
      <div className="flex items-center justify-between gap-1 flex-wrap text-xs">
        <span className="font-semibold text-cyan-700 dark:text-cyan-400 tabular-nums">
          {formatCurrency(value)}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {quickPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              tabIndex={-1}
              onClick={() => onChange((value || 0) + preset)}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-accent text-foreground/80 hover:text-foreground border border-border/60 transition-colors"
              title={`Sumar ${formatCurrency(preset)}`}
            >
              +{preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}k`}
            </button>
          ))}
          {value > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onChange(0)}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Restablecer a 0"
            >
              0 Gs.
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MoneyField({
  id,
  label,
  value,
  onChange
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <MoneyInput id={id} value={value} onChange={onChange} />
    </div>
  )
}

function Preview({
  summary,
  parts,
  canViewCost = true
}: {
  summary: ReturnType<typeof calculateRepairCost>
  parts: EditableRepairPart[]
  canViewCost?: boolean
}) {
  const groups = [
    { type: 'service', label: 'Servicios' },
    { type: 'charged_part', label: 'Repuestos cobrados' },
    { type: 'included_material', label: 'Materiales incluidos' },
  ] as const

  const totalInternalCost = summary.partsInternalCost ?? 0
  const finalTotal = summary.finalTotal ?? 0
  const grossProfit = Math.max(0, finalTotal - totalInternalCost)
  const profitMargin = finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Composición del Monto */}
      <section className="rounded-xl border bg-card p-4 shadow-2xs">
        <h3 className="font-semibold text-sm">Composición del monto</h3>
        {summary.laborAmount > 0 && (
          <div className="mt-3 flex justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>Mano de obra adicional</span>
            <strong className="tabular-nums">{formatCurrency(summary.laborAmount)}</strong>
          </div>
        )}
        {groups.map((group) => {
          const rows = parts.filter((part) => (part.lineType ?? 'charged_part') === group.type)
          if (rows.length === 0) return null
          return (
            <div key={group.type} className="mt-4 overflow-hidden rounded-lg border">
              <h4 className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              <dl className="divide-y text-sm">
                {rows.map((part) => (
                  <div key={part.key} className="flex justify-between gap-4 px-3 py-2">
                    <dt>
                      {part.quantity} × {part.name}
                      {group.type === 'included_material' && (
                        <small className="block text-muted-foreground">Incluido · Gs. 0 adicional al cliente</small>
                      )}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(group.type === 'included_material' ? 0 : Math.max(0, part.quantity * part.unitPrice - part.discountAmount))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
        {(summary.discountAmount + summary.deductions) > 0 && (
          <div className="mt-3 flex justify-between py-2 text-sm text-rose-600">
            <span>Descuentos y deducciones</span>
            <strong>- {formatCurrency(summary.discountAmount + summary.deductions)}</strong>
          </div>
        )}
      </section>

      {/* IVA incluido */}
      <section className="rounded-xl border bg-card p-4 shadow-2xs">
        <h3 className="font-semibold text-sm">IVA incluido</h3>
        {summary.taxBreakdown.map((tax) => (
          <p key={tax.rate} className="mt-2 flex justify-between gap-4 text-sm">
            <span>Tasa {tax.rate}% · Base {formatCurrency(tax.taxableBase)}</span>
            <strong className="tabular-nums">{formatCurrency(tax.taxAmount)}</strong>
          </p>
        ))}
      </section>

      {/* Impacto Financiero en el Taller */}
      {canViewCost && (
        <section className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-background to-cyan-50/30 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-card shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-950 dark:text-indigo-200">
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Impacto Financiero y Rentabilidad de la Orden</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "font-bold text-xs px-2.5 py-0.5",
                profitMargin >= 30
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                  : profitMargin >= 15
                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
              )}
            >
              {profitMargin.toFixed(1)}% Margen Estimado
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
            <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-muted-foreground block text-[11px]">Ingreso Facturado</span>
              <span className="text-base font-bold text-foreground tabular-nums mt-0.5 block">
                {formatCurrency(finalTotal)}
              </span>
              <span className="text-[10px] text-muted-foreground">Total cobrado al cliente</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-muted-foreground block text-[11px]">Costo Interno (Piezas)</span>
              <span className="text-base font-bold text-slate-700 dark:text-slate-300 tabular-nums mt-0.5 block">
                {formatCurrency(totalInternalCost)}
              </span>
              <span className="text-[10px] text-muted-foreground">Reposición de inventario</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-emerald-800 dark:text-emerald-300 block text-[11px] font-semibold">
                Utilidad Bruta Estimada
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                +{formatCurrency(grossProfit)}
              </span>
              <span className="text-[10px] text-muted-foreground">Ganancia neta del taller</span>
            </div>
          </div>
        </section>
      )}

      {/* Monto Total Final */}
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          <CircleDollarSign className="h-5 w-5" />
          Monto total final
        </div>
        <p className="mt-1 text-3xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
          {formatCurrency(summary.finalTotal)}
        </p>
        <p className="mt-3 border-t border-emerald-200 pt-3 text-sm dark:border-emerald-900">
          Pagado {formatCurrency(summary.paidAmount)} · Pendiente {formatCurrency(summary.balance)}
        </p>
      </div>
    </div>
  )
}
