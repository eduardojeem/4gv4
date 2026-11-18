import type { ComponentType, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TONE_MAP = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/25',
} as const

export type SectionCardTone = keyof typeof TONE_MAP

/**
 * Consistent section card for the website admin editors — an icon tile + title,
 * supporting distinct section tones for intuitive recognition.
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
  /** Tono de acento colorido para el contenedor del ícono */
  tone?: SectionCardTone
  /** Badge o etiqueta adicional junto al título */
  badge?: string
}) {
  const toneClasses = tone ? TONE_MAP[tone] : 'bg-background text-primary border-border/80'

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
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
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
      <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform hover:scale-105', toneClasses)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">{title}</CardTitle>
              {badge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
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
