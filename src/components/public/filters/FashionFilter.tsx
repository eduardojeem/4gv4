'use client'

import { Palette, Ruler, Users } from 'lucide-react'

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { FASHION_AUDIENCES } from '@/lib/products/fashion-filters'
import { cn } from '@/lib/utils'

function OptionButtons({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : option.value)}
            className={cn(
              'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              selected
                ? 'border-stone-950 bg-stone-950 text-white dark:border-white dark:bg-white dark:text-stone-950'
                : 'border-stone-300 bg-background text-foreground hover:border-stone-600 dark:border-stone-700',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function FashionFilter({
  audience,
  size,
  color,
  sizes,
  colors,
  onChange,
}: {
  audience: string
  size: string
  color: string
  sizes: string[]
  colors: string[]
  onChange: (updates: Record<string, string | null>) => void
}) {
  return (
    <AccordionItem value="fashion" className="border-b border-border/50 px-2.5">
      <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span>Prenda y variante</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-3">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Público</p>
          <OptionButtons
            label="Filtrar por público"
            options={FASHION_AUDIENCES.map((option) => ({ ...option }))}
            value={audience}
            onChange={(value) => onChange({ audience: value || null })}
          />
        </div>

        {sizes.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Ruler className="h-3 w-3" /> Talle
            </p>
            <OptionButtons
              label="Filtrar por talle"
              options={sizes.map((option) => ({ value: option, label: option }))}
              value={size}
              onChange={(value) => onChange({ size: value || null })}
            />
          </div>
        )}

        {colors.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3 w-3" /> Color
            </p>
            <OptionButtons
              label="Filtrar por color"
              options={colors.map((option) => ({ value: option, label: option }))}
              value={color}
              onChange={(value) => onChange({ color: value || null })}
            />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
