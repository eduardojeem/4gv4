/**
 * ActionButtons Component
 * Refresh, import, and export action buttons
 */

import React from 'react'
import { FileSpreadsheet, FileText, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ActionButtonsProps {
  onRefresh: () => void
  onExport: () => void
  onExportPdf?: () => void
  onImport?: () => void
  isLoading?: boolean
  className?: string
}

export function ActionButtons({
  onRefresh,
  onExport,
  onExportPdf,
  onImport,
  isLoading = false,
  className
}: ActionButtonsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label="Acciones del dashboard">
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
      {onImport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onImport}
          aria-label="Importar productos desde CSV"
          title="Importar CSV"
          className="h-11 gap-2 px-3"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>Importar</span>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        aria-label="Exportar productos a CSV"
        title="Exportar CSV"
        className="h-11 gap-2 px-3"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        <span>Descargar CSV</span>
      </Button>
      {onExportPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPdf}
          aria-label="Descargar productos en PDF"
          title="Descargar PDF"
          className="h-11 gap-2 px-3"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>Descargar PDF</span>
        </Button>
      )}
    </div>
  )
}
