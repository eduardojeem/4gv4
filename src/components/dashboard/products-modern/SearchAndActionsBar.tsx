/**
 * SearchAndActionsBar Component
 * Container for search, filters, view mode, and actions
 */

import React from 'react'
import { BookmarkCheck, Save, RotateCcw, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchBar } from './SearchBar'
import { FilterToggle } from './FilterToggle'
import { ViewModeSelector } from './ViewModeSelector'
import { GroupBySelector } from './GroupBySelector'
import { ActionButtons } from './ActionButtons'
import { ViewMode, GroupByMode } from '@/types/products-dashboard'
import { cn } from '@/lib/utils'

export interface SearchAndActionsBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  isFilterPanelOpen: boolean
  onToggleFilters: () => void
  activeFiltersCount?: number
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  groupBy?: GroupByMode
  onGroupByChange?: (mode: GroupByMode) => void
  onSaveDefaultGroupBy?: () => void
  onSavePreferences?: () => void
  onResetPreferences?: () => void
  hasSavedPreferences?: boolean
  showSummary?: boolean
  onToggleSummary?: () => void
  onRefresh: () => void
  onExport: () => void
  onExportExcel?: () => void
  onExportCsv?: () => void
  onExportPdf?: () => void
  onImport?: () => void
  selectedCount?: number
  isLoading?: boolean
  className?: string
  /** Se reenvia al agrupador: sin servicios no se ofrece agrupar por tipo. */
  showServices?: boolean
}

export function SearchAndActionsBar({
  showServices = true,
  searchQuery,
  onSearchChange,
  isFilterPanelOpen,
  onToggleFilters,
  activeFiltersCount = 0,
  viewMode,
  onViewModeChange,
  groupBy = 'none',
  onGroupByChange,
  onSaveDefaultGroupBy,
  onSavePreferences,
  onResetPreferences,
  hasSavedPreferences = false,
  showSummary = false,
  onToggleSummary,
  onRefresh,
  onExport,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onImport,
  selectedCount = 0,
  isLoading = false,
  className
}: SearchAndActionsBarProps) {
  return (
    <Card className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/60 shadow-sm backdrop-blur-md overflow-hidden', className)}>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Fila 1: Buscador amplio y herramientas de datos (Actualizar, Importar, Exportar) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
          />

          <ActionButtons
            onRefresh={onRefresh}
            onExport={onExport}
            onExportExcel={onExportExcel}
            onExportCsv={onExportCsv}
            onExportPdf={onExportPdf}
            onImport={onImport}
            selectedCount={selectedCount}
            isLoading={isLoading}
            className="self-end sm:self-auto shrink-0"
          />
        </div>

        {/* Divisor sutil */}
        <div className="border-t border-slate-100 dark:border-slate-800/80" />

        {/* Fila 2: Filtros, Por Tipo, Guardar vista y Más espacio */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Lado Izquierdo: Filtros y Desglose */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterToggle
              isOpen={isFilterPanelOpen}
              onToggle={onToggleFilters}
              activeCount={activeFiltersCount}
            />

            {onGroupByChange && (
              <GroupBySelector
                groupBy={groupBy}
                onGroupByChange={onGroupByChange}
                onSaveDefault={onSaveDefaultGroupBy}
                showServices={showServices}
              />
            )}
          </div>

          {/* Lado Derecho: Modos de Vista, Guardar vista y Más espacio */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto md:ml-auto">
            {/* View Mode Selector */}
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-0.5" />

            {/* Guardar Preferencias de Vista y Filtros */}
            {onSavePreferences && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-10 px-3 text-xs font-semibold rounded-xl gap-2 transition-all shadow-xs',
                      hasSavedPreferences
                        ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                    title="Guardar o restablecer vista predeterminada"
                  >
                    <BookmarkCheck className={cn('h-3.5 w-3.5', hasSavedPreferences ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')} />
                    <span>Guardar vista</span>
                    {hasSavedPreferences && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-xl">
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                    Preferencias de Vista
                  </DropdownMenuLabel>
                  <p className="text-[11px] text-muted-foreground px-2 pb-2 leading-relaxed">
                    Guardá tu filtro actual, modo de vista y desglose para que se apliquen siempre al abrir el catálogo.
                  </p>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onSavePreferences}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer text-primary hover:bg-primary/10"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Guardar vista actual como predeterminada</span>
                  </DropdownMenuItem>
                  {onResetPreferences && (
                    <DropdownMenuItem
                      onClick={onResetPreferences}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer text-muted-foreground hover:bg-muted"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restablecer vista del sistema</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Botón para expandir / activar Resumen de Inventario */}
            {onToggleSummary && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleSummary}
                className={cn(
                  'h-10 px-3 text-xs font-semibold rounded-xl gap-2 transition-all shadow-xs cursor-pointer',
                  showSummary
                    ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                    : 'border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                title={showSummary ? 'Ocultar resumen de inventario' : 'Ver y expandir resumen de inventario'}
                aria-pressed={showSummary}
              >
                <BarChart3 className={cn('h-3.5 w-3.5', showSummary ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')} />
                <span>{showSummary ? 'Ocultar resumen' : 'Ver resumen'}</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
