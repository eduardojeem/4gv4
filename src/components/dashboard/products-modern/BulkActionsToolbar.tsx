/**
 * BulkActionsToolbar Component
 * Fixed bottom toolbar for bulk operations on selected products
 */

import React, { useState } from 'react'
import { Edit, Trash2, Download, CheckCircle, XCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

export interface BulkActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkEdit?: () => void
  onBulkDelete?: () => void
  onBulkExport?: () => void
  onBulkActivate?: () => void
  onBulkDeactivate?: () => void
  className?: string
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkEdit,
  onBulkDelete,
  onBulkExport,
  onBulkActivate,
  onBulkDeactivate,
  className
}: BulkActionsToolbarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)

  if (selectedCount === 0) {
    return null
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    onBulkDelete?.()
    setDeleteDialogOpen(false)
  }

  const handleDeactivateClick = () => {
    setDeactivateDialogOpen(true)
  }

  const handleDeactivateConfirm = () => {
    onBulkDeactivate?.()
    setDeactivateDialogOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'animate-in slide-in-from-bottom-4 duration-300',
          className
        )}
      >
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
            {/* Selection Count */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full px-4 py-2">
                <span className="font-bold text-lg">{selectedCount}</span>
              </div>
              <span className="font-semibold">
                {selectedCount === 1 ? 'producto seleccionado' : 'productos seleccionados'}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-8 w-px bg-white/30" />

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {onBulkEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBulkEdit}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}

              {onBulkActivate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBulkActivate}
                  className="bg-green-500/80 hover:bg-green-600 text-white border-green-400/30"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activar
                </Button>
              )}

              {onBulkDeactivate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDeactivateClick}
                  className="bg-amber-500/80 hover:bg-amber-600 text-white border-amber-400/30"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Desactivar
                </Button>
              )}

              {onBulkExport && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBulkExport}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              )}

              {onBulkDelete && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="bg-red-500/80 hover:bg-red-600 text-white border-red-400/30"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-8 w-px bg-white/30" />

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar productos seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente {selectedCount} {selectedCount === 1 ? 'producto' : 'productos'}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar productos seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará {selectedCount} {selectedCount === 1 ? 'producto' : 'productos'}.
              Los productos desactivados no aparecerán en el catálogo pero podrás reactivarlos más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateConfirm}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
