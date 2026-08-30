'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDownAZ,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SortOptionKey = 'default' | 'price_asc' | 'price_desc' | 'discount_desc' | 'newest' | 'name'

const SORT_OPTIONS: { id: SortOptionKey; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'default', label: 'Relevancia y destacados', shortLabel: 'Relevancia', icon: Sparkles },
  { id: 'price_asc', label: 'Precio: menor a mayor', shortLabel: 'Menor precio', icon: ArrowDownNarrowWide },
  { id: 'price_desc', label: 'Precio: mayor a menor', shortLabel: 'Mayor precio', icon: ArrowUpNarrowWide },
  { id: 'discount_desc', label: 'Mayores descuentos (%)', shortLabel: 'Más descuento', icon: Flame },
  { id: 'newest', label: 'Más recientes añadidos', shortLabel: 'Más recientes', icon: Clock },
  { id: 'name', label: 'Nombre (A – Z)', shortLabel: 'Nombre A–Z', icon: ArrowDownAZ },
]

export function ProductSort() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentSort = (searchParams.get('sort') as SortOptionKey) || 'default'
  const activeOption = SORT_OPTIONS.find((o) => o.id === currentSort) ?? SORT_OPTIONS[0]
  const ActiveIcon = activeOption.icon

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'default') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    params.set('page', '1')
    setOpen(false)

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-semibold transition-all shadow-xs select-none',
          currentSort !== 'default' && currentSort !== 'name'
            ? 'border-primary/60 text-primary ring-1 ring-primary/20'
            : 'border-border/80 text-foreground hover:border-primary/40'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Criterio de ordenamiento"
      >
        <ActiveIcon
          className={cn(
            'h-3.5 w-3.5',
            currentSort !== 'default' && currentSort !== 'name' ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <span>{activeOption.shortLabel}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 opacity-60 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ordenar productos por:
          </div>
          {SORT_OPTIONS.map((option) => {
            const OptionIcon = option.icon
            const isSelected = (currentSort === 'default' && option.id === 'default') || currentSort === option.id

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSortChange(option.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <OptionIcon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
