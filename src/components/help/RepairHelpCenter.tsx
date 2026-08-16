'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Download, Play, Search, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  REPAIRS_GUIDE_VERSION,
  getRepairGuideTracks,
  searchRepairGuide,
  type RepairGuideAudience,
  type RepairGuideTask,
} from './repairs-guide'

type RepairHelpCenterProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  audience: RepairGuideAudience
  onStartTour: (task: RepairGuideTask) => void
}

export function RepairHelpCenter({
  open,
  onOpenChange,
  audience,
  onStartTour,
}: RepairHelpCenterProps) {
  const tracks = useMemo(() => getRepairGuideTracks(audience), [audience])
  const [activeTrackId, setActiveTrackId] = useState(tracks[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<RepairGuideTask | null>(null)

  const visibleTasks = query.trim()
    ? searchRepairGuide(query, audience)
    : tracks.find(track => track.id === activeTrackId)?.tasks ?? tracks[0]?.tasks ?? []

  const handleStart = () => {
    if (!selectedTask) return
    onOpenChange(false)
    onStartTour(selectedTask)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg">Guía y ayuda de Reparaciones</SheetTitle>
              <SheetDescription className="mt-1">
                Elegí una tarea y te acompañamos sobre la pantalla real.
              </SheetDescription>
            </div>
            <Badge variant="secondary" className="mt-1 text-[10px]">v{REPAIRS_GUIDE_VERSION}</Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <label htmlFor="repair-help-search" className="text-sm font-semibold">
                ¿Qué querés hacer?
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="repair-help-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Ej.: cobrar saldo, abrir caja, entregar equipo"
                  className="pl-9"
                />
              </div>
            </div>

            {!query.trim() && (
              <div className="grid grid-cols-2 gap-2" aria-label="Tipo de guía">
                {tracks.map(track => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      setActiveTrackId(track.id)
                      setSelectedTask(null)
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      activeTrackId === track.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="block text-sm font-semibold">{track.title}</span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">{track.description}</span>
                  </button>
                ))}
              </div>
            )}

            <section aria-labelledby="repair-help-results">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="repair-help-results" className="text-sm font-semibold">
                  {query.trim() ? 'Resultados' : 'Guías rápidas'}
                </h3>
                <span className="text-xs text-muted-foreground">{visibleTasks.length} opciones</span>
              </div>

              {visibleTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center">
                  <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium">No encontramos una guía para esa búsqueda.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Probá con “pago”, “caja”, “precio” o “entrega”.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      aria-label={`Ver guía ${task.title}`}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedTask?.id === task.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{task.title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{task.summary}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {selectedTask && (
              <section className="rounded-xl border bg-muted/20 p-4" aria-live="polite">
                <h3 className="font-semibold">{selectedTask.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedTask.summary}</p>
                <ol className="mt-3 space-y-2 text-sm">
                  {selectedTask.steps.map((step, index) => (
                    <li key={step.anchorId} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-bold">{index + 1}</span>
                      <span>{step.title}</span>
                    </li>
                  ))}
                </ol>
                <Button onClick={handleStart} className="mt-4 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Iniciar recorrido
                </Button>
              </section>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-5 py-4 sm:px-6">
          <Button variant="outline" className="w-full gap-2" disabled title="Disponible al finalizar la guía visual">
            <Download className="h-4 w-4" aria-hidden="true" />
            Manual PDF en preparación
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
