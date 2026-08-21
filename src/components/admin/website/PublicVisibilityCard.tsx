'use client'

import { Eye, EyeOff, Sparkles, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PublicVisibilityCardProps {
  title: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
  badgeLabel?: string
  className?: string
  compact?: boolean
}

export function PublicVisibilityCard({
  title,
  description,
  enabled,
  onToggle,
  disabled = false,
  badgeLabel,
  className,
  compact = false,
}: PublicVisibilityCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 transition-all duration-200 overflow-hidden shadow-2xs',
        enabled
          ? 'border-emerald-400/90 bg-emerald-50/50 dark:border-emerald-800/90 dark:bg-emerald-950/20 ring-1 ring-emerald-400/20'
          : 'border-border/80 bg-muted/15 opacity-80',
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors shadow-xs',
              enabled
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {enabled ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
                {title}
              </span>
              {badgeLabel && (
                <Badge variant="outline" className="text-[10px] font-bold">
                  {badgeLabel}
                </Badge>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                  enabled
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground border border-border'
                )}
              >
                <Globe className="h-3 w-3" />
                {enabled ? 'Público / Visible' : 'Oculto en la Web'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
          <span className={cn(
            'text-xs font-bold sm:hidden',
            enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
          )}>
            {enabled ? 'Visible en tu web' : 'Sección desactivada'}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={disabled}
            aria-label={`Alternar visualización de ${title}`}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </div>
    </div>
  )
}
