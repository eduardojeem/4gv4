'use client'

import { useMemo, useState } from 'react'
import { Check, Search, Tag, X, Sparkles } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

interface BrandFilterProps {
  brands: string[]
  selectedBrand: string
  onSelect: (brand: string | null) => void
}

// Generador de colores pastel para las iniciales de las marcas
function getBrandColor(name: string) {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function BrandFilter({ brands, selectedBrand, onSelect }: BrandFilterProps) {
  const [search, setSearch] = useState('')

  const sortedBrands = useMemo(() => {
    return [...brands].sort((a, b) => a.localeCompare(b, 'es'))
  }, [brands])

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedBrands
    return sortedBrands.filter((b) => b.toLowerCase().includes(q))
  }, [sortedBrands, search])

  // Top 4 marcas para acceso instantáneo
  const topBrands = useMemo(() => sortedBrands.slice(0, 4), [sortedBrands])

  if (brands.length === 0) return null

  return (
    <AccordionItem value="brand" className="border-b border-border/50 px-3">
      <AccordionTrigger className="hover:no-underline py-3.5 text-sm font-medium">
        <span className="flex items-center justify-between w-full pr-2">
          <span className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Marcas</span>
            <span className="text-[11px] text-muted-foreground">({brands.length})</span>
          </span>

          {selectedBrand && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
              1 activa
            </span>
          )}
        </span>
      </AccordionTrigger>

      <AccordionContent className="pb-3.5 space-y-2.5">
        
        {/* Acceso Rápido a Top Marcas */}
        {topBrands.length > 2 && !search && (
          <div className="flex flex-wrap gap-1 pb-1">
            {topBrands.map((b) => {
              const isSelected = selectedBrand.toLowerCase() === b.toLowerCase()
              return (
                <button
                  key={`top-${b}`}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : b)}
                  className={cn(
                    'rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-all shadow-2xs',
                    isSelected
                      ? 'border-violet-500 bg-violet-600 text-white'
                      : 'border-border/80 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {b}
                </button>
              )
            })}
          </div>
        )}

        {/* Buscador interno con diseño limpio */}
        {brands.length > 5 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca..."
              className="h-8 w-full rounded-xl border border-border/80 bg-background pl-8 pr-7 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Indicador de marca activa con botón de quitar */}
        {selectedBrand && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex w-full items-center justify-between rounded-xl border border-violet-300 bg-violet-50/80 px-2.5 py-1.5 text-xs font-bold text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <span className="truncate">Marca: {selectedBrand}</span>
            <X className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}

        {/* Lista Scrollable con Monogramas Coloridos */}
        <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {filteredBrands.map((brandName) => {
            const isSelected = selectedBrand.toLowerCase() === brandName.toLowerCase()
            const initial = brandName.charAt(0).toUpperCase()
            const colorClass = getBrandColor(brandName)

            return (
              <button
                key={brandName}
                type="button"
                onClick={() => onSelect(isSelected ? null : brandName)}
                className={cn(
                  'w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all text-left group',
                  isSelected
                    ? 'border border-violet-500 bg-violet-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold uppercase transition-colors',
                      isSelected
                        ? 'bg-white/20 text-white'
                        : colorClass
                    )}
                  >
                    {initial}
                  </span>
                  <span className="truncate">{brandName}</span>
                </div>

                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white" />}
              </button>
            )
          })}

          {filteredBrands.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No se encontró &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
