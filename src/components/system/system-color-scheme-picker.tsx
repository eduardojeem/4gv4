'use client'

import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  SYSTEM_COLOR_SCHEME_OPTIONS,
  type SystemColorScheme,
} from '@/lib/theme/color-schemes'

interface SystemColorSchemePickerProps {
  value?: string
  onChange: (scheme: SystemColorScheme) => void
  disabled?: boolean
  className?: string
}

export function SystemColorSchemePicker({
  value,
  onChange,
  disabled = false,
  className,
}: SystemColorSchemePickerProps) {
  const selectedValue = value ?? DEFAULT_SYSTEM_COLOR_SCHEME

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_COLOR_SCHEME_OPTIONS.map((scheme) => {
          const isActive = selectedValue === scheme.value

          return (
            <button
              key={scheme.value}
              type="button"
              onClick={() => onChange(scheme.value)}
              disabled={disabled}
              aria-pressed={isActive}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-all',
                'hover:border-primary/50 hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                isActive && 'border-primary shadow-sm ring-2 ring-primary/15',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{scheme.label}</span>
                    {scheme.badge ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {scheme.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {scheme.description}
                  </p>
                </div>

                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {scheme.swatches.map((swatch) => (
                  <span
                    key={`${scheme.value}-${swatch}`}
                    className="h-8 rounded-md border border-black/5 shadow-sm"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        El esquema elegido impacta botones principales, estados destacados, enlaces y acentos del panel.
      </p>
    </div>
  )
}
