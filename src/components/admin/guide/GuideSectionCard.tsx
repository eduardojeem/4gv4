'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Link2,
  Sparkles,
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
import { GuideVisualPreview } from './GuideVisualPreview'

function HighlightedText({ text, query }: { text: string; query?: string }): ReactNode {
  if (!query || !query.trim()) return <>{text}</>
  const needle = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const parts = text.split(new RegExp(`(${needle})`, 'gi'))
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={index} className="rounded bg-amber-200 px-0.5 font-semibold text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
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

  const isOperation = section.group === 'operations'
  const isAnalytics = section.group === 'analytics'
  const openState = isOpen !== undefined ? isOpen : localOpen
  const examples = examplesForVertical(section, vertical)

  useEffect(() => {
    if (isOpen !== undefined) {
      setLocalOpen(isOpen)
    }
  }, [isOpen])

  // Deep linking: abrir automáticamente si la URL coincide con #guia-{id}
  useEffect(() => {
    if (typeof window === 'undefined') return
    const targetHash = `#guia-${section.id}`
    if (window.location.hash === targetHash) {
      setLocalOpen(true)
      const el = document.getElementById(`guia-${section.id}`)
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 200)
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
        'overflow-hidden rounded-xl border transition-all duration-200',
        isRead
          ? 'border-emerald-500/40 bg-emerald-50/5 dark:bg-emerald-950/10'
          : openState
            ? isOperation
              ? 'border-blue-300 border-l-4 border-l-blue-600 bg-card shadow-md dark:border-blue-900 dark:border-l-blue-500'
              : isAnalytics
                ? 'border-emerald-300 border-l-4 border-l-emerald-600 bg-card shadow-md dark:border-emerald-900 dark:border-l-emerald-500'
                : 'border-purple-300 border-l-4 border-l-purple-600 bg-card shadow-md dark:border-purple-900 dark:border-l-purple-500'
            : isOperation
              ? 'border-border/80 border-l-4 border-l-blue-500/60 bg-card hover:border-border hover:border-l-blue-600 hover:shadow-xs'
              : isAnalytics
                ? 'border-border/80 border-l-4 border-l-emerald-500/60 bg-card hover:border-border hover:border-l-emerald-600 hover:shadow-xs'
                : 'border-border/80 border-l-4 border-l-purple-500/60 bg-card hover:border-border hover:border-l-purple-600 hover:shadow-xs',
      )}
      id={`guia-${section.id}`}
    >
      <details
        className="group"
        open={openState}
        onToggle={handleToggle}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30 sm:p-5">
          <div className="flex min-w-0 items-start gap-3.5">
            {/* Ícono coloreado según ámbito */}
            <span
              className={cn(
                'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors shadow-2xs',
                isRead
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : isOperation
                    ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-400'
                    : isAnalytics
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800/60 dark:bg-purple-950/60 dark:text-purple-400',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  <HighlightedText text={section.title} query={searchQuery} />
                </h3>

                {/* Badge de ámbito (Operaciones vs Administración) */}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    isOperation
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : isAnalytics
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
                  )}
                >
                  {isOperation ? 'Dashboard' : isAnalytics ? 'Análisis' : 'Admin'}
                </span>

                {section.module && (
                  <Badge variant="outline" className="border-border/80 bg-muted/40 text-[10px] uppercase tracking-wide">
                    Según el plan
                  </Badge>
                )}

                {isRead && (
                  <Badge variant="secondary" className="border-transparent bg-emerald-100 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Check className="mr-1 h-3 w-3" />
                    Leída
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                <HighlightedText text={section.summary} query={searchQuery} />
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            {onToggleRead && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 text-muted-foreground hover:text-emerald-600',
                        isRead && 'text-emerald-600 dark:text-emerald-400',
                      )}
                      onClick={handleReadClick}
                      aria-label={isRead ? 'Marcar como pendiente' : 'Marcar como leída'}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
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
                <TooltipContent side="top">
                  Copiar enlace directo
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
              <ChevronDown
                className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </span>
          </div>
        </summary>

        {/* Contenido Desplegado */}
        <div className="space-y-5 border-t border-border/80 bg-muted/15 p-4 sm:p-6">
          {/* Bloque 1: Paso a Paso */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                  isOperation
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                )}
              >
                1
              </span>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cómo funciona paso a paso
              </h4>
            </div>

            <ol className="relative ml-2.5 space-y-4 border-l border-border/80 pl-4 sm:ml-3 sm:pl-5">
              {section.steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 rounded-full border-2 border-background ring-2 sm:-left-[25px]',
                      isOperation ? 'bg-blue-600 ring-blue-200 dark:ring-blue-900' : 'bg-purple-600 ring-purple-200 dark:ring-purple-900',
                    )}
                  />
                  <p className="text-sm font-semibold text-foreground">
                    <HighlightedText text={step.title} query={searchQuery} />
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    <HighlightedText text={step.description} query={searchQuery} />
                  </p>
                </li>
              ))}
            </ol>

            {/* Visual preview o imagen a nivel sección */}
            {(section.uiPreview || section.image) && (
              <div className="pt-2">
                <GuideVisualPreview preview={section.uiPreview} image={section.image} title={section.title} vertical={vertical} />
              </div>
            )}
          </div>

          {/* Bloque 2: Caso Práctico Real */}
          {examples.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="h-4 w-4 text-primary" aria-hidden />
                <span>{examples.length === 1 ? 'Ejemplo práctico' : 'Ejemplos prácticos'}</span>
              </div>

              {examples.map((example) => (
                <div key={example.goal} className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <p className="text-sm font-semibold text-foreground">
                      «<HighlightedText text={example.goal} query={searchQuery} />»
                    </p>
                  </div>

                  <ol className="mt-3 space-y-2 pl-2">
                    {example.setup.map((item, index) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs text-muted-foreground sm:text-sm">
                        <span
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                            isOperation
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed">
                          <HighlightedText text={item} query={searchQuery} />
                        </span>
                      </li>
                    ))}
                  </ol>

                  {/* Visual preview o imagen del ejemplo */}
                  {(example.uiPreview || example.image) && (
                    <GuideVisualPreview preview={example.uiPreview} image={example.image} title={example.goal} vertical={vertical} />
                  )}

                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-2.5 text-xs text-emerald-900 sm:text-sm dark:bg-emerald-950/30 dark:text-emerald-200">
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <div className="leading-relaxed">
                      <strong className="font-semibold text-emerald-800 dark:text-emerald-300">Resultado: </strong>
                      <HighlightedText text={example.result} query={searchQuery} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bloque 3: Preguntas Frecuentes de la sección */}
          {section.faq && section.faq.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <HelpCircle className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
                <span>Preguntas Frecuentes</span>
              </div>

              <div className="space-y-2">
                {section.faq.map((entry) => (
                  <div key={entry.question} className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">
                      <HighlightedText text={entry.question} query={searchQuery} />
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      <HighlightedText text={entry.answer} query={searchQuery} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bloque 4: Tips / Buenas Prácticas */}
          {section.tips?.map((tip) => (
            <div
              key={tip}
              className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/80 p-3.5 text-xs text-amber-950 sm:text-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span className="leading-relaxed">
                <HighlightedText text={tip} query={searchQuery} />
              </span>
            </div>
          ))}

          {/* Bloque 5: Botón de Acción Directa coloreado según ámbito */}
          {section.href && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <Link
                href={section.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow active:scale-95 transition-all sm:text-sm',
                  isOperation
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : isAnalytics
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-purple-600 hover:bg-purple-700',
                )}
              >
                <span>Ir a {section.title}</span>
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>

              {onToggleRead && !isRead && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReadClick}
                  className="h-9 gap-1.5 rounded-xl border-2 border-emerald-300 font-bold text-xs shadow-2xs hover:border-emerald-400 hover:bg-emerald-50 active:scale-95 transition-all dark:border-emerald-800 dark:hover:bg-emerald-950/50"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
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
