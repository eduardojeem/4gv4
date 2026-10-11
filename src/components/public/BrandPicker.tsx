'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, Check, ChevronDown, Tags } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export type BrandPickerOption = { name: string; count: number; logo_url?: string | null }

const plain = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Selector de marca del catálogo, igual al de categorías: era un `<select>`
 * nativo al lado de un selector con buscador, y no combinaban. Con decenas de
 * marcas, escribir dos letras es más rápido que recorrer la lista.
 */
export function BrandPicker({
  options,
  active,
  onSelect,
}: {
  options: BrandPickerOption[]
  active: string
  onSelect: (brand: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const activeOption = options.find((option) => option.name.toLowerCase() === active.toLowerCase())
  const label = activeOption?.name ?? (active || 'Marcas')
  const term = plain(search)
  const visible = useMemo(() => (term ? options.filter((option) => plain(option.name).includes(term)) : options), [options, term])
  const activeValue = activeOption ? `marca-${activeOption.name}` : 'todas'

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const list = listRef.current
      const item = list?.querySelector<HTMLElement>(`[data-value="${CSS.escape(activeValue)}"]`)
      if (!list || !item) return
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - item.offsetHeight) / 2
    })
    return () => clearTimeout(timer)
  }, [open, activeValue])

  const choose = (brand: string) => {
    onSelect(brand)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={active ? `Marca: ${label}. Cambiar marca` : 'Filtrar por marca'}
          className={cn(
            'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2 text-[11px] font-semibold shadow-2xs transition-colors sm:h-9 sm:w-auto sm:max-w-[200px] sm:rounded-xl sm:px-2.5 sm:text-xs',
            active ? 'border-primary/60 text-primary ring-1 ring-primary/20' : 'border-border/80 text-foreground hover:border-primary/50'
          )}
        >
          {activeOption?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos chicos de otros dominios
            <img src={activeOption.logo_url} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain" />
          ) : (
            <Tags className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(18rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false} label="Marcas" defaultValue={activeValue}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar marca…" className="text-base sm:text-sm" />
          <CommandList ref={listRef} className="max-h-[min(20rem,55vh)] overflow-y-auto overscroll-contain p-1">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Ninguna marca se llama así.</CommandEmpty>

            {!term && (
              <CommandItem value="todas" onSelect={() => choose('')} className="gap-2 rounded-lg px-2 py-2 text-xs font-semibold">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Todas las marcas</span>
                {!active && <Check className="h-3.5 w-3.5 text-primary" />}
              </CommandItem>
            )}

            {visible.map((option) => {
              const selected = option === activeOption
              return (
                <CommandItem
                  key={option.name}
                  value={`marca-${option.name}`}
                  onSelect={() => choose(option.name)}
                  className={cn('gap-2 rounded-lg px-2 py-2 text-xs font-semibold', selected && 'bg-primary/10 text-primary')}
                >
                  {option.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logos chicos de otros dominios
                    <img src={option.logo_url} alt="" loading="lazy" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
                  ) : (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">{option.count}</span>
                  <Check className={cn('h-3.5 w-3.5 text-primary', selected ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
