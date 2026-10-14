'use client'

import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StatusCounts {
  all: number
  no_load: number
  active_load: number
  high_load: number
}

interface TechnicianFiltersProps {
  searchTerm: string
  setSearchTerm: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  sortBy: string
  setSortBy: (value: string) => void
  resultCount?: number
  totalCount?: number
  counts?: StatusCounts
}

export function TechnicianFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  resultCount,
  totalCount,
  counts,
}: TechnicianFiltersProps) {
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  const showCount = resultCount !== undefined && totalCount !== undefined

  const statusChips = [
    { id: 'all', label: 'Todos', count: counts?.all },
    { id: 'no_load', label: 'Disponibles', count: counts?.no_load, dot: 'bg-emerald-500' },
    { id: 'active_load', label: 'Carga activa', count: counts?.active_load, dot: 'bg-blue-500' },
    { id: 'high_load', label: 'Sobrecargados', count: counts?.high_load, dot: 'bg-rose-500' },
  ]

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quick status chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {statusChips.map((chip) => {
            const isActive = statusFilter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 shrink-0 border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card/70 text-muted-foreground border-border/60 hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {chip.dot && (
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isActive ? 'bg-primary-foreground' : chip.dot,
                    )}
                  />
                )}
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Counter */}
        {showCount && (
          <Badge
            variant="outline"
            className={cn(
              'h-7 rounded-full px-3 text-xs font-semibold tabular-nums shrink-0',
              resultCount! < totalCount!
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/60 bg-muted/30 text-muted-foreground',
            )}
          >
            {resultCount === totalCount
              ? `${totalCount} técnicos`
              : `${resultCount} de ${totalCount} técnicos`}
          </Badge>
        )}
      </div>

      {/* Row 2: Search input, Sort select & clear */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="search-technicians"
            placeholder="Buscar técnico por nombre o especialidad…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8 h-9 bg-card/80 border-border/70 focus:border-primary/50 text-xs sm:text-sm transition-colors shadow-2xs rounded-xl"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Granular status select for fine-tuned selection */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[150px] bg-card/80 border-border/70 rounded-xl text-xs font-medium shadow-2xs shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Estado carga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cargas</SelectItem>
            <SelectItem value="no_load">Sin carga</SelectItem>
            <SelectItem value="light_load">Carga baja (1-2)</SelectItem>
            <SelectItem value="medium_load">Carga media (3-4)</SelectItem>
            <SelectItem value="high_load">Carga alta (5+)</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-[170px] bg-card/80 border-border/70 rounded-xl text-xs font-medium shadow-2xs shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre (A–Z)</SelectItem>
            <SelectItem value="activeJobs">Más trabajos activos</SelectItem>
            <SelectItem value="completedThisMonth">Más cierres este mes</SelectItem>
            <SelectItem value="totalCompleted">Total histórico</SelectItem>
            <SelectItem value="workload">Mayor porcentaje carga</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl px-3"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
