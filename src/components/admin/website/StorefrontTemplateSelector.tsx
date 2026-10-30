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
    <div role="group" aria-labelledby="storefrontStyleLabel" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {STOREFRONT_STYLE_OPTIONS.filter((option) => isStorefrontStyleAvailable(option.value, context)).map((option) => {
        const style = resolveStorefrontStyle(option.value, businessVertical, context)
        const selected = value === option.value
        const isAuto = option.value === 'auto'

        let statusBadgeText = ''
        let statusBadgeClass = ''
        let helperText = ''

        if (option.value === 'auto') {
          statusBadgeText = selected ? 'ACTUAL' : 'RECOMENDADA'
          statusBadgeClass = selected
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          helperText = `Según tu rubro: ${STOREFRONT_STYLE_LABELS[style]}`
        } else {
          const comp = getTemplateCompatibility({
            storefrontStyle: option.value,
            currentStyle: value,
            businessVertical,
            servicesAvailable,
            catalogAvailable,
          })
          if (selected) {
            statusBadgeText = 'ACTUAL'
            statusBadgeClass = 'bg-primary/10 text-primary border-primary/20'
            helperText = comp.isRecommended ? '✓ Recomendada para tu rubro' : STOREFRONT_TEMPLATES_METADATA[style].badge
          } else if (comp.status === 'requires_modules') {
            statusBadgeText = 'REQUIERE MÓDULOS'
            statusBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            helperText = '⚠ Requiere Servicios y Agenda'
          } else if (comp.isRecommended) {
            statusBadgeText = 'RECOMENDADA'
            statusBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            helperText = '✓ Recomendada para tu rubro'
          } else {
            statusBadgeText = 'COMPATIBLE'
            statusBadgeClass = 'bg-muted text-muted-foreground border-border'
            helperText = 'Compatible'
          }
        }

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={isAuto ? `Automático Según tu rubro: ${STOREFRONT_STYLE_LABELS[style]}` : option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/25 hover:shadow-sm'
            )}
          >
            <div className="relative">
              <StorefrontTemplateThumbnail style={style} className="h-28 border-b bg-muted/30" />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-1.5 left-1.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs',
                  statusBadgeClass
                )}
              >
                {statusBadgeText}
              </span>
            </div>
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
                {helperText}
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
