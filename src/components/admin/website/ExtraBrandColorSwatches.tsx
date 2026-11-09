'use client'

import { Check } from 'lucide-react'
import { EXTRA_BRAND_COLORS, findExtraBrandColor } from '@/lib/website/brand-colors'
import { cn } from '@/lib/utils'

/**
 * Tonos adicionales de marca. Elegir uno guarda el color como personalizado
 * (`brandColor: 'custom'` con su HEX).
 */
export function ExtraBrandColorSwatches({
  brandColor,
  customBrandColor,
  onSelect,
  size = 'md',
  className,
}: {
  brandColor?: string
  customBrandColor?: string
  onSelect: (hex: string) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const selectedHex = brandColor === 'custom' ? findExtraBrandColor(customBrandColor)?.hex : undefined

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground">Más tonos</p>
      <div role="group" aria-label="Más tonos de marca" className={cn('flex flex-wrap', size === 'sm' ? 'gap-2' : 'gap-2.5')}>
        {EXTRA_BRAND_COLORS.map((color) => {
          const selected = selectedHex === color.hex
          return (
            <button
              key={color.hex}
              type="button"
              onClick={() => onSelect(color.hex)}
              aria-label={`Usar color ${color.name}`}
              aria-pressed={selected}
              title={color.name}
              className={cn(
                'flex items-center justify-center rounded-full transition-transform',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
                selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110'
              )}
              style={{ backgroundColor: color.hex }}
            >
              {selected && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
