'use client'

import { Filter, RotateCcw, Search } from 'lucide-react'
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
  filteredCount,
  totalCount,
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
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9 text-sm"
            placeholder="Buscar tenant, owner, provider o ID…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        {/* Plan */}
        <Select value={plan} onValueChange={onPlanChange}>
          <SelectTrigger className="w-full xl:w-[130px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los planes</SelectItem>
            {planOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full xl:w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Provider */}
        <Select value={provider} onValueChange={onProviderChange}>
          <SelectTrigger className="w-full xl:w-[130px]">
            <SelectValue placeholder="Proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {providerOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortValue)}>
          <SelectTrigger className="w-full xl:w-[140px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="attention">Prioridad</SelectItem>
            <SelectItem value="renewal">Renovación</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="plan">Plan</SelectItem>
            <SelectItem value="name">Nombre</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear */}
        <Button
          variant="outline"
          size="icon"
          title="Limpiar filtros"
          onClick={onClear}
          disabled={!hasActiveFilters}
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Filter className="h-3.5 w-3.5" />
        <span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredCount}</span>
          {' de '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{totalCount}</span>
          {' suscripciones'}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
