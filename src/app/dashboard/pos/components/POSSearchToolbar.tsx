'use client'

import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type POSSearchToolbarProps = {
  value: string
  onChange: (value: string) => void
  categoryControl?: ReactNode
  installmentControl?: ReactNode
  advancedFilters?: ReactNode
}

export function POSSearchToolbar({ value, onChange, categoryControl, installmentControl, advancedFilters }: POSSearchToolbarProps) {
  return (
    <div role="search" aria-label="Buscar en el catálogo" className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 pl-9 pr-10 text-[13px]" placeholder="Buscar producto, código o servicio" />
        {value && <Button type="button" variant="ghost" size="icon" aria-label="Limpiar búsqueda" onClick={() => onChange('')} className="absolute right-0 top-0 min-h-10 min-w-10"><X className="h-4 w-4" /></Button>}
      </div>
      {categoryControl}
      {installmentControl}
      {advancedFilters}
    </div>
  )
}
