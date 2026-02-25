'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, PackageX, Wrench, Loader2 } from 'lucide-react'
import { Repair, RepairDeliveryOutcome } from '@/types/repairs'

interface RepairDeliveryDialogProps {
  open: boolean
  repair: Repair | null
  onOpenChange: (open: boolean) => void
  onConfirm: (repairId: string, outcome: RepairDeliveryOutcome, note?: string) => Promise<void>
}

const outcomes: {
  value: RepairDeliveryOutcome
  label: string
  description: string
  icon: React.ElementType
  color: string
  border: string
  bg: string
}[] = [
  {
    value: 'repaired',
    label: 'Reparado y funcionando',
    description: 'El equipo fue reparado correctamente y funciona sin problemas.',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    value: 'withdrawn',
    label: 'Retirado sin reparar',
    description: 'El cliente retiró el equipo antes de completar la reparación.',
    icon: PackageX,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-400 dark:border-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    value: 'unrepairable',
    label: 'No fue posible reparar',
    description: 'El equipo tiene daños irreparables o no se encontraron los repuestos.',
    icon: Wrench,
    color: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-400 dark:border-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
  },
]

export function RepairDeliveryDialog({
  open,
  repair,
  onOpenChange,
  onConfirm,
}: RepairDeliveryDialogProps) {
  const [selected, setSelected] = useState<RepairDeliveryOutcome | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    if (isSubmitting) return
    setSelected(null)
    setNote('')
    onOpenChange(false)
  }

  const handleConfirm = async () => {
    if (!repair || !selected) return
    setIsSubmitting(true)
    try {
      await onConfirm(repair.id, selected, note || undefined)
      setSelected(null)
      setNote('')
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!repair) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Confirmar Entrega
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                </Badge>
                <span className="text-sm font-medium text-foreground">
                  {repair.customer.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {repair.brand} {repair.model} — {repair.issue}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm font-medium">¿Cuál fue el resultado?</p>
          <div className="flex flex-col gap-2">
            {outcomes.map((o) => {
              const Icon = o.icon
              const isSelected = selected === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSelected(o.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all duration-150',
                    isSelected
                      ? `${o.border} ${o.bg}`
                      : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                  )}
                >
                  <Icon
                    className={cn('mt-0.5 h-5 w-5 shrink-0', isSelected ? o.color : 'text-muted-foreground')}
                  />
                  <div>
                    <p className={cn('text-sm font-semibold', isSelected ? o.color : 'text-foreground')}>
                      {o.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-sm font-medium text-muted-foreground">
              Nota de entrega <span className="text-xs">(opcional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Se cambió la pantalla, el cliente quedó conforme..."
              rows={2}
              className="resize-none text-sm"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar Entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
