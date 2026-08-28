'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, X, Sparkles, Percent, Tag, AlertTriangle } from 'lucide-react'
import type { PromotionFilters as Filters } from '@/types/promotion'

interface PromotionFiltersProps {
  filters: Filters
  onUpdateFilters: (filters: Partial<Filters>) => void
  onClearFilters: () => void
}

const statusPills: Array<{ key: Filters['status']; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'scheduled', label: 'Programadas' },
  { key: 'expired', label: 'Por expirar' },
  { key: 'inactive', label: 'Inactivas' },
]

export function PromotionFilters({
  filters,
  onUpdateFilters,
  onClearFilters,
}: PromotionFiltersProps) {
  const activeFilterCount = [
    filters.search !== '',
    filters.status !== 'all',
    filters.type !== 'all',
    filters.alert !== 'all',
  ].filter(Boolean).length

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 sm:p-4 shadow-xs backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/50">
      {/* Top row: Search input + Type & Alert dropdowns */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input with modern styling */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, código de cupón..."
            value={filters.search}
            onChange={(e) => onUpdateFilters({ search: e.target.value })}
            className="h-10 rounded-xl pl-9 pr-9 text-xs sm:text-sm border-slate-200/90 bg-white dark:border-slate-700/80 dark:bg-slate-950 focus-visible:ring-cyan-500"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tipo de Descuento */}
          <div className="w-[140px] sm:w-[160px]">
            <Select
              value={filters.type}
              onValueChange={(value) => onUpdateFilters({ type: value as Filters['type'] })}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200/90 bg-white text-xs dark:border-slate-700/80 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 truncate">
                  <Percent className="h-3.5 w-3.5 text-cyan-600" />
                  <SelectValue placeholder="Tipo" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alertas */}
          <div className="w-[140px] sm:w-[160px]">
            <Select
              value={filters.alert}
              onValueChange={(value) => onUpdateFilters({ alert: value as Filters['alert'] })}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200/90 bg-white text-xs dark:border-slate-700/80 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <SelectValue placeholder="Alertas" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="all">Todas las alertas</SelectItem>
                <SelectItem value="expiring_soon">Por expirar pronto</SelectItem>
                <SelectItem value="unused">Sin uso</SelectItem>
                <SelectItem value="expired_active">Expiradas activas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-10 gap-1.5 rounded-xl px-3 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Bottom row: Quick Status Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
        <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline shrink-0">
          Estado:
        </span>
        {statusPills.map((pill) => {
          const isSelected = filters.status === pill.key
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onUpdateFilters({ status: pill.key })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all shrink-0 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
