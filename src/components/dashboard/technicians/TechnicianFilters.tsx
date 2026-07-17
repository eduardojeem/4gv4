'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TechnicianFiltersProps {
  searchTerm: string
  setSearchTerm: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  sortBy: string
  setSortBy: (value: string) => void
  resultCount?: number
  totalCount?: number
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
}: TechnicianFiltersProps) {
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  const showCount = resultCount !== undefined && totalCount !== undefined

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="search-technicians"
          placeholder="Buscar técnico..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-8 h-9 bg-background/60 border-border/50 focus:border-primary/50 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className={cn(
          'h-9 w-[150px] bg-background/60 border-border/50 transition-colors',
          statusFilter !== 'all' && 'border-primary/50 text-primary bg-primary/5',
        )}>
          <SelectValue placeholder="Carga" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las cargas</SelectItem>
          <SelectItem value="no_load">Sin carga</SelectItem>
          <SelectItem value="light_load">Carga baja</SelectItem>
          <SelectItem value="medium_load">Carga media</SelectItem>
          <SelectItem value="high_load">Carga alta</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="h-9 w-[170px] bg-background/60 border-border/50">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Nombre (A–Z)</SelectItem>
          <SelectItem value="activeJobs">Trabajos activos</SelectItem>
          <SelectItem value="completedThisMonth">Cierres este mes</SelectItem>
          <SelectItem value="totalCompleted">Total cerrados</SelectItem>
          <SelectItem value="workload">Carga de trabajo</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}

      {/* Result count badge */}
      {showCount && (
        <Badge
          variant="secondary"
          className={cn(
            'ml-auto h-7 rounded-full px-3 text-xs font-semibold tabular-nums',
            resultCount! < totalCount! && 'bg-primary/10 text-primary border border-primary/20',
          )}
        >
          {resultCount === totalCount
            ? `${totalCount} técnicos`
            : `${resultCount} de ${totalCount}`}
        </Badge>
      )}
    </div>
  )
}
