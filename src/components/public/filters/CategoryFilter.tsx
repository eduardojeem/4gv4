'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface Category {
  id: string
  name: string
  parent_id?: string | null
  subcategories?: Category[]
}

interface CategoryFilterProps {
  categories: Category[]
  selectedCategoryId: string
  onSelect: (categoryId: string | null) => void
}

export function CategoryFilter({ categories, selectedCategoryId, onSelect }: CategoryFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const parent = categories.find(cat =>
      cat.subcategories?.some(sub => sub.id === selectedCategoryId)
    )
    return parent ? new Set([parent.id]) : new Set()
  })

  // Auto-expandir el padre cuando la selección cambia a una subcategoría.
  // Ajuste de estado durante render (patrón recomendado por React) en vez de
  // un efecto, para evitar el doble render.
  const [lastSelectedId, setLastSelectedId] = useState(selectedCategoryId)
  if (lastSelectedId !== selectedCategoryId) {
    setLastSelectedId(selectedCategoryId)
    const parent = categories.find(cat =>
      cat.subcategories?.some(sub => sub.id === selectedCategoryId)
    )
    if (parent && selectedCategoryId && !expandedCategories.has(parent.id)) {
      setExpandedCategories(prev => new Set(prev).add(parent.id))
    }
  }

  const toggleExpansion = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (categories.length === 0) return null

  return (
    <AccordionItem value="category" className="border-b border-border/50 px-2.5">
      <AccordionTrigger className="hover:no-underline py-2.5 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground font-semibold">Categorías</span>
          <span className="text-[10px] text-muted-foreground font-normal">({categories.length})</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-2.5">
        <div className="space-y-0.5">
          {categories.map((category) => {
            const hasSubs = category.subcategories && category.subcategories.length > 0
            const isMainSelected = selectedCategoryId === category.id
            const hasSelectedSub = hasSubs && category.subcategories!.some(s => s.id === selectedCategoryId)
            const isExpanded = expandedCategories.has(category.id)

            return (
              <div key={category.id} className="space-y-0.5">
                <div className="flex items-center gap-0.5">
                  {hasSubs && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpansion(category.id) }}
                      className="p-0.5 hover:bg-muted rounded transition-colors"
                      aria-label={isExpanded ? 'Contraer subcategorías' : 'Expandir subcategorías'}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                  <button
                    className={`flex-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-all text-left group ${
                      isMainSelected
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : hasSelectedSub
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    } ${!hasSubs ? 'ml-4' : ''}`}
                    onClick={() => onSelect(category.id === selectedCategoryId ? null : category.id)}
                  >
                    <span className="truncate">{category.name}</span>
                    {hasSubs && (
                      <span className={`text-[10px] px-1 py-0.2 rounded-full transition-colors ml-1 ${
                        isMainSelected ? 'bg-primary-foreground/20 text-primary-foreground'
                          : hasSelectedSub ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {category.subcategories!.length}
                      </span>
                    )}
                  </button>
                </div>

                {hasSubs && isExpanded && (
                  <div className="ml-9 pl-3 space-y-0.5 border-l-2 border-border/40 animate-in slide-in-from-top-2 duration-200">
                    {category.subcategories!.map((sub) => {
                      const isSelected = selectedCategoryId === sub.id
                      return (
                        <button
                          key={sub.id}
                          className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-all text-left group ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:translate-x-0.5'
                          }`}
                          onClick={() => onSelect(sub.id === selectedCategoryId ? null : sub.id)}
                        >
                          <span className={`w-1 h-1 rounded-full transition-all ${
                            isSelected ? 'bg-primary scale-125' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
                          }`} />
                          {sub.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
