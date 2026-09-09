'use client'

import { RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SortValue } from './types'

type Props = {
  query: string
  plan: string
  status: string
  provider: string
  sort: SortValue
  planOptions: string[]
  statusOptions: string[]
  providerOptions: string[]
  filteredCount: number
  totalCount: number
  onQueryChange: (value: string) => void
  onPlanChange: (value: string) => void
  onStatusChange: (value: string) => void
  onProviderChange: (value: string) => void
  onSortChange: (value: SortValue) => void
  onClear: () => void
}

export function SubscriptionFilters({
  query,
  plan,
  status,
  provider,
  sort,
  planOptions,
  statusOptions,
  providerOptions,
  onQueryChange,
  onPlanChange,
  onStatusChange,
  onProviderChange,
  onSortChange,
  onClear,
}: Props) {
  const hasActiveFilters =
    query !== '' || plan !== 'ALL' || status !== 'ALL' || provider !== 'ALL' || sort !== 'attention'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Buscar tenant, owner, ID…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      {/* Plan */}
      <Select value={plan} onValueChange={onPlanChange}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos los planes</SelectItem>
          {planOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos los estados</SelectItem>
          {statusOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Provider */}
      <Select value={provider} onValueChange={onProviderChange}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Proveedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos</SelectItem>
          {providerOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sort} onValueChange={(v) => onSortChange(v as SortValue)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="attention">Prioridad</SelectItem>
          <SelectItem value="renewal">Renovación</SelectItem>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="plan">Plan</SelectItem>
          <SelectItem value="name">Nombre A-Z</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear */}
      <Button
        variant="ghost"
        size="icon"
        title="Limpiar filtros"
        onClick={onClear}
        disabled={!hasActiveFilters}
        className="h-8 w-8 shrink-0 cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
