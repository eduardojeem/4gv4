import type { ComponentType, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TONE_MAP = {
  neutral: 'bg-muted/80 text-foreground border-border/80',
  blue: 'bg-muted text-foreground border-border/80',
  purple: 'bg-muted text-foreground border-border/80',
  violet: 'bg-muted text-foreground border-border/80',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  rose: 'bg-muted text-foreground border-border/80',
  teal: 'bg-muted text-foreground border-border/80',
  indigo: 'bg-muted text-foreground border-border/80',
  sky: 'bg-muted text-foreground border-border/80',
  orange: 'bg-muted text-foreground border-border/80',
  fuchsia: 'bg-muted text-foreground border-border/80',
} as const

export type SectionCardTone = keyof typeof TONE_MAP

/**
 * Consistent section card for the website admin editors — an icon tile + title,
 * supporting distinct neutral styling for cohesive, professional aesthetic.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  collapsible = false,
  id,
  tone,
  badge,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  children: ReactNode
  collapsible?: boolean
  /** Ancla para que la guía del sitio pueda llevar directo a esta tarjeta. */
  id?: string
  /** Tono de acento sutil para el contenedor del ícono */
  tone?: SectionCardTone
  /** Badge o etiqueta adicional junto al título */
  badge?: string
}) {
  const toneClasses = tone ? TONE_MAP[tone] : 'bg-muted text-foreground border-border/80'

  if (collapsible) {
    return (
      <Card id={id} className="scroll-mt-4 gap-0 py-0 rounded-2xl overflow-hidden border-border/80 shadow-2xs">
        <details className="group">
          <summary className="cursor-pointer rounded-2xl p-3.5 sm:p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring hover:bg-muted/30 transition-colors">
            <span className="ml-1 sm:ml-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg border shadow-2xs', toneClasses)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span>{title}</span>
              {badge && (
                <span className="rounded-full bg-muted border border-border/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {badge}
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground leading-relaxed pl-1 sm:pl-2">
              {description}
            </span>
          </summary>
          <CardContent className="border-t p-3.5 sm:p-5 pt-4">{children}</CardContent>
        </details>
      </Card>
    )
  }

  return (
    <Card id={id} className="scroll-mt-4 rounded-2xl border-border/80 shadow-2xs overflow-hidden">
      <CardHeader className="border-b bg-muted/20 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform hover:scale-105', toneClasses)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">{title}</CardTitle>
              {badge && (
                <span className="rounded-full bg-muted border border-border/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {badge}
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 sm:pt-6">{children}</CardContent>
    </Card>
  )
}
