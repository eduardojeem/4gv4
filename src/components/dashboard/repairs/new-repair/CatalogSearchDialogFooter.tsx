'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CatalogSearchDialogFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 sm:ml-auto sm:w-auto"
        aria-label="Cerrar buscador"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
        Cerrar
      </Button>
    </div>
  )
}
