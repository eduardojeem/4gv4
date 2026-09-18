'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  CreditCard,
  FileText,
  HelpCircle,
  Layers,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { getNavItemByKey } from '@/config/admin-navigation'
import { GUIDE_SECTIONS } from '@/lib/guide/content'
import { GUIDE_GROUPS, filterGuideSections, searchGuideSections, type GuideSection } from '@/lib/guide/types'
import { printAdminGuide } from '@/lib/guide/guide-printer'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import { cn } from '@/lib/utils'
import { FirstStepsPanel } from './FirstStepsPanel'
import { GuideSectionCard } from './GuideSectionCard'

const CONCEPT_ICONS: Record<string, LucideIcon> = {
  plataforma: Building2,
  roles: ShieldCheck,
  plan: CreditCard,
}

const VERTICAL_OPTIONS: { id: BusinessVertical; label: string }[] = [
  { id: 'electronics', label: 'Tecnología / Celulares' },
  { id: 'clothing', label: 'Indumentaria / Ropa' },
  { id: 'food', label: 'Gastronomía / Alimentos' },
  { id: 'hardware', label: 'Ferretería / Repuestos' },
  { id: 'cosmetics', label: 'Cosmética / Belleza' },
  { id: 'general', label: 'Comercio General' },
]

const POPULAR_SEARCH_TAGS = ['caja', 'stock', 'roles', 'transferencia', 'publicar tienda', 'reportes', 'permisos']

function iconFor(section: GuideSection): LucideIcon {
  if (section.navKey) {
    const item = getNavItemByKey(section.navKey)
    if (item) return item.icon
  }
  return CONCEPT_ICONS[section.id] ?? Sparkles
}

export type GuideCategoryTab = 'all' | 'first-steps' | 'sistema' | 'operations' | 'analytics' | 'administration' | 'faq'

export function GuideView() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<GuideCategoryTab>('all')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [readSections, setReadSections] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { hasPermission, isAdmin } = useAuth()
  const { effectiveModules, businessVertical } = useSubscriptionStatus()
  const [selectedVertical, setSelectedVertical] = useState<BusinessVertical>(
    (businessVertical as BusinessVertical) || 'electronics',
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('4g-guide-read-sections-v1')
      if (saved) setReadSections(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    if (businessVertical) {
      setSelectedVertical(businessVertical as BusinessVertical)
    }
  }, [businessVertical])

  // Atajos de teclado: '/' para enfocar búsqueda, 'Esc' para limpiar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && targetTag !== 'INPUT' && targetTag !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleReadSection = (id: string) => {
    setReadSections((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      try {
        localStorage.setItem('4g-guide-read-sections-v1', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const resetReadProgress = () => {
    setReadSections([])
    try {
      localStorage.removeItem('4g-guide-read-sections-v1')
    } catch {}
  }

  // Filtrado según módulos y permisos del usuario
  const available = useMemo(
    () => filterGuideSections(GUIDE_SECTIONS, { hasPermission, isAdmin, modules: effectiveModules }),
    [hasPermission, isAdmin, effectiveModules],
  )

  const results = useMemo(() => searchGuideSections(available, query), [available, query])
  const searching = query.trim().length > 0

  // Secciones a mostrar según la pestaña elegida
  const filteredSections = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'first-steps' || activeTab === 'faq') return results
    return results.filter((sec) => sec.group === activeTab)
  }, [results, activeTab])

  // Agrupación de secciones
  const groups = useMemo(
    () =>
      GUIDE_GROUPS.map((group) => ({
        ...group,
        sections: filteredSections.filter((section) => section.group === group.id),
      })).filter((group) => group.sections.length > 0),
    [filteredSections],
  )

  // Conteos para los badges de las pestañas
  const groupCounts = useMemo(() => {
    return {
      all: available.length,
      sistema: available.filter((s) => s.group === 'sistema').length,
      operations: available.filter((s) => s.group === 'operations').length,
      analytics: available.filter((s) => s.group === 'analytics').length,
      administration: available.filter((s) => s.group === 'administration').length,
      faq: available.reduce((acc, s) => acc + (s.faq?.length ?? 0), 0),
    }
  }, [available])

  // FAQs consolidadas para el FAQ Hub
  const allFaqs = useMemo(() => {
    return available.flatMap((section) =>
      (section.faq ?? []).map((entry) => ({
        ...entry,
        sectionId: section.id,
        sectionTitle: section.title,
      })),
    ).filter((f) => {
      if (!searching) return true
      const q = query.toLowerCase()
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.sectionTitle.toLowerCase().includes(q)
    })
  }, [available, searching, query])

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    available.forEach((s) => {
      next[s.id] = true
    })
    setExpandedMap(next)
  }

  const collapseAll = () => {
    const next: Record<string, boolean> = {}
    available.forEach((s) => {
      next[s.id] = false
    })
    setExpandedMap(next)
  }

  const handleToggleSection = (id: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: !Boolean(prev[id] ?? searching),
    }))
  }

  const handlePrint = () => {
    printAdminGuide(available, {
      title: 'Manual de Uso y Guía del Sistema',
      companyName: '4G Gestión',
    })
  }

  const readCount = readSections.filter((id) => available.some((a) => a.id === id)).length
  const readPercent = available.length > 0 ? Math.min(100, Math.round((readCount / available.length) * 100)) : 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      {/* ── Encabezado Principal ── */}
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Guía del sistema</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Qué hace cada sección, con un ejemplo de cada una, y qué te falta para empezar a vender.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector compacto de Rubro */}
            <div className="flex items-center gap-1.5">
              <span className="hidden text-xs text-muted-foreground sm:inline-block">Rubro:</span>
              <Select value={selectedVertical} onValueChange={(val) => setSelectedVertical(val as BusinessVertical)}>
                <SelectTrigger size="sm" className="h-8 gap-1.5 text-xs">
                  <Store className="h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Seleccionar rubro" />
                </SelectTrigger>
                <SelectContent align="end">
                  {VERTICAL_OPTIONS.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botón de Impresión / PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Abrir vista de impresión o guardar manual en PDF"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* ── Buscador y Atajos ── */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por palabra clave: caja, stock, roles, reportes... (tecla '/')"
              className="h-10 pl-10 pr-12 text-sm shadow-xs"
              aria-label="Buscar en la guía"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-muted"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar la búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <kbd className="pointer-events-none hidden rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Chips de Búsqueda Rápida */}
          {!searching && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground/70">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Temas frecuentes:
              </span>
              {POPULAR_SEARCH_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className="rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Barra de Navegación por Pestañas y Controles ── */}
        <div className="flex flex-col gap-2.5 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Temas de la guía" className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span>Todos</span>
              <span className={cn('rounded px-1 text-[10px] tabular-nums', activeTab === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {groupCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('first-steps')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'first-steps'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span>🚀 Primeros pasos</span>
            </button>

            {GUIDE_GROUPS.map((group) => {
              const count = groupCounts[group.id] ?? 0
              if (count === 0) return null
              const isSelected = activeTab === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveTab(group.id as GuideCategoryTab)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span>{group.label}</span>
                  <span className={cn('rounded px-1 text-[10px] tabular-nums', isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    {count}
                  </span>
                </button>
              )
            })}

            {groupCounts.faq > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('faq')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === 'faq'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span>Preguntas Frecuentes</span>
                <span className={cn('rounded px-1 text-[10px] tabular-nums', activeTab === 'faq' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  {groupCounts.faq}
                </span>
              </button>
            )}
          </nav>

          {/* Mini lectura y controles de expandir/colapsar */}
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{readPercent}% leído</span>
              {readSections.length > 0 && (
                <button
                  type="button"
                  onClick={resetReadProgress}
                  className="text-muted-foreground hover:text-foreground"
                  title="Reiniciar progreso de lectura"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>

            {activeTab !== 'first-steps' && activeTab !== 'faq' && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Expandir todas las tarjetas"
                >
                  <ChevronsDown className="mr-1 h-3 w-3" />
                  Expandir todo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Colapsar todas las tarjetas"
                >
                  <ChevronsUp className="mr-1 h-3 w-3" />
                  Colapsar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Índice rápido de anclas cuando se ve 'Todos' ── */}
        {activeTab === 'all' && !searching && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="font-medium text-muted-foreground">Ir directo a:</span>
            {groups.map((group) => (
              <a
                key={group.id}
                href={`#guia-grupo-${group.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <span>{group.label}</span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── Panel de Primeros Pasos ── */}
      {(activeTab === 'all' || activeTab === 'first-steps') && !searching && <FirstStepsPanel />}

      {/* ── Estado y contador de búsqueda ── */}
      {searching && (
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-2.5 text-sm" role="status">
          <span className="text-muted-foreground">
            {results.length === 0
              ? 'No hay nada con esas palabras. Probá con «caja», «stock» o «publicar».'
              : `${results.length} ${results.length === 1 ? 'sección encontrada' : 'secciones encontradas'} con «${query.trim()}»`}
          </span>
          {results.length > 0 && (
            <span className="text-xs text-muted-foreground">Coincidencias resaltadas en amarillo</span>
          )}
        </div>
      )}

      {/* ── Modo Preguntas Frecuentes (FAQ Hub) ── */}
      {activeTab === 'faq' ? (
        <section className="space-y-4">
          <div className="border-b border-border/70 pb-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Preguntas Frecuentes</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Respuestas rápidas a las dudas comunes de configuración y uso diario del sistema.
            </p>
          </div>

          <div className="space-y-3">
            {allFaqs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No se encontraron preguntas con «{query}».
              </p>
            ) : (
              allFaqs.map((faq, idx) => (
                <div key={idx} className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                        <Badge variant="outline" className="border-border/80 bg-muted/30 text-[10px]">
                          {faq.sectionTitle}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        /* ── Lista de Grupos y Secciones de la Guía ── */
        groups.map((group) => (
          <section key={group.id} id={`guia-grupo-${group.id}`} className="space-y-3.5 scroll-mt-20">
            <div className="border-b border-border/60 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{group.label}</h2>
                <Badge variant="secondary" className="text-xs">
                  {group.sections.length} {group.sections.length === 1 ? 'sección' : 'secciones'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">{group.description}</p>
            </div>

            <div className="space-y-3">
              {group.sections.map((section) => {
                const isControlledOpen = expandedMap[section.id]
                const isOpen = isControlledOpen !== undefined ? isControlledOpen : searching
                const isRead = readSections.includes(section.id)

                return (
                  <GuideSectionCard
                    key={section.id}
                    section={section}
                    icon={iconFor(section)}
                    vertical={selectedVertical}
                    defaultOpen={searching}
                    isOpen={isOpen}
                    onToggle={() => handleToggleSection(section.id)}
                    searchQuery={searching ? query : undefined}
                    isRead={isRead}
                    onToggleRead={toggleReadSection}
                  />
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
