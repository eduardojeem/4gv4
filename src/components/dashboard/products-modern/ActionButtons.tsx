/**
 * ActionButtons Component
 * Compact and clean data actions: Refresh, Import, and Multi-Format Export (Excel, CSV, PDF)
 */

import React from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText, RefreshCw, Upload, FileCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ActionButtonsProps {
  onRefresh: () => void
  onExport: () => void
  onExportExcel?: () => void
  onExportCsv?: () => void
  onExportPdf?: () => void
  onImport?: () => void
  selectedCount?: number
  isLoading?: boolean
  className?: string
}

export function ActionButtons({
  onRefresh,
  onExport,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onImport,
  selectedCount = 0,
  isLoading = false,
  className,
}: ActionButtonsProps) {
  const handleExportExcel = onExportExcel || onExport
  const handleExportCsv = onExportCsv || onExport

  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Acciones del dashboard">
      {/* Actualizar */}
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        aria-label={isLoading ? 'Actualizando datos...' : 'Actualizar datos'}
        title="Actualizar catálogo"
        className="h-10 w-10 rounded-xl border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
      >
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin text-blue-600')} aria-hidden="true" />
        <span className="sr-only">{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
      </Button>

      {/* Importar */}
      {onImport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onImport}
          aria-label="Importar productos desde Excel o CSV"
          title="Importar catálogo (.xlsx, .csv)"
          className="h-10 gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
        >
          <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden sm:inline">Importar</span>
        </Button>
      )}

      {/* Exportar desplegable */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Opciones de exportación"
            title="Exportar productos a Excel, CSV o PDF"
            className="h-10 gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Exportar</span>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                {selectedCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-2xl shadow-xl">
          <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 flex items-center justify-between">
            <span>Exportar Catálogo</span>
            {selectedCount > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-semibold normal-case">
                {selectedCount} seleccionados
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Opción 1: Excel (.xlsx) */}
          <DropdownMenuItem
            onClick={handleExportExcel}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
          >
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Excel (.xlsx)</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-emerald-600 border-emerald-300">Recomendado</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">Formateado con hoja de resumen</span>
            </div>
          </DropdownMenuItem>

          {/* Opción 2: CSV (.csv) */}
          <DropdownMenuItem
            onClick={handleExportCsv}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
          >
            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileCode className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900 dark:text-slate-100">CSV Universal (.csv)</span>
              <span className="text-[10px] text-muted-foreground">Compatible con ERPs y reimportación</span>
            </div>
          </DropdownMenuItem>

          {/* Opción 3: PDF (.pdf) */}
          {onExportPdf && (
            <DropdownMenuItem
              onClick={onExportPdf}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer"
            >
              <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Descargar PDF (.pdf)</span>
                <span className="text-[10px] text-muted-foreground">Lista de precios imprimible</span>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
