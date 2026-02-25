'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface RepairDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    repairContext?: {
        ticketNumber?: string | null
        customerName?: string
    }
}

export function RepairDeleteDialog({ open, onOpenChange, onConfirm, repairContext }: RepairDeleteDialogProps) {
    const identifier = repairContext?.ticketNumber
        ? `#${repairContext.ticketNumber}`
        : 'esta reparación'
    const customer = repairContext?.customerName

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar {identifier}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {customer && (
                            <span className="block font-medium text-foreground mb-1">
                                Cliente: {customer}
                            </span>
                        )}
                        Esta acción no se puede deshacer. Esto eliminará permanentemente la reparación y todos los datos asociados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
