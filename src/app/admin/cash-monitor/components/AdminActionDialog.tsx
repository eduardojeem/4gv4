'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  XCircle,
  PauseCircle,
  Lock,
  Unlock,
  PlayCircle,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import type { CashSession, AdminAction } from '../types'

interface AdminActionDialogProps {
  open: boolean
  action: AdminAction | null
  session: CashSession | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

const actionMeta: Record<string, {
  title: string
  description: string
  icon: typeof XCircle
  color: string
  buttonLabel: string
  buttonVariant: 'default' | 'destructive' | 'outline'
  warning?: string
}> = {
  remote_close: {
    title: 'Cerrar Caja Remotamente',
    description: 'Esta acción cerrará la caja inmediatamente. El cajero perderá acceso a la sesión activa.',
    icon: XCircle,
    color: 'text-red-500',
    buttonLabel: 'Cerrar Caja',
    buttonVariant: 'destructive',
    warning: 'El cajero no podrá realizar más operaciones en esta sesión.'
  },
  suspend: {
    title: 'Suspender Caja',
    description: 'La caja quedará en estado suspendido. No se podrán realizar operaciones hasta que sea reactivada.',
    icon: PauseCircle,
    color: 'text-amber-500',
    buttonLabel: 'Suspender',
    buttonVariant: 'default'
  },
  unsuspend: {
    title: 'Reactivar Caja',
    description: 'La caja volverá a estado activo y el cajero podrá continuar operando.',
    icon: PlayCircle,
    color: 'text-emerald-500',
    buttonLabel: 'Reactivar',
    buttonVariant: 'default'
  },
  block: {
    title: 'Bloquear Caja',
    description: 'La caja será bloqueada completamente. Solo un administrador podrá desbloquearla.',
    icon: Lock,
    color: 'text-red-600',
    buttonLabel: 'Bloquear',
    buttonVariant: 'destructive',
    warning: 'Esta es una acción de seguridad. Use solo en casos de sospecha de fraude o irregularidades graves.'
  },
  unblock: {
    title: 'Desbloquear Caja',
    description: 'La caja será desbloqueada y volverá a estado operativo.',
    icon: Unlock,
    color: 'text-blue-500',
    buttonLabel: 'Desbloquear',
    buttonVariant: 'default'
  },
  reopen: {
    title: 'Reabrir Caja',
    description: 'La sesión cerrada será reabierta. Use con precaución ya que puede afectar la integridad de los reportes.',
    icon: RotateCcw,
    color: 'text-violet-500',
    buttonLabel: 'Reabrir',
    buttonVariant: 'default',
    warning: 'Reabrir una caja cerrada puede generar inconsistencias en los reportes financieros.'
  }
}

export function AdminActionDialog({ open, action, session, onConfirm, onCancel }: AdminActionDialogProps) {
  const [reason, setReason] = useState('')

  if (!action || !session) return null

  const meta = actionMeta[action] || {
    title: 'Acción',
    description: 'Confirme la acción.',
    icon: AlertTriangle,
    color: 'text-slate-500',
    buttonLabel: 'Confirmar',
    buttonVariant: 'default' as const
  }

  const Icon = meta.icon

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('')
  }

  const handleCancel = () => {
    setReason('')
    onCancel()
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.color}`} />
            {meta.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">{meta.description}</span>
            <span className="block text-xs">
              <strong>Caja:</strong> {session.register_id} • <strong>Sucursal:</strong> {session.branch_id}
            </span>
            {meta.warning && (
              <span className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{meta.warning}</span>
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="reason" className="text-sm font-medium">
            Motivo <span className="text-red-500">*</span>
          </Label>
          <Input
            id="reason"
            placeholder="Ingrese el motivo de esta acción..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Este motivo quedará registrado en el log de auditoría.
          </p>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            variant={meta.buttonVariant}
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            {meta.buttonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
