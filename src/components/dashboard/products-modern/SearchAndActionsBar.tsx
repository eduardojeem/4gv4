/**
 * SearchAndActionsBar Component
 * Container for search, filters, view mode, and actions
 */

import React from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  groupBy?: GroupByMode
  onGroupByChange?: (mode: GroupByMode) => void
  isMaximizedSpace?: boolean
  onToggleMaximizeSpace?: () => void
  onRefresh: () => void
  onExport: () => void
  onExportPdf?: () => void
  onImport?: () => void
  isLoading?: boolean
  className?: string
}

export function SearchAndActionsBar({
  searchQuery,
  onSearchChange,
  isFilterPanelOpen,
  onToggleFilters,
  viewMode,
  onViewModeChange,
  groupBy = 'none',
  onGroupByChange,
  isMaximizedSpace = false,
  onToggleMaximizeSpace,
  onRefresh,
  onExport,
  onExportPdf,
  onImport,
  isLoading = false,
  className
}: SearchAndActionsBarProps) {
  return (
    <Card className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm backdrop-blur-md overflow-hidden', className)}>
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row">
          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
          />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle */}
            <FilterToggle
              isOpen={isFilterPanelOpen}
              onToggle={onToggleFilters}
            />

            {/* Group By Selector (Desglose por secciones) */}
            {onGroupByChange && (
              <GroupBySelector
                groupBy={groupBy}
                onGroupByChange={onGroupByChange}
              />
            )}

            {/* View Mode Selector */}
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />

            {/* Maximize space for products toggle */}
            {onToggleMaximizeSpace && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleMaximizeSpace}
                className={cn(
                  'h-9 px-2.5 text-xs font-semibold rounded-xl gap-1.5 transition-all shadow-xs',
                  isMaximizedSpace
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                )}
                title={isMaximizedSpace ? 'Restaurar resumen superior' : 'Maximizar espacio vertical para productos'}
              >
                {isMaximizedSpace ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">Ver resumen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Más espacio</span>
                  </>
                )}
              </Button>
            )}

            {/* Action Buttons */}
            <ActionButtons
              onRefresh={onRefresh}
              onExport={onExport}
              onExportPdf={onExportPdf}
              onImport={onImport}
              isLoading={isLoading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
