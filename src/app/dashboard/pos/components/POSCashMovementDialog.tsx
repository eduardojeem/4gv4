'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Loader2,
  TrendingUp,
  TrendingDown,
  Tag,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface POSCashMovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddMovement: (type: 'cash_in' | 'cash_out', amount: number, note?: string) => Promise<boolean>
  initialType?: 'in' | 'out'
  currentBalance?: number
}

interface ReasonOption {
  id: string
  label: string
  icon: string
  template?: string
}

const IN_REASONS: ReasonOption[] = [
  { id: 'cambio_inicial', label: 'Cambio Inicial', icon: '🪙', template: 'Cambio inicial para apertura de turno' },
  { id: 'aporte_capital', label: 'Aporte de Capital', icon: '💼', template: 'Aporte de capital / Inyección de efectivo' },
  { id: 'cobro_servicio', label: 'Cobro de Servicio / Taller', icon: '🛠️', template: 'Cobro de servicio técnico / reparación' },
  { id: 'ajuste_positivo', label: 'Ajuste Positivo', icon: '📈', template: 'Ajuste positivo por sobrante de arqueo' },
  { id: 'devolucion_prov', label: 'Devolución de Proveedor', icon: '📦', template: 'Devolución de dinero de proveedor' },
  { id: 'cobro_credito', label: 'Cobro de Crédito / Deuda', icon: '🤝', template: 'Cobro de cuenta pendiente de cliente' },
  { id: 'otro_ingreso', label: 'Otro Ingreso', icon: '🏷️', template: '' }
]

const OUT_REASONS: ReasonOption[] = [
  { id: 'pago_proveedor', label: 'Pago a Proveedor', icon: '🚚', template: 'Pago a proveedor: ' },
  { id: 'compra_repuestos', label: 'Compra de Insumos / Repuestos', icon: '🔧', template: 'Compra de repuestos / insumos: ' },
  { id: 'pago_servicios', label: 'Servicios (Luz / Internet / Agua)', icon: '💡', template: 'Pago de servicio: ' },
  { id: 'adelanto_sueldo', label: 'Adelanto de Sueldo / Vale', icon: '👤', template: 'Adelanto de sueldo a: ' },
  { id: 'retiro_dueno', label: 'Retiro de Efectivo / Propietario', icon: '💵', template: 'Retiro de caja por propietario' },
  { id: 'gastos_limpieza', label: 'Limpieza y Oficina', icon: '🧹', template: 'Gastos de limpieza y artículos de oficina' },
  { id: 'refrigerio', label: 'Almuerzo / Refrigerio', icon: '🍕', template: 'Refrigerio de personal' },
  { id: 'flete_delivery', label: 'Flete / Delivery', icon: '🛵', template: 'Pago de flete / envíos' },
  { id: 'otro_egreso', label: 'Otro Egreso', icon: '🏷️', template: '' }
]

const QUICK_TAGS = ['Factura', 'Recibo', 'Sin Comprobante', 'Urgente', 'Reembolso']
const QUICK_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000]

export function POSCashMovementDialog({
  open,
  onOpenChange,
  onAddMovement,
  initialType = 'out',
  currentBalance = 0
}: POSCashMovementDialogProps) {
  const [movementType, setMovementType] = useState<'in' | 'out'>(initialType)
  const [amount, setAmount] = useState<string>('')
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setMovementType(initialType)
      setAmount('')
      setSelectedReason('')
      setNote('')
      setIsSaving(false)
    }
  }, [open, initialType])

  const parsedAmount = parseFloat(amount) || 0
  const isIncome = movementType === 'in'
  const newEstimatedBalance = isIncome 
    ? currentBalance + parsedAmount 
    : Math.max(0, currentBalance - parsedAmount)

  const handleAddQuickAmount = (val: number) => {
    setAmount(prev => {
      const current = parseFloat(prev) || 0
      return String(current + val)
    })
  }

  const handleSelectReason = (reason: ReasonOption) => {
    if (selectedReason === reason.label) {
      setSelectedReason('')
      return
    }
    setSelectedReason(reason.label)
    if (reason.template && !note.trim()) {
      setNote(reason.template)
    }
  }

  const handleAddTag = (tag: string) => {
    setNote(prev => {
      const trimmed = prev.trim()
      if (!trimmed) return `[${tag}] `
      if (trimmed.includes(`[${tag}]`)) return trimmed
      return `${trimmed} [${tag}]`
    })
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (parsedAmount <= 0) {
      toast.error('Ingrese un monto válido mayor a 0')
      return
    }

    if (!isIncome && currentBalance > 0 && parsedAmount > currentBalance) {
      toast.warning('Advertencia: El monto a retirar supera el efectivo disponible en caja')
    }

    const fullNote = [selectedReason, note.trim()].filter(Boolean).join(' - ')
    if (!fullNote) {
      toast.error('El detalle o motivo del movimiento es obligatorio')
      return
    }

    setIsSaving(true)
    try {
      const success = await onAddMovement(
        isIncome ? 'cash_in' : 'cash_out',
        parsedAmount,
        fullNote
      )

      if (success) {
        toast.success(
          isIncome ? 'Ingreso registrado correctamente' : 'Egreso registrado correctamente',
          {
            description: `${formatCurrency(parsedAmount)} • ${fullNote}`
          }
        )
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error('Error al registrar el movimiento: ' + (err?.message || 'Error desconocido'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        {/* Header Dinámico y Visible */}
        <DialogHeader className={cn(
          "p-5 sm:p-6 pr-12 border-b text-left transition-colors",
          isIncome 
            ? "bg-emerald-500/15 border-emerald-500/30" 
            : "bg-rose-500/15 border-rose-500/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center shadow-xs",
              isIncome 
                ? "bg-emerald-600 text-white" 
                : "bg-rose-600 text-white"
            )}>
              {isIncome ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  Registrar Movimiento de Caja
                </DialogTitle>
                <Badge 
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 border",
                    isIncome 
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" 
                      : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                  )}
                >
                  {isIncome ? 'Ingreso' : 'Egreso'}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Registra entradas o salidas manuales de efectivo en el turno activo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Selector de Tipo Segmentado */}
          <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => { setMovementType('in'); setSelectedReason(''); setNote(''); }}
              className={cn(
                "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                isIncome
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Ingreso de Efectivo
            </button>
            <button
              type="button"
              onClick={() => { setMovementType('out'); setSelectedReason(''); setNote(''); }}
              className={cn(
                "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                !isIncome
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownCircle className="h-4 w-4" />
              Egreso / Retiro
            </button>
          </div>

          {/* Campo de Monto Principal */}
          <div className="space-y-1.5">
            <Label htmlFor="mov-amount" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Monto a {isIncome ? 'ingresar' : 'retirar'}</span>
              {parsedAmount > 0 && (
                <span className={cn("font-bold text-xs", isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {formatCurrency(parsedAmount)}
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₲
              </span>
              <Input
                id="mov-amount"
                type="text"
                inputMode="numeric"
                value={formatThousands(amount)}
                onChange={(e) => setAmount(parseThousands(e.target.value).toString())}
                placeholder="0"
                autoFocus
                className="h-11 pl-9 pr-4 text-lg font-bold font-mono rounded-xl border-border/80 focus-visible:ring-primary/40 text-foreground"
              />
            </div>
          </div>

          {/* Botones de Montos Rápidos */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Montos rápidos (+):</span>
            <div className="grid grid-cols-3 gap-1.5">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddQuickAmount(val)}
                  className="py-1 px-2 text-[11px] font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/40 transition-all active:scale-95"
                >
                  +{formatCurrency(val)}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo Frecuente (Chips Inteligentes con Iconos) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Tag className="h-3 w-3 text-primary" /> Opciones Rápidas de Motivo
              </Label>
              {selectedReason && (
                <button
                  type="button"
                  onClick={() => setSelectedReason('')}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpiar selección
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(isIncome ? IN_REASONS : OUT_REASONS).map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => handleSelectReason(reason)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-all active:scale-95",
                    selectedReason === reason.label
                      ? isIncome
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs"
                        : "bg-rose-500/20 border-rose-500/50 text-rose-800 dark:text-rose-200 font-bold shadow-2xs"
                      : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <span>{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Etiquetas / Tags Rápidos de Comprobante */}
          <div className="space-y-1">
            <span className="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Etiquetas rápidas para comprobantes:
            </span>
            <div className="flex flex-wrap gap-1">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/50 text-muted-foreground transition-all"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Detalle o Nota Adicional (Obligatorio) */}
          <div className="space-y-1.5">
            <Label htmlFor="mov-note" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-muted-foreground" /> Detalle / Observación
                <span className="text-rose-500 font-bold">*</span>
              </span>
              {!note.trim() && !selectedReason ? (
                <span className="text-[10px] text-rose-500 font-medium bg-rose-500/10 px-1.5 py-0.2 rounded">
                  Obligatorio
                </span>
              ) : (
                note && (
                  <button
                    type="button"
                    onClick={() => setNote('')}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Borrar texto
                  </button>
                )
              )}
            </Label>
            <Input
              id="mov-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isIncome 
                  ? "Ej. Cambio de turno, reposición de monedas..." 
                  : "Ej. Pago factura distribuidor N° 1248..."
              }
              className="h-9 text-xs rounded-xl border-border/80"
              required
            />
          </div>

          {/* Resumen del Balance de Caja */}
          <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Saldo en Caja</span>
              <span className="font-bold text-foreground">{formatCurrency(currentBalance)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[10px]">Saldo Posterior Estimado</span>
              <span className={cn("font-bold", isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                {formatCurrency(newEstimatedBalance)}
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 text-xs flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || parsedAmount <= 0 || (!note.trim() && !selectedReason)}
              className={cn(
                "h-10 text-xs font-bold flex-1 text-white shadow-md rounded-xl gap-1.5 transition-all",
                isIncome 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-rose-600 hover:bg-rose-700",
                (!note.trim() && !selectedReason) ? "opacity-60 cursor-not-allowed" : ""
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isIncome ? 'Confirmar Ingreso' : 'Confirmar Egreso'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
