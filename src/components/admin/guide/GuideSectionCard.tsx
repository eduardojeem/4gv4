'use client'

import Link from 'next/link'
import { ArrowRight, ChevronDown, HelpCircle, Lightbulb, Target, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { examplesForVertical, type GuideSection } from '@/lib/guide/types'
import type { BusinessVertical } from '@/lib/organization/business-profile'

/**
 * Una sección de la guía: qué hace, cómo se usa y un ejemplo concreto.
 *
 * Se abre con `<details>` a propósito: el contenido es texto, así queda
 * buscable por el navegador y se lee igual sin que cargue nada.
 */
export function GuideSectionCard({
  section,
  icon: Icon,
  vertical,
  defaultOpen = false,
}: {
  section: GuideSection
  icon: LucideIcon
  vertical?: BusinessVertical | null
  defaultOpen?: boolean
}) {
  const examples = examplesForVertical(section, vertical)

  return (
    <Card className="overflow-hidden p-0" id={`guia-${section.id}`}>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition-colors hover:bg-accent/50 sm:p-5">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
              {section.module && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Según el plan
                </Badge>
              )}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{section.summary}</span>
          </span>
          <ChevronDown
            className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="space-y-5 border-t border-border bg-muted/20 p-4 sm:p-5">
          <ol className="space-y-3">
            {section.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          {examples.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Target className="h-3.5 w-3.5" aria-hidden />
                {examples.length === 1 ? 'Ejemplo' : 'Ejemplos'}
              </p>
              {examples.map((example) => (
                <div key={example.goal} className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-sm font-medium text-foreground">«{example.goal}»</p>
                  <ol className="mt-2 space-y-1.5">
                    {example.setup.map((item, index) => (
                      <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="font-semibold tabular-nums text-primary/70">{index + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2.5 flex gap-2 border-t border-border pt-2.5 text-sm text-foreground">
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span>{example.result}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {section.faq && section.faq.length > 0 && (
            <div className="space-y-2.5">
              {section.faq.map((entry) => (
                <div key={entry.question} className="flex gap-2.5">
                  <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.question}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section.tips?.map((tip) => (
            <p
              key={tip}
              className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{tip}</span>
            </p>
          ))}

          {section.href && (
            <Link
              href={section.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium',
                'text-foreground transition-colors hover:border-primary/40 hover:text-primary',
              )}
            >
              Ir a {section.title}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </details>
    </Card>
  )
}
