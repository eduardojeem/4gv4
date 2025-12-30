/**
 * ActionButtons Component
 * Refresh and export action buttons
 */

import React from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ActionButtonsProps {
  onRefresh: () => void
  onExport: () => void
  isLoading?: boolean
  className?: string
}

export function ActionButtons({
  onRefresh,
  onExport,
  isLoading = false,
  className
}: ActionButtonsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Acciones del dashboard">
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        aria-label={isLoading ? 'Actualizando datos...' : 'Actualizar datos'}
        title="Actualizar"
        className="h-11 w-11"
      >
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
        <span className="sr-only">{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onExport}
        aria-label="Exportar productos a CSV"
        title="Exportar"
        className="h-11 w-11"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Exportar</span>
      </Button>
    </div>
  )
}
