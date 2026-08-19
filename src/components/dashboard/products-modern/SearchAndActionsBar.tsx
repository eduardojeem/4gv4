/**
 * SearchAndActionsBar Component
 * Container for search, filters, view mode, and actions
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SearchBar } from './SearchBar'
import { FilterToggle } from './FilterToggle'
import { ViewModeSelector } from './ViewModeSelector'
import { ActionButtons } from './ActionButtons'
import { ViewMode } from '@/types/products-dashboard'
import { cn } from '@/lib/utils'

export interface SearchAndActionsBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  isFilterPanelOpen: boolean
  onToggleFilters: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
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

            {/* View Mode Selector */}
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />

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
