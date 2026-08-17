'use client'

import { useMemo, type FormEvent } from 'react'
import { Banknote, CheckCircle2, Info, Loader2, MapPin, Store } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { useBranch } from '@/contexts/branch-context'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'

interface OpenCashRegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: string
  onAmountChange: (amount: string) => void
  note: string
  onNoteChange: (note: string) => void
  registerName?: string
  isSubmitting?: boolean
  onSubmit: (amount: number, note: string) => Promise<void> | void
}

export function OpenCashRegisterDialog({
  open,
  onOpenChange,
  amount,
  onAmountChange,
  note,
  onNoteChange,
  registerName,
  isSubmitting = false,
  onSubmit,
}: OpenCashRegisterDialogProps) {
  const { selectedBranch } = useBranch()
  const { settings } = useSharedSettings()
  const currency = settings.currency || 'PYG'
  const parsedAmount = useMemo(() => Number(amount), [amount])
  const isAmountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount >= 0
  const quickAmounts = useMemo(
    () => currency === 'PYG' ? [0, 50000, 100000, 200000] : [0, 50, 100, 200],
    [currency]
  )
  const amountPreview = formatCurrency(isAmountValid ? parsedAmount : 0, {
    currency,
    minimumFractionDigits: currency === 'PYG' ? 0 : 2,
    maximumFractionDigits: currency === 'PYG' ? 0 : 2,
  })

  const formatQuickAmount = (value: number) => formatCurrency(value, {
    currency,
    minimumFractionDigits: currency === 'PYG' ? 0 : 2,
    maximumFractionDigits: currency === 'PYG' ? 0 : 2,
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAmountValid || isSubmitting) return
    await onSubmit(parsedAmount, note.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b bg-muted/30 px-5 py-5 pr-12 text-left sm:px-6">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-md border bg-background text-primary shadow-sm">
              <Banknote className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl">Abrir caja</DialogTitle>
            <DialogDescription>
              Registre el efectivo contado antes de comenzar a vender.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Contexto de apertura">
              <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sucursal</p>
                  <p className="truncate text-sm font-medium">{selectedBranch?.name || 'Sucursal actual'}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2.5">
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Caja</p>
                  <p className="truncate text-sm font-medium">{registerName || 'Se creará Caja Principal'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cash-register-opening-amount">Fondo inicial</Label>
                <span className="text-xs text-muted-foreground">Efectivo disponible</span>
              </div>
              <div className="relative">
                <Banknote className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="cash-register-opening-amount"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={formatThousands(amount)}
                  onChange={(event) => onAmountChange(parseThousands(event.target.value).toString())}
                  placeholder="0"
                  aria-describedby="cash-register-opening-help"
                  className="h-12 pl-11 text-lg font-semibold font-mono tabular-nums"
                />
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Montos rápidos</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {quickAmounts.map((quickAmount) => {
                    const isSelected = isAmountValid && parsedAmount === quickAmount

                    return (
                      <Button
                        key={quickAmount}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={isSelected}
                        onClick={() => onAmountChange(String(quickAmount))}
                        className="h-9 px-2 text-xs tabular-nums"
                      >
                        {formatQuickAmount(quickAmount)}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <p id="cash-register-opening-help" className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Ingrese solamente el dinero físico que queda como cambio. Puede abrir con saldo cero.
              </p>
              {amount.trim() !== '' && !isAmountValid && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  Ingrese un monto válido igual o mayor a cero.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-register-opening-note">Referencia del turno <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea
                id="cash-register-opening-note"
                value={note}
                onChange={(event) => onNoteChange(event.target.value.slice(0, 200))}
                placeholder="Ej. Turno mañana, responsable o detalle del fondo"
                rows={2}
                className="resize-none"
              />
              <p className="text-right text-xs text-muted-foreground">{note.length}/200</p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Resumen de apertura</p>
                <p className="mt-1 text-sm text-muted-foreground">Saldo que quedará registrado</p>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums">{amountPreview}</p>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isAmountValid || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {isSubmitting ? 'Abriendo caja...' : 'Confirmar apertura'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
