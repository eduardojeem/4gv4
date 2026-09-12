'use client'

import type { PublicProductVariant, PublicVariantAttributeConfig } from '@/types/public'

type Props = {
  variants: PublicProductVariant[]
  config?: PublicVariantAttributeConfig[]
  selected: Record<string, string>
  onChange: (key: string, value: string) => void
  title?: string
}

const NON_SELECTABLE_ATTRIBUTE_KEYS = new Set(['image_url', 'image', 'photo', 'imageurl'])

export function PublicVariantPicker({ variants, config, selected, onChange, title = 'Elegí una variante' }: Props) {
  const active = variants.filter((variant) => variant.is_active)
  const rawKeys = config?.length ? config.map((item) => item.key) : Array.from(new Set(active.flatMap((variant) => Object.keys(variant.attributes ?? {}))))
  const keys = rawKeys.filter((k) => !NON_SELECTABLE_ATTRIBUTE_KEYS.has(k.toLowerCase()))
  if (keys.length === 0) return null

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3">
      <div>
        <p className="text-xs font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Seleccioná las opciones disponibles para ver precio y stock exactos.</p>
      </div>
      {keys.map((key) => {
        const item = config?.find((entry) => entry.key === key)
        const options = item?.options?.length ? item.options : Array.from(new Set(active.map((variant) => variant.attributes[key]).filter(Boolean)))
        return (
          <div key={key} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">{item?.label ?? key}</p>
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => {
                const available = active.some((variant) => variant.attributes[key] === option && variant.stock_quantity > 0)
                const isSelected = selected[key] === option
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!available}
                    onClick={() => onChange(key, option)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'} ${!available ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
