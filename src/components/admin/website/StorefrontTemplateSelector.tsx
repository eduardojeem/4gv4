'use client'

import { Check, Sparkles } from 'lucide-react'
import { StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import {
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'
import { cn } from '@/lib/utils'

interface StorefrontTemplateSelectorProps {
  value: StorefrontStylePreference
  onChange: (value: StorefrontStylePreference) => void
  businessVertical?: string | null
  /** Plantilla que sugiere el asistente, para marcarla en la grilla. */
  suggestedStyle?: StorefrontStylePreference
  /** Sin la agenda (módulo Servicios) no se ofrece la plantilla «Servicios». */
  servicesAvailable?: boolean
}

/**
 * Grilla de plantillas. Las miniaturas toman el color de marca del contenedor
 * (ver BrandColorScope), así el dueño ve cada plantilla con su color.
 */
export function StorefrontTemplateSelector({ value, onChange, businessVertical, suggestedStyle, servicesAvailable }: StorefrontTemplateSelectorProps) {
  return (
    <div role="group" aria-labelledby="storefrontStyleLabel" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {STOREFRONT_STYLE_OPTIONS.filter((option) => isStorefrontStyleAvailable(option.value, { servicesAvailable })).map((option) => {
        const style = resolveStorefrontStyle(option.value, businessVertical, { servicesAvailable })
        const selected = value === option.value
        const isAuto = option.value === 'auto'
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/25 hover:shadow-sm'
            )}
          >
            <StorefrontTemplateThumbnail style={style} className="h-28 border-b bg-muted/30" />
            <span className="flex flex-1 flex-col gap-0.5 p-2.5">
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold">{isAuto ? 'Automático' : option.label}</span>
                {selected && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check aria-hidden="true" className="h-2.5 w-2.5" />
                  </span>
                )}
              </span>{' '}
              <span className="text-xs leading-snug text-muted-foreground">
                {isAuto ? `Según tu rubro: ${STOREFRONT_STYLE_LABELS[style]}` : STOREFRONT_TEMPLATES_METADATA[style].badge}
              </span>
            </span>
            {option.value === suggestedStyle && (
              <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm">
                <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                Sugerida
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
