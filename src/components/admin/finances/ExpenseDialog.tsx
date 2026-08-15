'use client'

import { type FormEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type FinanceCategory = { id: string; name: string }

export function ExpenseDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId: string | null | undefined
  categories: FinanceCategory[]
  onSaved: () => void | Promise<void>
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
    // Validación propia (el form va con noValidate): la nativa bloqueaba el
    // guardado en silencio con un globito fácil de no ver, y el usuario veía
    // que "no pasaba nada" al hacer click. Acá el motivo se muestra siempre,
    // en rojo, dentro del modal.
    event.preventDefault()
    if (isSubmitting) return
    // branchId nulo ya no corta en silencio: si la sucursal se perdió después
    // de abrir el modal, el usuario ve el motivo en vez de un click sin efecto.
    if (!branchId) return setError('No hay una sucursal activa. Seleccioná una sucursal arriba y volvé a intentar.')
    const formData = new FormData(event.currentTarget)

    const concept = String(formData.get('concept') ?? '').trim()
    const amount = Number(formData.get('amount'))
    const categoryId = String(formData.get('categoryId') ?? '')
    const accountingDate = String(formData.get('accountingDate') ?? '')

    if (!concept) return setError('Ingresá un concepto para el gasto.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Ingresá un monto mayor a 0.')
    if (!categoryId) {
      return setError(categories.length === 0
        ? 'No hay categorías de gasto creadas. Creá una categoría antes de registrar el gasto.'
        : 'Elegí una categoría.')
    }
    if (!accountingDate) return setError('Indicá la fecha contable.')
    if (recurring && !String(formData.get('recurrenceStartsOn') ?? '')) {
      return setError('Indicá desde cuándo se repite el gasto.')
    }

    setIsSubmitting(true)
    setError(null)
    const recurrence = recurring ? {
      frequency: String(formData.get('frequency')),
      startsOn: String(formData.get('recurrenceStartsOn')),
      endsOn: String(formData.get('recurrenceEndsOn')) || undefined,
    } : undefined
    const response = await fetch(`/api/admin/finances/obligations?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': getIdempotencyKey() },
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
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo guardar el gasto.')
      return
    }
    await onSaved()
    idempotencyKeyRef.current = null
    onOpenChange(false)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Registrar gasto</DialogTitle><DialogDescription>Registra el compromiso; el pago se registra por separado.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <label className="grid gap-1 text-sm font-medium">Concepto<input name="concept" required maxLength={200} className="rounded-md border bg-background px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Monto<input name="amount" type="number" min="0.01" step="0.01" required className="rounded-md border bg-background px-3 py-2" /></label>
          <label className="grid gap-1 text-sm font-medium">Categoría<select name="categoryId" required defaultValue="" className="rounded-md border bg-background px-3 py-2"><option value="" disabled>Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Fecha contable<input name="accountingDate" type="date" required className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium">Vencimiento<input name="dueDate" type="date" className="rounded-md border bg-background px-3 py-2" /></label></div>
        <label className="grid gap-1 text-sm font-medium">Proveedor<input name="vendor" maxLength={200} className="rounded-md border bg-background px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />Repetir este gasto</label>
        {recurring ? <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Frecuencia<select name="frequency" aria-label="Frecuencia" className="rounded-md border bg-background px-3 py-2"><option value="monthly">Mensual</option><option value="weekly">Semanal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label><label className="grid gap-1 text-sm font-medium">Inicio de recurrencia<input name="recurrenceStartsOn" aria-label="Inicio de recurrencia" type="date" required className="rounded-md border bg-background px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium sm:col-span-2">Fin de recurrencia (opcional)<input name="recurrenceEndsOn" type="date" className="rounded-md border bg-background px-3 py-2" /></label></div> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar gasto'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

export type { FinanceCategory }
