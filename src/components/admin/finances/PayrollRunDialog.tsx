'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, CheckCircle2, Coins, Loader2, Sparkles, User, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'

type PayrollFilters = { startDate: string; endDate: string }
type Preview = {
  totals: { netPay: number }
  entries: Array<{
    employeeId: string
    role: string
    salary: number
    earnedCommissions: number
    netPay: number
  }>
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  seller: 'Vendedor',
  cashier: 'Cajero',
  support: 'Soporte',
}

export function PayrollRunDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  filters,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId: string | null | undefined
  filters: PayrollFilters
  onSaved: () => unknown | Promise<unknown>
}) {
  const [periodFrom, setPeriodFrom] = useState(filters.startDate)
  const [periodTo, setPeriodTo] = useState(filters.endDate)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const idempotencyKeyRef = useRef<string | null>(null)

  const query = new URLSearchParams({ organizationId, periodFrom, periodTo })
  if (branchId) query.set('branchId', branchId)

  // El diálogo queda montado entre aperturas (solo cambia `open`), así que sin
  // este resync el período quedaría "congelado" en el filtro vigente quando se
  // montó la primera vez, aunque el usuario después haya cambiado el rango de
  // fechas arriba en Finanzas.
  useEffect(() => {
    if (!open) return
    setPeriodFrom(filters.startDate)
    setPeriodTo(filters.endDate)
    setPreview(null)
    setError(null)
    idempotencyKeyRef.current = null
  }, [open, filters.startDate, filters.endDate])

  async function loadPreview() {
    setIsLoadingPreview(true)
    setError(null)
    const response = await fetch(`/api/admin/finances/payroll?${query.toString()}`)
    const payload = (await response.json().catch(() => null)) as { preview?: Preview; error?: string } | null
    setIsLoadingPreview(false)
    if (!response.ok || !payload?.preview) {
      setError(payload?.error ?? 'No se pudo generar la vista previa.')
      return
    }
    setPreview(payload.preview)
  }

  async function createRun() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    idempotencyKeyRef.current ??= `payroll-${crypto.randomUUID()}`
    const response = await fetch(`/api/admin/finances/payroll?organizationId=${organizationId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': idempotencyKeyRef.current },
      body: JSON.stringify({ periodFrom, periodTo, branchId }),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setIsSubmitting(false)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo crear la nómina.')
      return
    }
    await onSaved()
    idempotencyKeyRef.current = null
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Preparar nómina</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Calcula salarios base y comisiones devengadas automáticamente por el servidor.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Por defecto usa el período seleccionado arriba en Finanzas. Podés ajustarlo acá para esta nómina en particular.
          </p>
          {/* Selector de Rango de Período */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="payroll-from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Desde
              </label>
              <Input
                id="payroll-from"
                type="date"
                value={periodFrom}
                onChange={(event) => setPeriodFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="payroll-to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hasta
              </label>
              <Input
                id="payroll-to"
                type="date"
                value={periodTo}
                onChange={(event) => setPeriodTo(event.target.value)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loadPreview}
            disabled={isLoadingPreview}
            className="w-full gap-2 font-medium"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando nómina…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-primary" />
                Ver vista previa
              </>
            )}
          </Button>

          {/* Resultado de la Vista Previa */}
          {preview ? (
            <section aria-live="polite" className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total a liquidar
                  </span>
                </div>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Total neto: {formatCurrency(preview.totals.netPay)}
                </p>
              </div>

              {preview.entries.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {preview.entries.map((entry) => (
                    <div
                      key={entry.employeeId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px]">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{entry.employeeId}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-0.5 font-medium">
                            {ROLE_LABELS[entry.role] || entry.role}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground tabular-nums">{formatCurrency(entry.netPay)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Base: {formatCurrency(entry.salary)} · Comis: {formatCurrency(entry.earnedCommissions)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No hay empleados con salarios o comisiones devengadas en este rango.
                </p>
              )}
            </section>
          ) : null}

          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            💡 Las excepciones o acuerdos individuales configurados en el perfil del empleado prevalecen sobre las reglas generales de su rol.
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={createRun}
            disabled={!preview || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              'Crear nómina'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

