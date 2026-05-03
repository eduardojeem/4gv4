'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const parent = categories.find(cat =>
      cat.subcategories?.some(sub => sub.id === selectedCategoryId)
    )
    if (parent && selectedCategoryId) {
      setExpandedCategories(prev => new Set(prev).add(parent.id))
    }
  }, [selectedCategoryId, categories])

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
    <AccordionItem value="category" className="border-b border-border/50 px-3">
      <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Categorias
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-1">
          {categories.map((category) => {
            const hasSubs = category.subcategories && category.subcategories.length > 0
            const isMainSelected = selectedCategoryId === category.id
            const hasSelectedSub = hasSubs && category.subcategories!.some(s => s.id === selectedCategoryId)
            const isExpanded = expandedCategories.has(category.id)

            return (
              <div key={category.id} className="space-y-1">
                <div className="flex items-center gap-1">
                  {hasSubs && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpansion(category.id) }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      aria-label={isExpanded ? 'Contraer subcategorías' : 'Expandir subcategorías'}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  )}
                  <button
                    className={`flex-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all text-left group ${
                      isMainSelected
                        ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                        : hasSelectedSub
                        ? 'bg-primary/5 text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    } ${!hasSubs ? 'ml-6' : ''}`}
                    onClick={() => onSelect(category.id === selectedCategoryId ? null : category.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isMainSelected ? 'bg-primary-foreground'
                          : hasSelectedSub ? 'bg-primary'
                          : 'bg-muted-foreground/40 group-hover:bg-muted-foreground'
                      }`} />
                      {category.name}
                    </span>
                    {hasSubs && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                        isMainSelected ? 'bg-primary-foreground/20 text-primary-foreground'
                          : hasSelectedSub ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'
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
