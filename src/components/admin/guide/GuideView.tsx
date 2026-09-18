'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CreditCard,
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

const VERTICAL_LABELS: Record<string, string> = {
  electronics: 'Tecnología / Celulares',
  clothing: 'Indumentaria / Ropa',
  food: 'Gastronomía / Alimentos',
  hardware: 'Ferretería / Repuestos',
  cosmetics: 'Cosmética / Belleza',
  general: 'Comercio General',
  other: 'Otros rubros',
}

const SUGGESTED_QUERIES = ['caja', 'stock', 'roles', 'transferencia', 'publicar tienda', 'reportes', 'permisos']

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
  const [selectedVertical, setSelectedVertical] = useState<BusinessVertical | null | undefined>(businessVertical)

  // Cargar progreso de lectura desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('4g-guide-read-sections-v1')
      if (saved) setReadSections(JSON.parse(saved))
    } catch {}
  }, [])

  // Sincronizar rubro predeterminado cuando cambie
  useEffect(() => {
    setSelectedVertical(businessVertical)
  }, [businessVertical])

  // Atajo de teclado: presionar '/' enfoca el buscador, 'Escape' lo limpia
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

  // Filtrado según permisos y módulos del plan
  const available = useMemo(
    () => filterGuideSections(GUIDE_SECTIONS, { hasPermission, isAdmin, modules: effectiveModules }),
    [hasPermission, isAdmin, effectiveModules],
  )

  const results = useMemo(() => searchGuideSections(available, query), [available, query])
  const searching = query.trim().length > 0

  // Secciones filtradas según pestaña activa
  const filteredSections = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'first-steps' || activeTab === 'faq') return results
    return results.filter((sec) => sec.group === activeTab)
  }, [results, activeTab])

  // Agrupamiento por categorías
  const groups = useMemo(
    () =>
      GUIDE_GROUPS.map((group) => ({
        ...group,
        sections: filteredSections.filter((section) => section.group === group.id),
      })).filter((group) => group.sections.length > 0),
    [filteredSections],
  )

  // Conteo de secciones por pestaña para los badges
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: available.length,
      sistema: available.filter((s) => s.group === 'sistema').length,
      operations: available.filter((s) => s.group === 'operations').length,
      analytics: available.filter((s) => s.group === 'analytics').length,
      administration: available.filter((s) => s.group === 'administration').length,
      faq: available.reduce((acc, s) => acc + (s.faq?.length ?? 0), 0),
    }
    return counts
  }, [available])

  // Todas las preguntas frecuentes agregadas
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

  const readPercent = available.length > 0
    ? Math.min(100, Math.round((readSections.filter((id) => available.some((a) => a.id === id)).length / available.length) * 100))
    : 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header Principal */}
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Guía del sistema</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Qué hace cada sección, con un ejemplo de cada una, y qué te falta para empezar a vender.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5 text-xs font-medium shadow-sm"
              title="Abrir vista de impresión o guardar manual en PDF"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Barra de progreso de lectura y métricas rápidas */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card/60 p-3.5 shadow-sm sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Secciones del plan</p>
              <p className="text-sm font-semibold text-foreground">
                {available.length} {available.length === 1 ? 'módulo activo' : 'módulos activos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tu progreso de lectura</span>
                <span className="font-semibold text-foreground">{readPercent}%</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={readPercent} className="h-1.5 flex-1" />
                {readSections.length > 0 && (
                  <button
                    type="button"
                    onClick={resetReadProgress}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    title="Reiniciar progreso"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Preguntas Frecuentes</p>
              <p className="text-sm font-semibold text-foreground">{groupCounts.faq} respuestas clave</p>
            </div>
          </div>
        </div>

        {/* Buscador inteligente */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar: caja, stock, publicar tienda, permisos... (Presioná '/' para enfocar)"
              className="pl-9 pr-14"
              aria-label="Buscar en la guía"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar la búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Sugerencias de búsqueda rápida */}
          {!searching && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Sugerencias:
              </span>
              {SUGGESTED_QUERIES.map((tag) => (
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

        {/* Pestañas de categoría y controles de vista */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Temas de la guía" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              <span>Todos</span>
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {groupCounts.all}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('first-steps')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === 'first-steps'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
              )}
            >
              <span>🚀 Primeros pasos</span>
            </button>

            {GUIDE_GROUPS.map((group) => {
              const count = groupCounts[group.id] ?? 0
              if (count === 0) return null
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveTab(group.id as GuideCategoryTab)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    activeTab === group.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                  )}
                >
                  <span>{group.label}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                </button>
              )
            })}

            {groupCounts.faq > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('faq')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === 'faq'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                )}
              >
                <span>Preguntas Frecuentes</span>
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {groupCounts.faq}
                </Badge>
              </button>
            )}
          </nav>

          {/* Acciones de acordeones */}
          {activeTab !== 'first-steps' && activeTab !== 'faq' && (
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Abrir todas las secciones"
              >
                <ChevronsDown className="h-3.5 w-3.5" />
                Expandir todo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Cerrar todas las secciones"
              >
                <ChevronsUp className="h-3.5 w-3.5" />
                Colapsar
              </Button>
            </div>
          )}
        </div>

        {/* Selector de rubro para ejemplos */}
        {activeTab !== 'first-steps' && activeTab !== 'faq' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Store className="h-3.5 w-3.5 text-primary" />
              <span>Ejemplos adaptados para rubro:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['electronics', 'clothing', 'food', 'general'] as BusinessVertical[]).map((vert) => (
                <button
                  key={vert}
                  type="button"
                  onClick={() => setSelectedVertical(vert)}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                    selectedVertical === vert
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card text-muted-foreground border border-border/70 hover:border-primary/40 hover:text-primary',
                  )}
                >
                  {VERTICAL_LABELS[vert] ?? vert}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Panel de Primeros Pasos */}
      {(activeTab === 'all' || activeTab === 'first-steps') && !searching && <FirstStepsPanel />}

      {/* Estado de búsqueda */}
      {searching && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm" role="status">
          <span className="text-muted-foreground">
            {results.length === 0
              ? 'No hay nada con esas palabras. Probá con «caja», «stock» o «publicar».'
              : `${results.length} ${results.length === 1 ? 'sección' : 'secciones'} con «${query.trim()}»`}
          </span>
          {results.length > 0 && (
            <span className="text-xs text-muted-foreground">Coincidencias resaltadas</span>
          )}
        </div>
      )}

      {/* Modo FAQ Hub */}
      {activeTab === 'faq' ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Preguntas Frecuentes</h2>
            <p className="text-sm text-muted-foreground">
              Respuestas directas a las dudas habituales de configuración y operación.
            </p>
          </div>
          <div className="space-y-3">
            {allFaqs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No se encontraron preguntas frecuentes con «{query}».
              </p>
            ) : (
              allFaqs.map((faq, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {faq.sectionTitle}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        /* Secciones por grupo */
        groups.map((group) => (
          <section key={group.id} id={`guia-grupo-${group.id}`} className="space-y-3 scroll-mt-20">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
              <p className="text-sm text-muted-foreground">{group.description}</p>
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
