'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Download,
  Play,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wrench,
  Package,
  Banknote,
  ShieldCheck,
  Printer,
  MessageSquare,
  LayoutGrid,
  Filter,
  KeyRound,
  Smartphone,
  AlertTriangle,
  Layers,
  HelpCircle,
  Lightbulb,
  FileCheck2,
  Video,
  PlayCircle,
  ExternalLink,
  Film,
  Tv,
} from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  REPAIRS_GUIDE_VERSION,
  REPAIRS_GUIDE_PDF_PATH,
  type RepairGuideAudience,
  type RepairGuideTask,
} from './repairs-guide'
import {
  REPAIR_STATUSES_GUIDE,
  NEW_REPAIR_MODAL_STEPS,
  REPAIR_FEATURES_GUIDE,
  REPAIR_VIDEO_TUTORIALS,
  HOW_TO_CREATE_VIDEOS_GUIDE,
  type RepairVideoTutorial,
} from './repairs-guide-details'

type RepairHelpCenterProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  audience?: RepairGuideAudience
  onStartTour?: (task: RepairGuideTask) => void
}

type RepairHelpTab = 'flow' | 'new-modal' | 'features' | 'videos'

const AUDIENCE_LABELS: Record<RepairGuideAudience, string> = {
  operator: 'Recepción & Mostrador',
  technician: 'Servicio Técnico',
  admin: 'Administración & Taller',
}

function getFeatureIcon(iconName: string) {
  switch (iconName) {
    case 'LayoutGrid':
      return LayoutGrid
    case 'Filter':
      return Filter
    case 'Wrench':
      return Wrench
    case 'Banknote':
      return Banknote
    case 'MessageSquare':
      return MessageSquare
    case 'Printer':
      return Printer
    default:
      return HelpCircle
  }
}

export function RepairHelpCenter({
  open,
  onOpenChange,
  audience = 'admin',
  onStartTour,
}: RepairHelpCenterProps) {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<RepairHelpTab>('flow')
  const [selectedStepNumber, setSelectedStepNumber] = useState(1)
  const [selectedVideo, setSelectedVideo] = useState<RepairVideoTutorial>(REPAIR_VIDEO_TUTORIALS[0])
  const [isPlayingDemo, setIsPlayingDemo] = useState(false)
  const [showRecordingGuide, setShowRecordingGuide] = useState(false)

  // Filtrado de estados y características según la búsqueda
  const filteredStatuses = useMemo(() => {
    if (!query.trim()) return REPAIR_STATUSES_GUIDE
    const q = query.toLowerCase().trim()
    return REPAIR_STATUSES_GUIDE.filter(
      s => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.example.toLowerCase().includes(q)
    )
  }, [query])

  const filteredSteps = useMemo(() => {
    if (!query.trim()) return NEW_REPAIR_MODAL_STEPS
    const q = query.toLowerCase().trim()
    return NEW_REPAIR_MODAL_STEPS.filter(
      st => st.title.toLowerCase().includes(q) || st.subtitle.toLowerCase().includes(q) || st.description.toLowerCase().includes(q)
    )
  }, [query])

  const filteredFeatures = useMemo(() => {
    if (!query.trim()) return REPAIR_FEATURES_GUIDE
    const q = query.toLowerCase().trim()
    return REPAIR_FEATURES_GUIDE.filter(
      f => f.title.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || f.howItWorks.toLowerCase().includes(q)
    )
  }, [query])

  const filteredVideos = useMemo(() => {
    if (!query.trim()) return REPAIR_VIDEO_TUTORIALS
    const q = query.toLowerCase().trim()
    return REPAIR_VIDEO_TUTORIALS.filter(
      v => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.topics.some(t => t.toLowerCase().includes(q))
    )
  }, [query])

  const hasSearchMatches =
    filteredStatuses.length > 0 ||
    filteredSteps.length > 0 ||
    filteredFeatures.length > 0 ||
    filteredVideos.length > 0

  const activeStep = NEW_REPAIR_MODAL_STEPS.find(s => s.number === selectedStepNumber) || NEW_REPAIR_MODAL_STEPS[0]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl md:max-w-3xl p-0 flex flex-col gap-0 border-l shadow-2xl bg-background"
      >
        {/* ── Encabezado Principal ── */}
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-foreground">
                  Centro de Ayuda del Taller
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Guía completa de procesos, estados, cobros y video tutoriales.
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[10px]">
                {AUDIENCE_LABELS[audience]}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {REPAIRS_GUIDE_VERSION}
              </Badge>
            </div>
          </div>

          {/* Buscador inteligente */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué quieres consultar? Ej: patrón, seña, video, repuestos, garantía..."
              className="pl-9 pr-8 text-xs sm:text-sm h-10 rounded-xl bg-background border-border/80 shadow-2xs"
              aria-label="Qué querés hacer en el taller"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </SheetHeader>

        {/* ── Cuerpo con Scroll ── */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Si el usuario busca algo */}
            {query.trim() ? (
              <section className="space-y-4" aria-label="Resultados de búsqueda">
                <div className="flex items-center justify-between pb-2 border-b">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Resultados para: <span className="text-foreground font-bold font-mono">&quot;{query}&quot;</span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setQuery('')} className="h-7 text-xs">
                    Ver todos los temas
                  </Button>
                </div>

                {!hasSearchMatches ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center space-y-3 bg-muted/10">
                    <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="text-sm font-semibold text-foreground">No encontramos una guía específica para esa búsqueda</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Intenta con palabras clave como <span className="font-mono font-semibold">estado</span>, <span className="font-mono font-semibold">patrón</span>, <span className="font-mono font-semibold">seña</span>, <span className="font-mono font-semibold">repuesto</span> o <span className="font-mono font-semibold">videos</span>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Videos coincidentes */}
                    {filteredVideos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Video Tutoriales ({filteredVideos.length})</span>
                        </p>
                        <div className="grid gap-2">
                          {filteredVideos.map(vid => (
                            <div
                              key={vid.id}
                              onClick={() => {
                                setSelectedVideo(vid)
                                setActiveTab('videos')
                                setQuery('')
                              }}
                              className="rounded-2xl border p-3.5 bg-card hover:border-emerald-500/50 cursor-pointer transition-all space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                                  <PlayCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                  {vid.title}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                  {vid.duration}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{vid.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paso a paso del modal coincidente */}
                    {filteredSteps.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Pasos del Modal de Nueva Reparación ({filteredSteps.length})
                        </p>
                        <div className="grid gap-2">
                          {filteredSteps.map(step => (
                            <div key={step.number} className="rounded-2xl border p-4 bg-card space-y-2 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                                  {step.number}
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-foreground">{step.title}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground pl-8">{step.description}</p>
                              <div className="pl-8 pt-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                💡 Tip: {step.tips[0]}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estados coincidentes */}
                    {filteredStatuses.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Estados del Taller ({filteredStatuses.length})
                        </p>
                        <div className="grid gap-2">
                          {filteredStatuses.map(status => (
                            <div key={status.status} className="rounded-2xl border p-3.5 bg-card space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <Badge className={cn('text-xs font-semibold px-2 py-0.5 border', status.badgeTone)}>
                                  {status.label}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">{status.typicalDuration}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{status.description}</p>
                              <p className="text-[11px] text-foreground font-medium bg-muted/30 p-2 rounded-xl">
                                📝 Ejemplo: {status.example}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Módulos coincidentes */}
                    {filteredFeatures.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Módulos y Funcionalidades ({filteredFeatures.length})
                        </p>
                        <div className="grid gap-2">
                          {filteredFeatures.map(feat => {
                            const IconComponent = getFeatureIcon(feat.iconName)
                            return (
                              <div key={feat.id} className="rounded-2xl border p-4 bg-card space-y-2 shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                    <IconComponent className="h-4 w-4" />
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground">{feat.title}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground">{feat.summary}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : (
              /* Vista Principal en Pestañas Didácticas */
              <div className="space-y-5">
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as RepairHelpTab)} className="space-y-5">
                  <TabsList className="grid grid-cols-4 w-full h-11 p-1 bg-muted/60 rounded-2xl border border-border/60">
                    <TabsTrigger
                      value="flow"
                      onClick={() => setActiveTab('flow')}
                      className="text-xs font-semibold rounded-xl"
                    >
                      🔄 Estados
                    </TabsTrigger>
                    <TabsTrigger
                      value="new-modal"
                      onClick={() => setActiveTab('new-modal')}
                      className="text-xs font-semibold rounded-xl"
                    >
                      ➕ Nueva Orden
                    </TabsTrigger>
                    <TabsTrigger
                      value="features"
                      onClick={() => setActiveTab('features')}
                      className="text-xs font-semibold rounded-xl"
                    >
                      🛠️ Módulos
                    </TabsTrigger>
                    <TabsTrigger
                      value="videos"
                      onClick={() => setActiveTab('videos')}
                      className="text-xs font-semibold rounded-xl gap-1.5"
                    >
                      🎥 Videos
                    </TabsTrigger>
                  </TabsList>

                {/* ══════════════════════════════════════════════════════
                    PESTAÑA 1: CICLO DE VIDA Y ESTADOS CON EJEMPLOS
                   ══════════════════════════════════════════════════════ */}
                <TabsContent value="flow" className="space-y-4 m-0">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span>Ciclo de Vida de una Reparación (6 Estados)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Cada equipo transita por un flujo ordenado desde su ingreso hasta la entrega con garantía.
                    </p>
                  </div>

                  {/* Diagrama visual de etapas */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-muted/30 rounded-2xl border border-border/70 text-center">
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">1</div>
                      <p className="text-[10px] font-bold">Pendiente</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">2</div>
                      <p className="text-[10px] font-bold">En Revisión</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs">3</div>
                      <p className="text-[10px] font-bold">Repuesto</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">4</div>
                      <p className="text-[10px] font-bold">Listo</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-slate-500/10 text-slate-600 flex items-center justify-center font-bold text-xs">5</div>
                      <p className="text-[10px] font-bold">Entregado</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-7 w-7 mx-auto rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs">6</div>
                      <p className="text-[10px] font-bold">Cancelado</p>
                    </div>
                  </div>

                  {/* Fichas detalladas de cada estado con ejemplos */}
                  <div className="space-y-3 pt-1">
                    {REPAIR_STATUSES_GUIDE.map((status, idx) => (
                      <div
                        key={status.status}
                        className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 transition-all hover:border-primary/40 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <Badge className={cn('text-xs font-bold px-2.5 py-0.5 border', status.badgeTone)}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                            <Clock className="h-3 w-3" />
                            <span>{status.typicalDuration}</span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {status.description}
                        </p>

                        <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1.5 text-xs">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Acciones permitidas en este estado:</span>
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-5 list-disc text-muted-foreground text-[11px]">
                            {status.actionsAllowed.map((action, i) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 p-3 text-xs">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            📌 Caso de ejemplo real:
                          </span>
                          <span className="text-muted-foreground leading-snug">
                            {status.example}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════
                    PESTAÑA 2: MODAL DE NUEVA REPARACIÓN (PASO A PASO)
                   ══════════════════════════════════════════════════════ */}
                <TabsContent value="new-modal" className="space-y-4 m-0">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>Cómo Registrar una Nueva Reparación (8 Pasos)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      El formulario garantiza que no falte ningún dato legal, técnico o financiero al recibir un equipo.
                    </p>
                  </div>

                  {/* Selector rápido de paso (1 al 8) */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 p-2 bg-muted/40 rounded-2xl border border-border/70">
                    {NEW_REPAIR_MODAL_STEPS.map((step) => {
                      const isCurrent = step.number === selectedStepNumber
                      return (
                        <button
                          key={step.number}
                          type="button"
                          onClick={() => setSelectedStepNumber(step.number)}
                          className={cn(
                            'h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-bold',
                            isCurrent
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <span>Paso {step.number}</span>
                          <span className="text-[9px] font-normal truncate max-w-[70px]">
                            {step.subtitle}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Tarjeta del paso activo */}
                  <Card className="rounded-2xl border-emerald-500/30 bg-card shadow-sm overflow-hidden">
                    <CardHeader className="p-4 sm:p-5 border-b bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white text-xs font-bold">
                            {activeStep.number}
                          </span>
                          <div>
                            <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                              {activeStep.title}
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              {activeStep.subtitle}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                          {activeStep.number} de {NEW_REPAIR_MODAL_STEPS.length}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
                      <p className="text-foreground leading-relaxed">
                        {activeStep.description}
                      </p>

                      {/* Tips del paso */}
                      <div className="rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs">
                          <Lightbulb className="h-4 w-4" />
                          <span>Consejos clave para este paso:</span>
                        </div>
                        <ul className="space-y-1 pl-5 list-disc text-muted-foreground text-xs">
                          {activeStep.tips.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Ejemplo con datos reales */}
                      <div className="rounded-xl bg-muted/50 border border-border/80 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <FileCheck2 className="h-4 w-4 text-emerald-600" />
                            {activeStep.example.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          &quot;{activeStep.example.scenario}&quot;
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Object.entries(activeStep.example.data).map(([key, val]) => (
                            <div key={key} className="rounded-lg bg-background p-2 border text-xs">
                              <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                                {key}
                              </span>
                              <span className="font-bold text-foreground">
                                {val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botones de navegación del paso */}
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={selectedStepNumber === 1}
                          onClick={() => setSelectedStepNumber(prev => Math.max(1, prev - 1))}
                          className="h-8 text-xs rounded-xl"
                        >
                          Paso anterior
                        </Button>
                        <Button
                          size="sm"
                          disabled={selectedStepNumber === NEW_REPAIR_MODAL_STEPS.length}
                          onClick={() => setSelectedStepNumber(prev => Math.min(NEW_REPAIR_MODAL_STEPS.length, prev + 1))}
                          className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                        >
                          <span>Siguiente paso</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════
                    PESTAÑA 3: MÓDULOS Y FUNCIONALIDADES DEL PANEL
                   ══════════════════════════════════════════════════════ */}
                <TabsContent value="features" className="space-y-4 m-0">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-emerald-600" />
                      <span>Herramientas y Funcionalidades del Panel</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Conoce las funciones avanzadas para administrar el taller sin fugas de dinero ni repuestos.
                    </p>
                  </div>

                  <div className="grid gap-3.5">
                    {REPAIR_FEATURES_GUIDE.map((feat) => {
                      const IconComponent = getFeatureIcon(feat.iconName)
                      return (
                        <div
                          key={feat.id}
                          className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 transition-all hover:border-emerald-500/40 shadow-2xs"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-bold text-foreground">
                                {feat.title}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {feat.summary}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 text-xs space-y-1">
                            <span className="font-semibold text-foreground block">
                              ⚙️ Cómo opera en el sistema:
                            </span>
                            <p className="text-muted-foreground leading-relaxed">
                              {feat.howItWorks}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl bg-background p-3 border border-border/70 space-y-1">
                              <span className="font-bold text-foreground flex items-center gap-1.5 text-[11px]">
                                💡 Ejemplo práctico:
                              </span>
                              <p className="text-muted-foreground leading-snug">
                                {feat.example}
                              </p>
                            </div>

                            <div className="rounded-xl bg-emerald-500/5 dark:bg-emerald-950/30 p-3 border border-emerald-500/20 space-y-1">
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-[11px]">
                                🚀 Consejo pro:
                              </span>
                              <p className="text-emerald-900/80 dark:text-emerald-300/80 leading-snug">
                                {feat.proTip}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════
                    PESTAÑA 4: VIDEO TUTORIALES Y GUÍA DE CAPACITACIÓN
                   ══════════════════════════════════════════════════════ */}
                <TabsContent value="videos" className="space-y-4 m-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Video className="h-4 w-4 text-emerald-600" />
                        <span>Capacitación en Video para el Taller</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Tutoriales concisos de 2 a 3 minutos para capacitar a todo el equipo de mostrador y técnicos.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecordingGuide(prev => !prev)}
                      className="rounded-xl text-xs font-semibold gap-1.5 shrink-0 border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <Film className="h-3.5 w-3.5 text-emerald-600" />
                      {showRecordingGuide ? 'Ocultar guía de videos' : '¿Cómo crear tus videos?'}
                    </Button>
                  </div>

                  {/* Tarjeta desplegable: Cómo crear videos para el taller */}
                  {showRecordingGuide && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-background dark:from-emerald-950/30 dark:via-teal-950/15 p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tv className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-foreground">
                            ¿Se pueden crear videos para el taller? ¡Sí, y es muy simple!
                          </h4>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          Capacitación oficial
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Crea una biblioteca de capacitación para que los nuevos empleados aprendan solos en su primer día. Sigue estos 4 pasos recomendados:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {HOW_TO_CREATE_VIDEOS_GUIDE.map((tip) => (
                          <div key={tip.step} className="rounded-xl bg-background/90 p-3.5 border space-y-1.5 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                                {tip.step}
                              </span>
                              <span className="text-xs font-bold text-foreground leading-tight">
                                {tip.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                              {tip.description}
                            </p>
                            <div className="pl-7 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                              💡 {tip.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reproductor interactivo del video seleccionado */}
                  <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
                    <div className={cn(
                      'relative aspect-video max-h-72 w-full bg-gradient-to-br flex flex-col justify-between p-5 text-white',
                      selectedVideo.thumbnailBg
                    )}>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-black/40 backdrop-blur-md text-white border-white/20 text-[10px] font-semibold">
                          {selectedVideo.role} • {selectedVideo.level}
                        </Badge>
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-xs font-mono font-bold">
                          <Clock className="h-3 w-3" />
                          {selectedVideo.duration}
                        </span>
                      </div>

                      <div className="text-center space-y-2 py-4">
                        <button
                          type="button"
                          onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                          aria-label={`Reproducir ${selectedVideo.title}`}
                          className="h-14 w-14 mx-auto rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-lg hover:scale-105 transition-all hover:bg-white"
                        >
                          <Play className="h-6 w-6 fill-current ml-0.5" />
                        </button>
                        <p className="text-xs text-white/90 font-medium drop-shadow-sm">
                          {isPlayingDemo ? 'Simulando reproducción en vivo' : 'Clic para reproducir tutorial'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm sm:text-base font-bold leading-tight drop-shadow-sm">
                          {selectedVideo.title}
                        </h4>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedVideo.description}
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                          Temas abordados en este tutorial:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {selectedVideo.topics.map((topic, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Listado de tutoriales disponibles */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Catálogo de Tutoriales del Sistema ({REPAIR_VIDEO_TUTORIALS.length})
                    </span>

                    <div className="grid gap-2.5">
                      {REPAIR_VIDEO_TUTORIALS.map((video) => {
                        const isSelected = selectedVideo.id === video.id
                        return (
                          <div
                            key={video.id}
                            onClick={() => {
                              setSelectedVideo(video)
                              setIsPlayingDemo(false)
                            }}
                            className={cn(
                              'rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs',
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                                : 'border-border/70 hover:border-emerald-500/40 bg-card'
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                <Play className="h-4 w-4 fill-current" />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                                    {video.title}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {video.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {video.duration}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {video.role}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Pie de Página Fijo ── */}
        <div className="border-t bg-muted/20 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Manual de usuario oficial del Sistema 4G para taller y servicio técnico.
          </p>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto gap-2 rounded-xl text-xs font-semibold">
            <a href={REPAIRS_GUIDE_PDF_PATH} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              Descargar manual PDF
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
