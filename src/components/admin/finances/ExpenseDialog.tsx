'use client'

import { type FormEvent, useRef, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  FileText,
  Loader2,
  Receipt,
  Repeat,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type FinanceCategory = { id: string; name: string }

/** Fecha de hoy en formato yyyy-MM-dd, calculada una sola vez al cargar el módulo. */
function getTodayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TODAY_ISO = getTodayIso()

function decimalPlaces(value: string) {
  const dotIndex = value.indexOf('.')
  return dotIndex === -1 ? 0 : value.length - dotIndex - 1
}

/** Mismo rango que valida el servidor (daysBetween): entre 0 y 366 días. Se
 *  valida acá también para avisar en el momento, no después de un viaje al servidor. */
function validateDueDate(accountingDate: string, dueDate: string): string | null {
  if (!dueDate) return null
  const start = Date.parse(`${accountingDate}T00:00:00Z`)
  const end = Date.parse(`${dueDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  const days = Math.round((end - start) / 86_400_000)
  if (days < 0) return 'La fecha de vencimiento no puede ser anterior a la fecha contable.'
  if (days > 366) return 'La fecha de vencimiento no puede superar los 366 días desde la fecha contable.'
  return null
}

export type EditableObligation = {
  id: string
  concept: string | null
  amount: number
  outstanding_amount: number
  category_id?: string | null
  accounting_date?: string | null
  due_date: string | null
  vendor?: string | null
  notes?: string | null
  status: string
  finance_categories?: { id?: string; name?: string } | null
}

export function ExpenseDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  filters,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId: string | null | undefined
  filters?: { startDate?: string; endDate?: string }
  categories: FinanceCategory[]
  onSaved: (createdObligation?: unknown) => void | Promise<void>
}) {
  const [recurring, setRecurring] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)

  function getIdempotencyKey() {
    idempotencyKeyRef.current ??= `expense-${crypto.randomUUID()}`
    return idempotencyKeyRef.current
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (!branchId) {
      const msg = 'No hay una sucursal activa. Seleccioná una sucursal arriba y volvé a intentar.'
      setError(msg)
      toast.error(msg)
      return
    }
    const formData = new FormData(event.currentTarget)

    const concept = String(formData.get('concept') ?? '').trim()
    const rawAmount = String(formData.get('amount') ?? '').trim()
    const amount = Number(rawAmount)
    const categoryId = String(formData.get('categoryId') ?? '')
    const accountingDate = String(formData.get('accountingDate') ?? '')
    const dueDate = String(formData.get('dueDate') ?? '')

    if (!concept) {
      setError('Ingresá un concepto para el gasto.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresá un monto mayor a 0.')
      return
    }
    if (decimalPlaces(rawAmount) > 2) {
      setError('El importe no puede tener más de dos decimales.')
      return
    }
    if (!categoryId) {
      const msg =
        categories.length === 0
          ? 'No hay categorías de gasto creadas. Creá una categoría antes de registrar el gasto.'
          : 'Elegí una categoría.'
      setError(msg)
      return
    }
    if (!accountingDate) {
      setError('Indicá la fecha contable.')
      return
    }
    const dueDateError = validateDueDate(accountingDate, dueDate)
    if (dueDateError) {
      setError(dueDateError)
      return
    }
    if (recurring && !String(formData.get('recurrenceStartsOn') ?? '')) {
      setError('Indicá desde cuándo se repite el gasto.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    const recurrence = recurring
      ? {
          frequency: String(formData.get('frequency')),
          startsOn: String(formData.get('recurrenceStartsOn')),
          endsOn: String(formData.get('recurrenceEndsOn')) || undefined,
        }
      : undefined
    const response = await fetch(
      `/api/admin/finances/obligations?organizationId=${organizationId}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': getIdempotencyKey(),
        },
        body: JSON.stringify({
          branchId,
          categoryId,
          amount,
          concept,
          accountingDate,
          dueDate: String(formData.get('dueDate') ?? '') || undefined,
          vendor: String(formData.get('vendor') ?? '').trim() || undefined,
          notes: String(formData.get('notes') ?? '').trim() || undefined,
          recurrence,
        }),
      },
    )
    const payload = (await response.json().catch(() => null)) as {
      obligation?: unknown
      error?: string
    } | null
    setIsSubmitting(false)
    if (!response.ok) {
      const errorMsg = payload?.error ?? 'No se pudo guardar el gasto.'
      setError(errorMsg)
      toast.error('Error al guardar el gasto', { description: errorMsg })
      return
    }
    await onSaved(payload?.obligation)
    idempotencyKeyRef.current = null
    onOpenChange(false)

    // Confirmación explícita con validación de rango de fechas
    const isInsidePeriod =
      !filters?.startDate ||
      !filters?.endDate ||
      (accountingDate >= filters.startDate && accountingDate <= filters.endDate)

    if (isInsidePeriod) {
      toast.success('Gasto guardado correctamente', {
        description: 'El gasto ya se encuentra visible en la lista del período.',
      })
    } else {
      toast.warning('Gasto guardado fuera del período visible', {
        description: `Se registró con fecha ${accountingDate}. Tu filtro actual muestra del ${filters.startDate} al ${filters.endDate}. Cambiá el período arriba para verlo.`,
        duration: 9000,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl p-0 gap-0">
        {/* Encabezado visual estilizado */}
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader className="gap-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Registrar nuevo gasto
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registra el compromiso contable; los pagos se asientan por separado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {error ? (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Bloque 1: Monto Destacado y Concepto */}
          <div className="grid gap-4 sm:grid-cols-12">
            <div className="sm:col-span-7 space-y-1.5">
              <Label htmlFor="concept" className="text-xs font-semibold text-foreground/90">
                Concepto del gasto <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="concept"
                  name="concept"
                  placeholder="Ej: Alquiler del local, Servicio de internet..."
                  required
                  maxLength={200}
                  className="pl-9 h-10 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-semibold text-foreground/90">
                Importe (₲) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                  Gs.
                </span>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  required
                  className="pl-9 h-10 text-sm font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Bloque 2: Categoría y Proveedor */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="text-xs font-semibold text-foreground/90">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  id="categoryId"
                  name="categoryId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                >
                  <option value="" disabled>
                    Selecciona una categoría…
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor" className="text-xs font-semibold text-foreground/90">
                Proveedor o beneficiario
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="vendor"
                  name="vendor"
                  placeholder="Ej: Tigo, ANDE, Inmobiliaria..."
                  maxLength={200}
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Bloque 3: Fechas (Contable y Vencimiento) */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="accountingDate"
                    className="text-xs font-semibold text-foreground/90"
                  >
                    Fecha contable <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    (Para reportes)
                  </span>
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="accountingDate"
                    name="accountingDate"
                    type="date"
                    required
                    defaultValue={TODAY_ISO}
                    className="pl-9 h-9.5 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dueDate" className="text-xs font-semibold text-foreground/90">
                    Fecha de vencimiento
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-medium">(Opcional)</span>
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    className="pl-9 h-9.5 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 4: Notas u Observaciones */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-foreground/90">
              Notas u observaciones <span className="text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={2000}
              rows={2}
              className="resize-none text-xs"
              placeholder="Número de factura, condición de pago o detalles del comprobante..."
            />
          </div>

          {/* Bloque 5: Recurrencia interactiva */}
          <div className="rounded-xl border border-border/70 p-3.5 transition-colors bg-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">¿Es un gasto recurrente?</p>
                  <p className="text-[11px] text-muted-foreground">
                    Genera automáticamente las obligaciones futuras según la frecuencia elegida.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(event) => setRecurring(event.target.checked)}
                  aria-label="Repetir este gasto"
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                  <div
                    className={`h-4 w-4 rounded-full bg-background shadow-xs transition-transform transform translate-y-0.5 ${
                      recurring ? 'translate-x-4.5 bg-primary-foreground' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </label>
            </div>

            {recurring ? (
              <div className="mt-3.5 pt-3.5 border-t border-border/60 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="frequency" className="text-xs font-semibold">
                    Frecuencia
                  </Label>
                  <select
                    id="frequency"
                    name="frequency"
                    aria-label="Frecuencia"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-xs focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="weekly">Semanal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recurrenceStartsOn" className="text-xs font-semibold">
                    Fecha de inicio <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="recurrenceStartsOn"
                    name="recurrenceStartsOn"
                    aria-label="Inicio de recurrencia"
                    type="date"
                    required
                    defaultValue={TODAY_ISO}
                    className="h-9 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="recurrenceEndsOn" className="text-xs font-semibold">
                    Fecha de fin <span className="text-muted-foreground font-normal">(Opcional)</span>
                  </Label>
                  <Input
                    id="recurrenceEndsOn"
                    name="recurrenceEndsOn"
                    type="date"
                    className="h-9 text-xs font-medium"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 text-xs font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 text-xs font-semibold gap-1.5 sm:min-w-[130px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Guardar gasto</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditExpenseDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  categories,
  expense,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId: string | null | undefined
  categories: FinanceCategory[]
  expense: EditableObligation | null
  onSaved: () => void | Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!expense) return null

  const initialCategoryId = expense.category_id ?? expense.finance_categories?.id ?? ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !expense) return
    if (!branchId) {
      return setError('No hay una sucursal activa. Seleccioná una sucursal arriba y volvé a intentar.')
    }

    const formData = new FormData(event.currentTarget)
    const concept = String(formData.get('concept') ?? '').trim()
    const rawAmount = String(formData.get('amount') ?? '').trim()
    const amount = Number(rawAmount)
    const categoryId = String(formData.get('categoryId') ?? '')
    const accountingDate = String(formData.get('accountingDate') ?? '')
    const dueDate = String(formData.get('dueDate') ?? '') || null
    const vendor = String(formData.get('vendor') ?? '').trim() || null
    const notes = String(formData.get('notes') ?? '').trim() || null

    if (!concept) return setError('Ingresá un concepto para el gasto.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Ingresá un monto mayor a 0.')
    if (decimalPlaces(rawAmount) > 2) return setError('El importe no puede tener más de dos decimales.')
    if (!categoryId) return setError('Elegí una categoría.')
    if (!accountingDate) return setError('Indicá la fecha contable.')
    const dueDateError = validateDueDate(accountingDate, dueDate ?? '')
    if (dueDateError) return setError(dueDateError)

    setIsSubmitting(true)
    setError(null)

    const response = await fetch(
      `/api/admin/finances/obligations/${expense.id}?organizationId=${organizationId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branchId,
          categoryId,
          amount,
          concept,
          accountingDate,
          dueDate,
          vendor,
          notes,
        }),
      },
    )

    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setIsSubmitting(false)

    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo actualizar el gasto.')
      return
    }

    await onSaved()
    onOpenChange(false)
    toast.success('Gasto actualizado correctamente')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl p-0 gap-0">
        <div className="border-b bg-muted/30 px-6 py-5">
          <DialogHeader className="gap-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">Editar gasto</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Modificá los datos del gasto. Solo se pueden editar obligaciones sin pagos registrados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {error ? (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-12">
            <div className="sm:col-span-7 space-y-1.5">
              <Label htmlFor="edit-concept" className="text-xs font-semibold text-foreground/90">
                Concepto del gasto <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="edit-concept"
                  name="concept"
                  defaultValue={expense.concept ?? ''}
                  required
                  maxLength={200}
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <Label htmlFor="edit-amount" className="text-xs font-semibold text-foreground/90">
                Importe (₲) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                  Gs.
                </span>
                <Input
                  id="edit-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={expense.amount}
                  required
                  className="pl-9 h-10 text-sm font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-categoryId" className="text-xs font-semibold text-foreground/90">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  id="edit-categoryId"
                  name="categoryId"
                  required
                  defaultValue={initialCategoryId}
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                >
                  <option value="" disabled>
                    Selecciona una categoría…
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-vendor" className="text-xs font-semibold text-foreground/90">
                Proveedor o beneficiario
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="edit-vendor"
                  name="vendor"
                  defaultValue={expense.vendor ?? ''}
                  maxLength={200}
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-accountingDate" className="text-xs font-semibold text-foreground/90">
                  Fecha contable <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="edit-accountingDate"
                    name="accountingDate"
                    type="date"
                    required
                    defaultValue={expense.accounting_date ?? ''}
                    className="pl-9 h-9.5 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-dueDate" className="text-xs font-semibold text-foreground/90">
                  Fecha de vencimiento <span className="text-muted-foreground font-normal">(Opcional)</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="edit-dueDate"
                    name="dueDate"
                    type="date"
                    defaultValue={expense.due_date ?? ''}
                    className="pl-9 h-9.5 text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-xs font-semibold text-foreground/90">
              Notas u observaciones <span className="text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Textarea
              id="edit-notes"
              name="notes"
              defaultValue={expense.notes ?? ''}
              maxLength={2000}
              rows={2}
              className="resize-none text-xs"
              placeholder="Detalles adicionales del comprobante o condición de pago..."
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 text-xs font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 text-xs font-semibold gap-1.5 sm:min-w-[130px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Guardar cambios</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type { FinanceCategory }
