'use client'

import { useId, useState } from 'react'
import { Check, ChevronsUpDown, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { removeAccents } from '@/lib/public/city-normalizer'
import type { CityFacet } from '@/lib/public/empresas-filters'

type Props = {
  cities: CityFacet[]
  value: string
  selectedLabel: string
  total: number
  onChange: (city: string) => void
}

export function CompanyCityFilter({ cities, value, selectedLabel, total, onChange }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const visibleCities = cities.filter((city) => removeAccents(city.display).includes(removeAccents(query)))
  const choose = (city: string) => {
    onChange(city)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Ubicación</label>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery('') }}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" role="combobox" aria-label="Filtrar por ciudad" aria-expanded={open}
            className="h-11 w-full justify-between gap-2 rounded-xl bg-background px-3 text-sm font-normal">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">
              {value === 'all' ? 'Todas las ciudades' : selectedLabel}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[calc(100vw-2rem)] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar ciudad..." aria-label="Buscar ciudad" value={query}
              onValueChange={setQuery} className="text-base sm:text-sm" />
            <CommandList className="max-h-64" aria-label="Ciudades disponibles">
              <CommandGroup>
                <CommandItem value="all" onSelect={() => choose('all')} className="min-h-11 gap-2">
                  <Check className={`h-4 w-4 shrink-0 ${value === 'all' ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                  <span>Todas las ciudades ({total})</span>
                </CommandItem>
                {visibleCities.map((city) => (
                  <CommandItem key={city.key} value={city.key} disabled={city.count === 0}
                    onSelect={() => choose(city.key)} className="min-h-11 gap-2">
                    <Check className={`h-4 w-4 shrink-0 ${value === city.key ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                    <span>{city.display} ({city.count})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {visibleCities.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
                {cities.length === 0 ? 'Las empresas todavía no tienen una ciudad informada.' : 'No se encontraron ciudades para esa búsqueda.'}
              </p>}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
