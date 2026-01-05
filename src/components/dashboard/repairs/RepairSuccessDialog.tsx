'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, Printer } from 'lucide-react'
import { RepairPrintPayload, printRepairReceipt } from '@/lib/repair-receipt'

interface RepairSuccessDialogProps {
  open: boolean
  onClose: () => void
  data: RepairPrintPayload | null
}

export function RepairSuccessDialog({
  open,
  onClose,
  data
}: RepairSuccessDialogProps) {
  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-center">Reparación Registrada</DialogTitle>
          <DialogDescription className="text-center">
            La reparación ha sido registrada exitosamente.
            ¿Desea imprimir los comprobantes?
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          <Button 
            className="w-full gap-2" 
            onClick={() => printRepairReceipt('customer', data)}
          >
            <Printer className="h-4 w-4" />
            Imprimir Comprobante Cliente
          </Button>
          
          <Button 
            className="w-full gap-2" 
            variant="outline"
            onClick={() => printRepairReceipt('technician', data)}
          >
            <Printer className="h-4 w-4" />
            Imprimir Ficha Técnica
          </Button>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
