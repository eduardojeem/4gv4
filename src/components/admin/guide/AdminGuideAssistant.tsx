'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  ScanBarcode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Sunset,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ASSISTANT_PRESETS,
  resolveAssistantQuery,
  type AssistantAnswer,
  type AssistantPresetTopic,
} from '@/lib/guide/guide-assistant'
import type { GuideSection } from '@/lib/guide/types'
import { cn } from '@/lib/utils'

interface AdminGuideAssistantProps {
  availableSections: GuideSection[]
  onSelectSection?: (sectionId: string) => void
}

const CATEGORY_TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'todos', label: 'General', icon: Sparkles },
  { id: 'inicio', label: 'Apertura', icon: Sunrise },
  { id: 'ventas', label: 'Ventas y Clientes', icon: FileText },
  { id: 'taller', label: 'Taller y Servicios', icon: Wrench },
  { id: 'stock', label: 'Stock e Inventario', icon: ScanBarcode },
  { id: 'cierre', label: 'Cierre y Auditoría', icon: Sunset },
  { id: 'equipo', label: 'Equipo y Roles', icon: Users },
]

const ICON_MAP: Record<string, LucideIcon> = {
  Sunrise,
  Sunset,
  FileText,
  Wrench,
  ScanBarcode,
  Users,
  ShieldCheck,
  CalendarClock,
  RotateCcw,
  CalendarX2,
  ClipboardCheck,
}

export function AdminGuideAssistant({
  availableSections,
  onSelectSection,
}: AdminGuideAssistantProps) {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)

  // Preset seleccionado directamente o resolución dinámica por query
  const resolvedAnswer: AssistantAnswer | null = useMemo(() => {
    if (selectedPresetId) {
      const preset = ASSISTANT_PRESETS.find((p) => p.id === selectedPresetId)
      if (preset) return preset.answer
    }
    if (query.trim().length >= 2) {
      return resolveAssistantQuery(query, availableSections)
    }
    return null
  }, [query, selectedPresetId, availableSections])

  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'todos') return ASSISTANT_PRESETS
    return ASSISTANT_PRESETS.filter((p) => p.category === selectedCategory)
  }, [selectedCategory])

  const handleSelectPreset = (preset: AssistantPresetTopic) => {
    setSelectedPresetId(preset.id)
    setQuery(preset.question)
  }

  const handleClear = () => {
    setQuery('')
    setSelectedPresetId(null)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-background to-sky-50/50 p-5 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/20 dark:via-background dark:to-sky-950/20 md:p-6">
      {/* Encabezado del Asistente */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground sm:text-lg">
                Asistente Operativo del Sistema
              </h3>
              <Badge
                variant="outline"
                className="border-indigo-300 bg-indigo-100/80 text-[11px] font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300"
              >
                Guía Rápida Interactiva
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Escribí tu consulta o elegí un procedimiento para ver el paso a paso exacto y enlaces directos.
            </p>
          </div>
        </div>
      </div>

      {/* Buscador inteligente del asistente */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedPresetId(null)
            }}
            placeholder="Preguntale al asistente: Ej. ¿Cómo abro la caja?, armar presupuesto, recibir equipo, garantía..."
            className="h-11 rounded-xl border-indigo-200/90 bg-background/95 pl-10 pr-9 text-sm shadow-inner transition-colors focus-visible:ring-indigo-500 dark:border-indigo-900/80"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Limpiar consulta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Categorías y Pills rápidos */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon
            const isSelected = selectedCategory === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedCategory(tab.id)
                  if (selectedPresetId) setSelectedPresetId(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60',
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel de Respuesta Activa */}
      {resolvedAnswer ? (
        <div className="mt-5 animate-in fade-in-50 slide-in-from-top-2 duration-200 rounded-xl border border-indigo-200 bg-background p-4 shadow-sm dark:border-indigo-900 dark:bg-card md:p-5">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h4 className="font-bold text-foreground text-base">
                  {resolvedAnswer.title}
                </h4>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {resolvedAnswer.directAnswer}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cerrar respuesta
            </Button>
          </div>

          {/* Pasos ordenados */}
          {resolvedAnswer.steps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Paso a paso recomendado:
              </p>
              <div className="space-y-2">
                {resolvedAnswer.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 p-2.5 text-xs text-foreground md:text-sm"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips y Precauciones */}
          {resolvedAnswer.proTip && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Lightbulb className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <span className="font-semibold">Recomendación práctica: </span>
                <span>{resolvedAnswer.proTip}</span>
              </div>
            </div>
          )}

          {resolvedAnswer.caution && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">Importante: </span>
                <span>{resolvedAnswer.caution}</span>
              </div>
            </div>
          )}

          {/* Botones de acción directa */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            {resolvedAnswer.actionHref && (
              <Button asChild size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                <Link href={resolvedAnswer.actionHref}>
                  {resolvedAnswer.actionLabel ?? 'Ir a la pantalla'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}

            {resolvedAnswer.sectionId && onSelectSection && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectSection(resolvedAnswer.sectionId!)}
                className="gap-1.5 text-xs border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900 dark:hover:bg-indigo-950"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Ver explicación detallada en la guía
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Preguntas frecuentes y accesos rápidos */
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Preguntas frecuentes y operaciones clave:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPresets.map((preset) => {
              const Icon = ICON_MAP[preset.icon] ?? Sparkles
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/90 p-2.5 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-xs dark:bg-card dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {preset.question}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {preset.categoryLabel}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
