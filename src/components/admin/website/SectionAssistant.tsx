'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Lightbulb, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'
import {
  ASSISTANT_WRITES,
  reviewWebsiteSection,
  type CoachContext,
  type CoachItem,
  type CoachSection,
} from '@/lib/website/section-coach'

const ORDER = { warn: 0, tip: 1, ok: 2 } as const

const LEVEL = {
  ok: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  warn: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  tip: { icon: Lightbulb, className: 'text-sky-600 dark:text-sky-400' },
} as const

/**
 * El asistente de cada sección: revisa lo guardado y dice qué falta o qué no
 * conviene, con un botón para resolverlo. Se abre solo si hay algo que corregir.
 */
export function SectionAssistant({
  section,
  settings,
  context,
  onNavigate,
  onOpenAssistant,
}: {
  section: CoachSection
  settings: WebsiteSettings | null | undefined
  context: CoachContext
  onNavigate: (section: CoachSection) => void
  onOpenAssistant: () => void
}) {
  // Primero lo que hay que corregir, después las sugerencias y lo que está bien.
  const items: CoachItem[] = settings
    ? [...reviewWebsiteSection(section, settings, context)].sort((x, y) => ORDER[x.level] - ORDER[y.level])
    : []
  const warnings = items.filter((item) => item.level === 'warn').length
  const tips = items.filter((item) => item.level === 'tip').length
  const [open, setOpen] = useState<boolean | null>(null)
  if (items.length === 0) return null
  const expanded = open ?? warnings > 0

  const summary = warnings > 0
    ? `${warnings} ${warnings === 1 ? 'cosa para corregir' : 'cosas para corregir'}`
    : tips > 0
      ? `${tips} ${tips === 1 ? 'sugerencia' : 'sugerencias'}`
      : 'Todo en orden'

  return (
    <section
      aria-label="Asistente de esta sección"
      className={cn(
        'mb-4 rounded-xl border',
        warnings > 0 ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-primary/20 bg-primary/[0.03]'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Asistente de esta sección</span>
          <span className={cn('block text-xs', warnings > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
            {summary} · según lo guardado
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/60 px-4 py-3">
          <ul className="space-y-2">
            {items.map((item) => {
              const { icon: Icon, className } = LEVEL[item.level]
              return (
                <li key={item.text} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                  <span className="flex items-start gap-2 text-sm text-foreground">
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden="true" />
                    {item.text}
                  </span>
                  {item.action && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 gap-1 self-start px-2 text-xs"
                      onClick={() => item.action?.kind === 'navigate' ? onNavigate(item.action.section) : onOpenAssistant()}
                    >
                      {item.action.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {ASSISTANT_WRITES.has(section) && !items.some((item) => item.action?.kind === 'assistant') && (
            <Button type="button" size="sm" variant="outline" className="mt-1 gap-1.5 text-xs" onClick={onOpenAssistant}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Proponer textos con el asistente
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
