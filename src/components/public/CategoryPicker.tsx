'use client'

import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, CornerDownRight, LayoutGrid } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import type { MarketplaceCategory } from '@/lib/public/marketplace'
import { getCategoryIcon } from './CategoryCarousel'
import { cn } from '@/lib/utils'

export type CategoryPickerOption = {
  category: MarketplaceCategory
  children: MarketplaceCategory[]
}

/** Sin tildes ni mayúsculas: «electronica» encuentra «Electrónica». */
const plain = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Selector de categoría del catálogo.
 *
 * Era un `<select>` nativo: sin buscador, sin iconos, con las ramas como
 * `optgroup` que cada celular dibuja distinto y un ancho fijado por la opción
 * más larga. Acá se busca escribiendo, cada categoría muestra cuántos productos
 * tiene, las ramas van debajo de su categoría y lo elegido queda marcado.
 */
export function CategoryPicker({
  options,
  activeCategory,
  activeSubcategory,
  onSelect,
}: {
  options: CategoryPickerOption[]
  activeCategory: string
  activeSubcategory: string
  onSelect: (categoryId: string, subcategoryId?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Las más pedidas primero: para encontrar una por nombre está el buscador.
  const sorted = useMemo(
    () => [...options].sort((a, b) => b.category.product_count - a.category.product_count || a.category.name.localeCompare(b.category.name, 'es')),
    [options]
  )

  const term = plain(search)
  const visible = useMemo(() => {
    if (!term) return sorted
    return sorted
      .map(({ category, children }) => {
        const parentMatches = plain(category.name).includes(term)
        const matchingChildren = children.filter((child) => plain(child.name).includes(term))
        // Si coincide la categoría se muestran todas sus ramas; si solo
        // coincide una rama, se muestra con su categoría para dar contexto.
        if (parentMatches) return { category, children }
        if (matchingChildren.length > 0) return { category, children: matchingChildren }
        return null
      })
      .filter((option): option is CategoryPickerOption => option !== null)
  }, [sorted, term])

  const activeParent = options.find((option) => option.category.id === activeCategory)
  const activeChild = activeParent?.children.find((child) => child.id === activeSubcategory)
  const label = activeChild?.name ?? activeParent?.category.name ?? 'Categorías'
  const isFiltered = Boolean(activeCategory)

  // Al abrir, la lista arranca en lo elegido: con una rama marcada quedaba
  // fuera de la vista, debajo de veinte categorías.
  const activeValue = activeSubcategory ? `sub-${activeSubcategory}` : activeCategory ? `cat-${activeCategory}` : 'todas'
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const list = listRef.current
      const item = list?.querySelector<HTMLElement>('[data-value="' + activeValue + '"]')
      if (!list || !item) return
      // Solo la lista: `scrollIntoView` movería también la página.
      list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - item.offsetHeight) / 2
    })
    return () => clearTimeout(timer)
  }, [open, activeValue])

  const choose = (categoryId: string, subcategoryId?: string) => {
    onSelect(categoryId, subcategoryId)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={isFiltered ? `Categoría: ${label}. Cambiar categoría` : 'Filtrar por categoría'}
          className={cn(
            'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2 text-[11px] font-semibold shadow-2xs transition-colors sm:h-9 sm:w-auto sm:max-w-[220px] sm:rounded-xl sm:px-2.5 sm:text-xs',
            isFiltered
              ? 'border-primary/60 text-primary ring-1 ring-primary/20'
              : 'border-border/80 text-foreground hover:border-primary/50'
          )}
        >
          {createElement(activeParent ? getCategoryIcon(activeParent.category.name) : LayoutGrid, { className: cn('h-3.5 w-3.5 shrink-0', isFiltered ? 'text-primary' : 'text-muted-foreground') })}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false} label="Categorías" defaultValue={activeValue}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar categoría…" className="text-base sm:text-sm" />
          <CommandList ref={listRef} className="max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain p-1">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              Ninguna categoría se llama así.
            </CommandEmpty>

            {!term && (
              <CommandItem value="todas" onSelect={() => choose('')} className="gap-2 rounded-lg px-2 py-2 text-xs font-semibold">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Todas las categorías</span>
                {!isFiltered && <Check className="h-3.5 w-3.5 text-primary" />}
              </CommandItem>
            )}

            {visible.map(({ category, children }) => {
              const parentActive = activeCategory === category.id && !activeSubcategory
              return (
                <CommandGroup key={category.id} className="p-0">
                  <CommandItem
                    value={`cat-${category.id}`}
                    onSelect={() => choose(category.id)}
                    className={cn('gap-2 rounded-lg px-2 py-2 text-xs font-semibold', parentActive && 'bg-primary/10 text-primary')}
                  >
                    {createElement(getCategoryIcon(category.name), { className: cn('h-4 w-4 shrink-0', parentActive ? 'text-primary' : 'text-muted-foreground') })}
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">{category.product_count}</span>
                    <Check className={cn('h-3.5 w-3.5 text-primary', parentActive ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                  {children.map((child) => {
                    const childActive = activeCategory === category.id && activeSubcategory === child.id
                    return (
                      <CommandItem
                        key={child.id}
                        value={`sub-${child.id}`}
                        onSelect={() => choose(category.id, child.id)}
                        className={cn('ml-4 gap-2 rounded-lg px-2 py-1.5 text-xs', childActive && 'bg-primary/10 font-semibold text-primary')}
                      >
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="min-w-0 flex-1 truncate">{child.name}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{child.product_count}</span>
                        <Check className={cn('h-3.5 w-3.5 text-primary', childActive ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
