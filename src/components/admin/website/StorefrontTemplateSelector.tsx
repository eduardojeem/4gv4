'use client'

import { Check, Sparkles } from 'lucide-react'
import { StorefrontTemplateThumbnail } from '@/components/admin/website/StorefrontTemplateThumbnail'
import {
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  getTemplateCompatibility,
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
  /** Vende productos: sin productos, un negocio de servicios no ve plantillas de tienda. */
  catalogAvailable?: boolean
}

/**
 * Grilla de plantillas. Las miniaturas toman el color de marca del contenedor
 * (ver BrandColorScope), así el dueño ve cada plantilla con su color.
 */
export function StorefrontTemplateSelector({ value, onChange, businessVertical, suggestedStyle, servicesAvailable, catalogAvailable }: StorefrontTemplateSelectorProps) {
  const context = { servicesAvailable, catalogAvailable, businessVertical }
  return (
    <div role="group" aria-labelledby="storefrontStyleLabel" className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {STOREFRONT_STYLE_OPTIONS.filter((option) => isStorefrontStyleAvailable(option.value, context)).map((option) => {
        const style = resolveStorefrontStyle(option.value, businessVertical, context)
        const selected = value === option.value
        const isAuto = option.value === 'auto'
        const metadata = STOREFRONT_TEMPLATES_METADATA[style]
        const compatibility = getTemplateCompatibility({
          storefrontStyle: style,
          currentStyle: value,
          businessVertical,
          servicesAvailable,
          catalogAvailable,
        })
        const statusBadgeText = selected
          ? 'ACTUAL'
          : isAuto || compatibility.isRecommended
            ? 'RECOMENDADA'
            : compatibility.status === 'requires_modules'
              ? 'REQUIERE MÓDULOS'
              : 'COMPATIBLE'
        const statusBadgeClass = statusBadgeText === 'ACTUAL'
          ? 'bg-primary/10 text-primary border-primary/20'
          : statusBadgeText === 'RECOMENDADA'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            : statusBadgeText === 'REQUIERE MÓDULOS'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
              : 'bg-muted text-muted-foreground border-border'

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${isAuto ? `Automático Según tu rubro: ${STOREFRONT_STYLE_LABELS[style]}` : option.label}: ${statusBadgeText.toLowerCase()}`}
            aria-describedby={`storefront-template-details-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cn(
              'group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-[border-color,box-shadow] duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:shadow-md'
            )}
          >
            <span className="relative block overflow-hidden border-b bg-muted/20 p-2">
              <StorefrontTemplateThumbnail style={style} className="h-24 overflow-hidden rounded-lg border bg-background shadow-sm transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transform-none" />
            </span>
            <span className="flex flex-1 flex-col gap-2 p-3">
              <span className="flex min-h-5 flex-wrap items-center gap-1.5">
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none tracking-wide', statusBadgeClass)}>
                  {statusBadgeText}
                </span>
                {option.value === suggestedStyle && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Sparkles aria-hidden="true" className="h-3 w-3" />
                    Sugerida
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold leading-snug">{isAuto ? 'Automático' : option.label}</span>
                {selected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check aria-hidden="true" className="h-3 w-3" />
                  </span>
                )}
              </span>{' '}
              <span id={`storefront-template-details-${option.value}`} className="flex flex-1 flex-col gap-2">
                <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {isAuto ? `${metadata.description} Se adapta a tu rubro: ${STOREFRONT_STYLE_LABELS[style]}.` : metadata.description}
                </span>
                <span className="line-clamp-1 text-[11px] leading-snug text-muted-foreground"><span className="font-semibold">Recomendada para:</span> {metadata.recommendedVerticals.join(', ')}</span>
              </span>
              <span className="mt-1 flex min-h-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/10">{selected ? 'Seleccionada' : 'Seleccionar plantilla'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
