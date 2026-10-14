'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { branchHeaders } from '@/lib/branches/client'
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { suggestedPartPrice, type PartPurchasePayment } from '@/lib/repairs/part-purchase'
import { parseCatalogQuickCreateInput, toProductCreatePayload, type CatalogQuickCreateInput } from './new-repair/catalog-quick-create'
import type { Repair } from '@/types/repairs'

const PAYMENTS: Array<{ value: PartPurchasePayment; label: string; hint: string }> = [
  { value: 'cash', label: 'Sí, de la caja', hint: 'Sale de la caja abierta' },
  { value: 'bank_transfer', label: 'Sí, transferencia', hint: 'Queda como gasto pagado' },
  { value: 'owed', label: 'Todavía no', hint: 'Queda a pagar al proveedor' },
]

/**
 * «No lo tengo, lo compro»: en un paso, el repuesto entra a la reparación con su
 * costo, la compra queda en Finanzas y, si no llegó, la reparación lo espera.
 */
export function PartPurchaseDialog({
  open,
  repair,
  branchId,
  initialName = '',
  onOpenChange,
  onSaved,
}: {
  open: boolean
  repair: Repair
  branchId: string | null | undefined
  initialName?: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  if (!open) return null
  return <PartPurchaseForm key={repair.id} repair={repair} branchId={branchId} initialName={initialName} onOpenChange={onOpenChange} onSaved={onSaved} />
}

function PartPurchaseForm({ repair, branchId, initialName, onOpenChange, onSaved }: {
  repair: Repair
  branchId: string | null | undefined
  initialName: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  // Una clave por compra: si se reintenta (sin conexión, doble clic), no se duplica nada.
  const [idempotencyKey] = useState(() => `part-purchase-${crypto.randomUUID()}`)
  const [name, setName] = useState(initialName)
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [unitPrice, setUnitPrice] = useState(0)
  const [priceTouched, setPriceTouched] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [payment, setPayment] = useState<PartPurchasePayment>('cash')
  const [arrived, setArrived] = useState(true)
  const [expectedOn, setExpectedOn] = useState('')
  const [saveToCatalog, setSaveToCatalog] = useState(false)
  const [productId, setProductId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suppliers = useMemo(
    () => [...new Set((repair.parts ?? []).map((part) => part.supplier).filter((value): value is string => Boolean(value && value !== 'Carga manual' && value !== 'Inventario Local')))],
    [repair.parts],
  )
  const total = unitCost * quantity
  const profit = (unitPrice - unitCost) * quantity
  const canSubmit = name.trim().length >= 2 && quantity >= 1 && unitPrice >= unitCost && (arrived || Boolean(expectedOn)) && !submitting

  const handleCost = (value: number) => {
    setUnitCost(value)
    if (!priceTouched) setUnitPrice(suggestedPartPrice(value))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      let catalogProductId = productId
      if (saveToCatalog && !catalogProductId) {
        // Entra al stock lo comprado y la reparación lo consume: el inventario queda en cero, no desfasado.
        const parsed = parseCatalogQuickCreateInput({
          kind: 'part', name: name.trim(), sku: '', salePrice: unitPrice, wholesalePrice: null,
          purchasePrice: unitCost, categoryId: null, initialStock: quantity,
        })
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revisá el repuesto.')
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId ?? null) },
          body: JSON.stringify(toProductCreatePayload(parsed.data as CatalogQuickCreateInput, branchId ?? null)),
        })
        const body = (await response.json().catch(() => ({}))) as { success?: boolean; data?: { id?: string }; error?: string }
        if (!response.ok || !body.data?.id) throw new Error(body.error || 'No se pudo guardar el repuesto en el catálogo.')
        catalogProductId = body.data.id
        setProductId(catalogProductId)
      }

      const response = await fetch(`/api/repairs/${repair.id}/part-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...branchHeaders(branchId ?? null) },
        body: JSON.stringify({
          idempotencyKey,
          name: name.trim(),
          quantity,
          unitCost,
          unitPrice,
          supplier: supplier.trim() || null,
          productId: catalogProductId,
          payment,
          arrived,
          expectedOn: arrived ? null : expectedOn,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string; expense?: { recorded: boolean; warning?: string } }
      if (!response.ok) throw new Error(body.error || 'No se pudo registrar la compra.')
      toast.success(arrived ? 'Repuesto agregado a la reparación' : 'Repuesto pedido: la reparación queda esperándolo', {
        description: body.expense?.warning ?? (body.expense?.recorded ? 'La compra quedó registrada en Finanzas.' : undefined),
      })
      await onSaved()
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la compra.')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Comprar repuesto para esta reparación</DialogTitle>
          <DialogDescription>{repair.customer?.name} · {[repair.brand, repair.model].filter(Boolean).join(' ') || repair.device}</DialogDescription>
        </DialogHeader>

        <form id="part-purchase-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
            <div className="space-y-1">
              <Label htmlFor="purchase-name">Repuesto</Label>
              <Input id="purchase-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Pantalla Samsung A05" autoFocus maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-qty">Cantidad</Label>
              <Input id="purchase-qty" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="purchase-supplier">Proveedor <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="purchase-supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)} list="purchase-suppliers" placeholder="Ej: Distribuidora X" maxLength={200} />
            <datalist id="purchase-suppliers">{suppliers.map((value) => <option key={value} value={value} />)}</datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="purchase-cost">Te costó (c/u)</Label>
              <Input id="purchase-cost" inputMode="numeric" value={formatThousands(unitCost)} onChange={(event) => handleCost(parseThousands(event.target.value))} placeholder="0" className="font-semibold tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-price">Le cobrás (c/u)</Label>
              <Input
                id="purchase-price"
                inputMode="numeric"
                value={formatThousands(unitPrice)}
                onChange={(event) => { setPriceTouched(true); setUnitPrice(parseThousands(event.target.value)) }}
                placeholder="0"
                className={cn('font-semibold tabular-nums', unitPrice < unitCost && 'border-red-500')}
              />
            </div>
          </div>
          <p className={cn('text-xs', unitPrice < unitCost ? 'text-red-600' : 'text-muted-foreground')}>
            {unitPrice < unitCost
              ? 'Lo que cobrás no cubre lo que te costó.'
              : `Compra ${formatCurrency(total)} · Ganancia en el repuesto ${formatCurrency(profit)}${!priceTouched && unitCost > 0 ? ' (sugerido con 40%)' : ''}`}
          </p>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">¿Ya lo pagaste?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={payment === option.value}
                  onClick={() => setPayment(option.value)}
                  className={cn('rounded-lg border-2 p-2 text-left text-xs', payment === option.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border hover:bg-muted/40')}
                >
                  <span className="block font-semibold">{option.label}</span>
                  <span className="text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">¿Ya lo tenés?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" aria-pressed={arrived} onClick={() => setArrived(true)} className={cn('rounded-lg border-2 p-2 text-left text-xs font-semibold', arrived ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border hover:bg-muted/40')}>
                Sí, ya llegó
              </button>
              <button type="button" aria-pressed={!arrived} onClick={() => setArrived(false)} className={cn('rounded-lg border-2 p-2 text-left text-xs font-semibold', !arrived ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'border-border hover:bg-muted/40')}>
                Lo pedí, todavía no llegó
              </button>
            </div>
            {!arrived ? (
              <div className="space-y-1 pt-1">
                <Label htmlFor="purchase-expected">¿Cuándo llega?</Label>
                <Input id="purchase-expected" type="date" min={today} value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} />
                <p className="text-xs text-muted-foreground">La reparación queda en «esperando repuesto» hasta que marques que llegó.</p>
              </div>
            ) : null}
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={saveToCatalog} onCheckedChange={(checked) => setSaveToCatalog(checked === true)} className="mt-0.5" />
            <span>
              Guardarlo en el catálogo para la próxima vez
              <span className="block text-xs text-muted-foreground">Si no, queda solo en esta reparación y no llena el catálogo de repuestos de una sola vez.</span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button type="submit" form="part-purchase-form" disabled={!canSubmit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Agregar a la reparación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
