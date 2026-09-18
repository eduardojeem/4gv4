'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  HelpCircle,
  Lightbulb,
  Link2,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { examplesForVertical, type GuideSection } from '@/lib/guide/types'
import type { BusinessVertical } from '@/lib/organization/business-profile'

function HighlightedText({ text, query }: { text: string; query?: string }): ReactNode {
  if (!query || !query.trim()) return <>{text}</>
  const needle = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const parts = text.split(new RegExp(`(${needle})`, 'gi'))
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={index} className="rounded bg-primary/20 px-0.5 font-semibold text-foreground">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    )
  } catch {
    return <>{text}</>
  }
}

export function GuideSectionCard({
  section,
  icon: Icon,
  vertical,
  defaultOpen = false,
  isOpen,
  onToggle,
  searchQuery,
  isRead = false,
  onToggleRead,
}: {
  section: GuideSection
  icon: LucideIcon
  vertical?: BusinessVertical | null
  defaultOpen?: boolean
  isOpen?: boolean
  onToggle?: () => void
  searchQuery?: string
  isRead?: boolean
  onToggleRead?: (id: string) => void
}) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  const openState = isOpen !== undefined ? isOpen : localOpen
  const examples = examplesForVertical(section, vertical)

  useEffect(() => {
    if (isOpen !== undefined) {
      setLocalOpen(isOpen)
    }
  }, [isOpen])

  // Detección de hash para deep linking: si entran con #guia-{id}, se abre y scrollea
  useEffect(() => {
    if (typeof window === 'undefined') return
    const targetHash = `#guia-${section.id}`
    if (window.location.hash === targetHash) {
      setLocalOpen(true)
      const el = document.getElementById(`guia-${section.id}`)
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      }
    }
  }, [section.id])

  const handleToggle = (e: React.SyntheticEvent) => {
    const target = e.currentTarget as HTMLDetailsElement
    const newState = target.open
    setLocalOpen(newState)
    if (onToggle && newState !== openState) {
      onToggle()
    }
  }

  const copyAnchor = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === 'undefined') return

    const url = `${window.location.origin}${window.location.pathname}#guia-${section.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Enlace directo copiado', {
        description: `Enlace copiado para compartir «${section.title}».`,
      })
    }).catch(() => {
      toast.error('No se pudo copiar el enlace')
    })
  }

  const handleReadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onToggleRead) {
      onToggleRead(section.id)
      if (!isRead) {
        toast.success(`Marcaste «${section.title}» como leída.`)
      }
    }
  }

  return (
    <Card
      className={cn(
        'overflow-hidden p-0 transition-all duration-200',
        isRead && 'border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10',
        openState && 'ring-1 ring-primary/20 shadow-sm',
      )}
      id={`guia-${section.id}`}
    >
      <details
        className="group"
        open={openState}
        onToggle={handleToggle}
      >
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition-colors hover:bg-accent/40 sm:p-5">
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
              isRead ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                <HighlightedText text={section.title} query={searchQuery} />
              </h3>
              {section.module && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Según el plan
                </Badge>
              )}
              {isRead && (
                <Badge variant="secondary" className="border-transparent bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Check className="mr-1 h-3 w-3" />
                  Leída
                </Badge>
              )}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              <HighlightedText text={section.summary} query={searchQuery} />
            </span>
          </span>

          <div className="flex items-center gap-1">
            {onToggleRead && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 text-muted-foreground transition-colors hover:text-emerald-600',
                        isRead && 'text-emerald-600 dark:text-emerald-400',
                      )}
                      onClick={handleReadClick}
                      aria-label={isRead ? 'Marcar como pendiente' : 'Marcar como leída'}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRead ? 'Marcar como pendiente' : 'Marcar como leída'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={copyAnchor}
                    aria-label="Copiar enlace a esta sección"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Copiar enlace directo
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <ChevronDown
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </div>
        </summary>

        <div className="space-y-5 border-t border-border bg-muted/20 p-4 sm:p-5">
          <ol className="space-y-3">
            {section.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <HighlightedText text={step.title} query={searchQuery} />
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    <HighlightedText text={step.description} query={searchQuery} />
                  </p>
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
                  <p className="text-sm font-medium text-foreground">
                    «<HighlightedText text={example.goal} query={searchQuery} />»
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {example.setup.map((item, index) => (
                      <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="font-semibold tabular-nums text-primary/70">{index + 1}.</span>
                        <span>
                          <HighlightedText text={item} query={searchQuery} />
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2.5 flex gap-2 border-t border-border pt-2.5 text-sm text-foreground">
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span>
                      <HighlightedText text={example.result} query={searchQuery} />
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {section.faq && section.faq.length > 0 && (
            <div className="space-y-2.5">
              {section.faq.map((entry) => (
                <div key={entry.question} className="flex gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3">
                  <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <HighlightedText text={entry.question} query={searchQuery} />
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      <HighlightedText text={entry.answer} query={searchQuery} />
                    </p>
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
              <span>
                <HighlightedText text={tip} query={searchQuery} />
              </span>
            </p>
          ))}

          {section.href && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={section.href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium',
                  'text-foreground transition-colors hover:border-primary/40 hover:text-primary shadow-sm',
                )}
              >
                Ir a {section.title}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>

              {onToggleRead && !isRead && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReadClick}
                  className="text-xs"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Marcar como leída
                </Button>
              )}
            </div>
          )}
        </div>
      </details>
    </Card>
  )
}
