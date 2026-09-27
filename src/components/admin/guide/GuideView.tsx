'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2, ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Package,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  Sunrise,
  Sunset, Users,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { getVerticalRecommendation, type VerticalRecommendation } from '@/lib/guide/vertical-recommendations'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import { cn } from '@/lib/utils'
import { FirstStepsPanel } from './FirstStepsPanel'
import { GuideSectionCard } from './GuideSectionCard'

const CONCEPT_ICONS: Record<string, LucideIcon> = {
  plataforma: Building2,
  roles: ShieldCheck,
  plan: CreditCard,
  pos: ShoppingBag,
  caja: CreditCard,
  customers: Users,
  orders: Package,
  repairs: Wrench,
  promotions: Sparkles,
  credits: CreditCard,
  suppliers: Store,
}

const VERTICAL_OPTIONS: { id: BusinessVertical; label: string; icon: string }[] = [
  { id: 'electronics', label: 'Tecnología / Celulares', icon: '📱' },
  { id: 'clothing', label: 'Indumentaria / Ropa', icon: '👗' },
  { id: 'food', label: 'Gastronomía / Alimentos', icon: '🍔' },
  { id: 'hardware', label: 'Ferretería / Repuestos', icon: '🔧' },
  { id: 'cosmetics', label: 'Cosmética / Belleza', icon: '💄' },
  { id: 'general', label: 'Comercio General', icon: '🏪' },
]

const GROUP_HEADER_THEMES: Record<
  string,
  {
    badge: string
    badgeClass: string
    icon: LucideIcon
    titleClass: string
    borderClass: string
  }
> = {
  operations: {
    badge: 'DASHBOARD • OPERACIONES',
    badgeClass: 'border-blue-200 bg-blue-100/90 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    icon: LayoutDashboard,
    titleClass: 'text-blue-950 dark:text-blue-200',
    borderClass: 'border-l-4 border-l-blue-600 pl-3',
  },
  administration: {
    badge: 'ADMIN • GESTIÓN',
    badgeClass: 'border-purple-200 bg-purple-100/90 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300',
    icon: ShieldCheck,
    titleClass: 'text-purple-950 dark:text-purple-200',
    borderClass: 'border-l-4 border-l-purple-600 pl-3',
  },
  analytics: {
    badge: 'MÉTRICAS Y FINANZAS',
    badgeClass: 'border-emerald-200 bg-emerald-100/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    icon: CreditCard,
    titleClass: 'text-emerald-950 dark:text-emerald-200',
    borderClass: 'border-l-4 border-l-emerald-600 pl-3',
  },
  sistema: {
    badge: 'CONCEPTOS DEL SISTEMA',
    badgeClass: 'border-indigo-200 bg-indigo-100/90 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    icon: BookOpen,
    titleClass: 'text-indigo-950 dark:text-indigo-200',
    borderClass: 'border-l-4 border-l-indigo-600 pl-3',
  },
}

const QUICK_SEARCH_CHIPS = ['caja', 'stock', 'roles', 'transferencia', 'publicar tienda', 'reportes']

const DASHBOARD_SECTION_IDS = [
  'pos',
  'caja',
  'inventory',
  'customers',
  'orders',
  'repairs',
  'promotions',
  'credits',
  'suppliers',
  'cash-monitor',
  'reports',
]

function iconFor(section: GuideSection): LucideIcon {
  if (section.navKey) {
    const item = getNavItemByKey(section.navKey)
    if (item) return item.icon
  }
  return CONCEPT_ICONS[section.id] ?? Sparkles
}

export type MainGuideTab = 'summary' | 'all' | 'dashboard' | 'admin' | 'rubro' | 'first-steps' | 'faq'

export function GuideView() {
  const hydrated = useHydrated()
  return hydrated ? <GuideViewContent /> : null
}

function GuideViewContent() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<MainGuideTab>('summary')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [readSections, setReadSections] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('4g-guide-read-sections-v1') ?? '[]')
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
    } catch { return [] }
  })
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { hasPermission, isAdmin } = useAuth()
  const { effectiveModules, businessVertical } = useSubscriptionStatus()
  const [verticalOverride, setSelectedVertical] = useState<BusinessVertical | null>(null)
  const selectedVertical = verticalOverride ?? (businessVertical as BusinessVertical) ?? 'electronics'

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

  const available = useMemo(
    () => filterGuideSections(GUIDE_SECTIONS, { hasPermission, isAdmin, modules: effectiveModules }),
    [hasPermission, isAdmin, effectiveModules],
  )

  const results = useMemo(() => searchGuideSections(available, query), [available, query])
  const searching = query.trim().length > 0

  const dashboardSections = useMemo(
    () => results.filter((s) => DASHBOARD_SECTION_IDS.includes(s.id)),
    [results],
  )

  const adminSections = useMemo(
    () => results.filter((s) => !DASHBOARD_SECTION_IDS.includes(s.id)),
    [results],
  )

  const dashboardCount = useMemo(
    () => available.filter((s) => DASHBOARD_SECTION_IDS.includes(s.id)).length,
    [available],
  )
  const adminCount = useMemo(
    () => available.filter((s) => !DASHBOARD_SECTION_IDS.includes(s.id)).length,
    [available],
  )
  const faqCount = useMemo(
    () => available.reduce((acc, s) => acc + (s.faq?.length ?? 0), 0),
    [available],
  )

  const visibleSections = useMemo(() => {
    if (activeTab === 'dashboard') return dashboardSections
    if (activeTab === 'admin') return adminSections
    return results
  }, [activeTab, dashboardSections, adminSections, results])

  const groups = useMemo(
    () =>
      GUIDE_GROUPS.map((group) => ({
        ...group,
        sections: visibleSections.filter((section) => section.group === group.id),
      })).filter((group) => group.sections.length > 0),
    [visibleSections],
  )

  const verticalRec: VerticalRecommendation = useMemo(() => {
    return getVerticalRecommendation(selectedVertical)
  }, [selectedVertical])

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
      {/* ── Encabezado Limpio y Espacioso ── */}
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Guía del sistema</h1>
                <Badge variant="secondary" className="hidden text-[10px] sm:inline-block">
                  Manual interactivo
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Qué hace cada sección, con un ejemplo de cada una, y qué te falta para empezar a vender.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Selector de Rubro Estilizado */}
            <Select value={selectedVertical} onValueChange={(val) => setSelectedVertical(val as BusinessVertical)}>
              <SelectTrigger size="sm" className="h-8.5 gap-1.5 rounded-lg border-border/70 bg-card text-xs">
                <Store className="h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder="Seleccionar rubro" />
              </SelectTrigger>
              <SelectContent align="end">
                {VERTICAL_OPTIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">
                    <span className="mr-1.5">{item.icon}</span>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Botón Imprimir */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8.5 gap-1.5 rounded-lg border-border/70 bg-card text-xs font-medium"
              title="Abrir vista de impresión o guardar manual en PDF"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* ── Buscador Integrado ── */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el manual: caja, stock, roles, reportes, permisos... (tecla '/')"
              className="h-10.5 rounded-xl border-border/80 bg-card pl-10 pr-12 text-sm shadow-xs transition-shadow focus-visible:ring-1"
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
                <kbd className="pointer-events-none hidden rounded-md border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
                  /
                </kbd>
              )}
            </div>
          </div>

          {!searching && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-[11px] font-bold text-muted-foreground">Sugerencias rápidas:</span>
              {QUICK_SEARCH_CHIPS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-2 border-border/80 bg-background px-2.5 py-1 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary hover:shadow-xs active:scale-95"
                >
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Barra de Navegación Segmentada y Colorida ── */}
        <div className="rounded-2xl border-2 border-border/80 bg-muted/40 p-1.5 shadow-xs">
          <nav aria-label="Temas de la guía" className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
            {/* 0. Resumen General (Limpio e intuitivo) */}
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'summary'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm border-2 border-slate-900 dark:border-slate-100 ring-2 ring-slate-400/20'
                  : 'border-2 border-border/80 bg-background text-foreground/80 hover:bg-muted hover:border-border hover:text-foreground hover:shadow-xs',
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Resumen</span>
            </button>

            {/* 1. Dashboard / Operaciones (Azul) */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm border-2 border-blue-600 ring-2 ring-blue-400/30'
                  : 'border-2 border-blue-200/80 bg-blue-50/60 text-blue-900 hover:border-blue-400 hover:bg-blue-100/70 hover:shadow-xs dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50',
              )}
            >
              <LayoutDashboard className={cn('h-3.5 w-3.5', activeTab === 'dashboard' ? 'text-white' : 'text-blue-600 dark:text-blue-400')} />
              <span>Dashboard / Operaciones</span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', activeTab === 'dashboard' ? 'bg-blue-700 text-white' : 'bg-blue-200/90 text-blue-950 dark:bg-blue-900 dark:text-blue-200')}>
                {dashboardCount}
              </span>
            </button>

            {/* 2. Admin / Gestión (Violeta) */}
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-sm border-2 border-purple-600 ring-2 ring-purple-400/30'
                  : 'border-2 border-purple-200/80 bg-purple-50/60 text-purple-900 hover:border-purple-400 hover:bg-purple-100/70 hover:shadow-xs dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200 dark:hover:bg-purple-900/50',
              )}
            >
              <ShieldCheck className={cn('h-3.5 w-3.5', activeTab === 'admin' ? 'text-white' : 'text-purple-600 dark:text-purple-400')} />
              <span>Admin / Gestión</span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', activeTab === 'admin' ? 'bg-purple-700 text-white' : 'bg-purple-200/90 text-purple-950 dark:bg-purple-900 dark:text-purple-200')}>
                {adminCount}
              </span>
            </button>

            {/* 3. Inicio por Rubro (Ámbar) */}
            <button
              type="button"
              onClick={() => setActiveTab('rubro')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'rubro'
                  ? 'bg-amber-500 text-white shadow-sm border-2 border-amber-500 ring-2 ring-amber-400/30'
                  : 'border-2 border-amber-200/80 bg-amber-50/60 text-amber-900 hover:border-amber-400 hover:bg-amber-100/70 hover:shadow-xs dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50',
              )}
            >
              <Store className={cn('h-3.5 w-3.5', activeTab === 'rubro' ? 'text-white' : 'text-amber-600 dark:text-amber-400')} />
              <span>Inicio por Rubro</span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', activeTab === 'rubro' ? 'bg-amber-600 text-white' : 'bg-amber-200/90 text-amber-950 dark:bg-amber-900 dark:text-amber-200')}>
                Guía
              </span>
            </button>

            {/* 4. Primeros pasos (Esmeralda) */}
            <button
              type="button"
              onClick={() => setActiveTab('first-steps')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'first-steps'
                  ? 'bg-emerald-600 text-white shadow-sm border-2 border-emerald-600 ring-2 ring-emerald-400/30'
                  : 'border-2 border-emerald-200/80 bg-emerald-50/60 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100/70 hover:shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50',
              )}
            >
              <span>🚀 Primeros pasos</span>
            </button>

            {/* 5. Todos (Neutro) */}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm border-2 border-slate-800 ring-2 ring-slate-400/30'
                  : 'border-2 border-border/80 bg-background text-foreground hover:border-border hover:bg-muted hover:shadow-xs',
              )}
            >
              <span>Todos</span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', activeTab === 'all' ? 'bg-slate-900 text-white' : 'bg-muted text-foreground')}>
                {available.length}
              </span>
            </button>

            {/* 6. Preguntas Frecuentes (Cian/Sky) */}
            {faqCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('faq')}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:justify-start shadow-2xs active:scale-95',
                  activeTab === 'faq'
                    ? 'bg-sky-600 text-white shadow-sm border-2 border-sky-600 ring-2 ring-sky-400/30'
                    : 'border-2 border-sky-200/80 bg-sky-50/60 text-sky-900 hover:border-sky-400 hover:bg-sky-100/70 hover:shadow-xs dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50',
                )}
              >
                <span>Preguntas Frecuentes</span>
                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', activeTab === 'faq' ? 'bg-sky-700 text-white' : 'bg-sky-200/90 text-sky-950 dark:bg-sky-900 dark:text-sky-200')}>
                  {faqCount}
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* ── Barra de Utilidades: Progreso de lectura y Acordeones ── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Progreso: <strong className="font-semibold text-foreground">{readPercent}% leído</strong></span>
            {readSections.length > 0 && (
              <button
                type="button"
                onClick={resetReadProgress}
                className="text-[11px] text-muted-foreground hover:text-foreground"
                title="Reiniciar progreso"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>

          {(searching || (activeTab !== 'first-steps' && activeTab !== 'faq' && activeTab !== 'rubro' && activeTab !== 'summary')) && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronsDown className="mr-1 h-3.5 w-3.5" />
                Expandir todo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronsUp className="mr-1 h-3.5 w-3.5" />
                Colapsar
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ── SECCIÓN 1: DASHBOARD / OPERACIONES ── */}
      {activeTab === 'dashboard' && !searching && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200/80 border-l-4 border-l-blue-600 bg-blue-50/70 p-4 shadow-xs dark:border-blue-900/60 dark:bg-blue-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100/90 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    <LayoutDashboard className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    DASHBOARD &bull; OPERACIONES
                  </span>
                  <span className="text-xs text-blue-700/80 dark:text-blue-300">Mostrador y Salón</span>
                </div>
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  Operaciones Diarias (Mostrador y Salón)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Registrar ventas en el punto de venta (POS), abrir y cerrar cajas, controlar stock y atender clientes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard/pos"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <span>Punto de Venta POS</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/dashboard/pos/caja"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border-2 border-blue-200/90 bg-background px-3 text-xs font-bold text-foreground shadow-2xs hover:border-blue-400 hover:bg-blue-100/60 active:scale-95 transition-all dark:border-blue-800/80 dark:hover:bg-blue-950/50"
                >
                  <span>Cajas del Día</span>
                </Link>
                <Link
                  href="/dashboard/products"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border-2 border-blue-200/90 bg-background px-3 text-xs font-bold text-foreground shadow-2xs hover:border-blue-400 hover:bg-blue-100/60 active:scale-95 transition-all dark:border-blue-800/80 dark:hover:bg-blue-950/50"
                >
                  <span>Catálogo</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 2: ADMIN / GESTIÓN ── */}
      {activeTab === 'admin' && !searching && (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-200/80 border-l-4 border-l-purple-600 bg-purple-50/70 p-4 shadow-xs dark:border-purple-900/60 dark:bg-purple-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100/90 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:border-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
                    <ShieldCheck className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    ADMIN &bull; GESTIÓN
                  </span>
                  <span className="text-xs text-purple-700/80 dark:text-purple-300">Dueño y Administración</span>
                </div>
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  Panel de Administración y Control
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Para el dueño o administrador: configurar equipo, sucursales, controlar finanzas, tienda pública y seguridad.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/users"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 active:scale-95 transition-all"
                >
                  <span>Equipo</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/admin/finances"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border-2 border-purple-200/90 bg-background px-3 text-xs font-bold text-foreground shadow-2xs hover:border-purple-400 hover:bg-purple-100/60 active:scale-95 transition-all dark:border-purple-800/80 dark:hover:bg-purple-950/50"
                >
                  <span>Finanzas</span>
                </Link>
                <Link
                  href="/admin/website"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border-2 border-purple-200/90 bg-background px-3 text-xs font-bold text-foreground shadow-2xs hover:border-purple-400 hover:bg-purple-100/60 active:scale-95 transition-all dark:border-purple-800/80 dark:hover:bg-purple-950/50"
                >
                  <span>Tienda Web</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 3: INICIO POR RUBRO (RECOMENDACIONES) ── */}
      {activeTab === 'rubro' && !searching ? (
        <div className="space-y-6">
          {/* Tarjeta de encabezado del rubro */}
          <div className="rounded-xl border border-amber-200/80 border-l-4 border-l-amber-500 bg-amber-50/50 p-5 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600">{verticalRec.badge}</Badge>
                  <span className="text-xs text-muted-foreground">• Rubro seleccionado</span>
                </div>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">{verticalRec.title}</h2>
                <p className="text-xs font-medium text-primary sm:text-sm">{verticalRec.subtitle}</p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {verticalRec.description}
                </p>
              </div>

              {/* Botones de cambio rápido de rubro */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card p-1.5">
                {VERTICAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedVertical(opt.id)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      selectedVertical === opt.id
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="mr-1">{opt.icon}</span>
                    {opt.label.split('/')[0].trim()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plan de Inicio en 4 pasos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground sm:text-base">
                Plan de Inicio: 4 pasos para poner a punto {verticalRec.title}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {verticalRec.startingSteps.map((step) => (
                <div key={step.step} className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {step.step}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {step.description}
                    </p>
                  </div>
                  <div className="mt-3.5 pt-1">
                    <Link
                      href={step.actionHref}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{step.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rutina Diaria */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground sm:text-base">
                Rutina Diaria Recomendada para {verticalRec.title}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Sunrise className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">1. Apertura</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.opening}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">2. Mostrador</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.sales}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <Sun className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">3. Mediodía</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.midday}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <Sunset className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">4. Cierre</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.closing}
                </p>
              </div>
            </div>
          </div>

          {/* Errores comunes + Consejo Pro */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold">Errores a evitar en tu rubro</h4>
              </div>
              <ul className="mt-2.5 space-y-2 text-xs leading-relaxed">
                {verticalRec.pitfallsToAvoid.map((pit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-amber-600">•</span>
                    <span>{pit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-bold">Consejo de Oro para vender más</h4>
                </div>
                <p className="mt-2 text-xs leading-relaxed sm:text-sm">
                  {verticalRec.proTip}
                </p>
              </div>
              <div className="mt-3.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('dashboard')}
                  className="h-8 gap-1.5 border-emerald-400 bg-transparent text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300"
                >
                  <span>Explorar Operaciones Diarias</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Primeros Pasos ── */}
      {(activeTab === 'all' || activeTab === 'first-steps' || activeTab === 'summary') && !searching && (
        <FirstStepsPanel vertical={selectedVertical} />
      )}

      {/* ── Estado de búsqueda ── */}
      {searching && (
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-2.5 text-sm" role="status">
          <span className="text-muted-foreground">
            {results.length === 0
              ? 'No hay nada con esas palabras. Probá con «caja», «stock» o «publicar».'
              : `${results.length} ${results.length === 1 ? 'sección encontrada' : 'secciones encontradas'} con «${query.trim()}»`}
          </span>
          {results.length > 0 && (
            <span className="text-xs text-muted-foreground">Coincidencias resaltadas</span>
          )}
        </div>
      )}

      {/* ── FAQ Hub ── */}
      {activeTab === 'faq' ? (
        <section className="space-y-4">
          <div className="border-b border-border/70 pb-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Preguntas Frecuentes</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Respuestas rápidas a las dudas comunes de configuración y uso diario del sistema.
            </p>
          </div>

          <div className="space-y-2.5">
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
      ) : activeTab === 'summary' && !searching ? (
        /* ── VISTA RESUMEN DEL SISTEMA (INTUITIVA Y LIMPIA) ── */
        <section className="space-y-6">
          {/* Encabezado descriptivo del Resumen */}
          <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutDashboard className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                Resumen Operativo y Estructura del Sistema
              </h2>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Tu plataforma está organizada en dos grandes mundos diseñados para roles distintos:{' '}
              <strong className="text-blue-600 dark:text-blue-400">Operaciones Diarias</strong> (caja y mostrador) y{' '}
              <strong className="text-purple-600 dark:text-purple-400">Panel de Administración</strong> (gestión del negocio).
            </p>
          </div>

          {/* Grid de los 2 Pilares Principales */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* TARJETA 1: DASHBOARD / OPERACIONES */}
            <div className="flex flex-col justify-between rounded-2xl border border-blue-200/90 border-l-4 border-l-blue-600 bg-gradient-to-b from-blue-50/60 via-card to-card p-5 sm:p-6 shadow-xs dark:border-blue-900/60 dark:from-blue-950/25">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100/90 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-900/70 dark:text-blue-200">
                    <LayoutDashboard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    OPERACIONES • MOSTRADOR Y SALÓN
                  </span>
                  <Badge variant="secondary" className="border-blue-200 bg-blue-100/60 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs font-semibold">
                    {dashboardCount} {dashboardCount === 1 ? 'módulo' : 'módulos'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg">
                    Operaciones Diarias de tu Negocio
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Para cajeros, vendedores, personal de salón y técnicos. Todo lo necesario para vender en el día a día sin demoras:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Cobros rápidos en el POS con lector de código de barras o búsqueda.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Apertura, arqueos ciegos y cierre diario de caja.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Control de stock en tiempo real y alertas de productos bajos.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Fichas de clientes, historial de compras y cuentas corrientes.</span>
                    </li>
                  </ul>
                </div>

                {/* Módulos de Operaciones disponibles */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Módulos activos en tu cuenta:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dashboardSections.map((s) => {
                      const Icon = iconFor(s)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveTab('dashboard')
                            setExpandedMap({ [s.id]: true })
                          }}
                          className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-blue-200/90 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-2xs transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-50/80 hover:shadow-xs active:translate-y-0 active:scale-95 dark:border-blue-800/80 dark:hover:border-blue-400 dark:hover:bg-blue-950/50"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span>{s.title}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4 dark:border-blue-900/60">
                <Button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="h-9 gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow active:scale-95 transition-all"
                >
                  <span>Ver Guía de Operaciones</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href="/dashboard/pos"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-blue-300 bg-white px-3.5 text-xs font-bold text-blue-800 shadow-2xs transition-all hover:border-blue-500 hover:bg-blue-50 active:scale-95 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/50"
                >
                  <span>Ir al Punto de Venta (POS)</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* TARJETA 2: ADMIN / GESTIÓN */}
            <div className="flex flex-col justify-between rounded-2xl border border-purple-200/90 border-l-4 border-l-purple-600 bg-gradient-to-b from-purple-50/60 via-card to-card p-5 sm:p-6 shadow-xs dark:border-purple-900/60 dark:from-purple-950/25">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-100/90 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 dark:border-purple-800 dark:bg-purple-900/70 dark:text-purple-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    ADMINISTRACIÓN • GESTIÓN Y CONTROL
                  </span>
                  <Badge variant="secondary" className="border-purple-200 bg-purple-100/60 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200 text-xs font-semibold">
                    {adminCount} {adminCount === 1 ? 'módulo' : 'módulos'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg">
                    Panel de Control y Administración
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Para dueños, socios, administradores y contadores. Configuración estratégica, seguridad y rentabilidad del negocio:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                      <span>Invitación de equipo y permisos seguros por rol (vendedor, técnico, admin).</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                      <span>Gestión de sucursales, depósitos e impresoras fiscales.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                      <span>Control de finanzas, egresos, rentabilidad y auditoría.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                      <span>Publicación de catálogo en la tienda online y Marketplace.</span>
                    </li>
                  </ul>
                </div>

                {/* Módulos de Administración disponibles */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Módulos activos en tu cuenta:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {adminSections.map((s) => {
                      const Icon = iconFor(s)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveTab('admin')
                            setExpandedMap({ [s.id]: true })
                          }}
                          className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-purple-200/90 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-2xs transition-all hover:-translate-y-0.5 hover:border-purple-500 hover:bg-purple-50/80 hover:shadow-xs active:translate-y-0 active:scale-95 dark:border-purple-800/80 dark:hover:border-purple-400 dark:hover:bg-purple-950/50"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span>{s.title}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-600" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-purple-100 pt-4 dark:border-purple-900/60">
                <Button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="h-9 gap-2 rounded-xl bg-purple-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-purple-700 hover:shadow active:scale-95 transition-all"
                >
                  <span>Ver Guía de Administración</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href="/admin/users"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-purple-300 bg-white px-3.5 text-xs font-bold text-purple-800 shadow-2xs transition-all hover:border-purple-500 hover:bg-purple-50 active:scale-95 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-200 dark:hover:bg-purple-900/50"
                >
                  <span>Ir a Equipo y Usuarios</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Fila Inferior: Estrategia por Rubro + Dudas Frecuentes */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Tarjeta Rubro */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-200/90 border-l-4 border-l-amber-500 bg-gradient-to-b from-amber-50/50 via-card to-card p-5 shadow-xs dark:border-amber-900/50 dark:from-amber-950/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    RECOMENDACIONES POR RUBRO
                  </span>
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px]">
                    {verticalRec.badge}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-base font-bold text-foreground sm:text-lg">
                    Plan Recomendado para {verticalRec.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm line-clamp-2">
                    {verticalRec.description}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {verticalRec.startingSteps.slice(0, 2).map((step) => (
                    <div key={step.step} className="flex items-center gap-2.5 text-xs text-foreground">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                        {step.step}
                      </span>
                      <span className="truncate font-medium">{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-amber-100 pt-3 dark:border-amber-900/60">
                <Button
                  type="button"
                  onClick={() => setActiveTab('rubro')}
                  className="h-9 gap-2 rounded-xl border-2 border-amber-400/90 bg-amber-100 px-4 text-xs font-bold text-amber-950 shadow-2xs hover:border-amber-500 hover:bg-amber-200/80 active:scale-95 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 transition-all"
                >
                  <span>Ver Estrategia Completa de tu Rubro</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Tarjeta Preguntas Frecuentes */}
            <div className="flex flex-col justify-between rounded-2xl border border-sky-200/90 border-l-4 border-l-sky-500 bg-gradient-to-b from-sky-50/50 via-card to-card p-5 shadow-xs dark:border-sky-900/50 dark:from-sky-950/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/90 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-900/70 dark:text-sky-200">
                    <HelpCircle className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    DUDAS MÁS HABITUALES
                  </span>
                  <Badge variant="secondary" className="border-sky-200 bg-sky-100/60 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200 text-xs font-semibold">
                    {faqCount} dudas resueltas
                  </Badge>
                </div>

                <div>
                  <h4 className="text-base font-bold text-foreground sm:text-lg">
                    Respuestas Rápidas para Empezar
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Soluciones inmediatas a las dudas frecuentes de configuración y uso:
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {allFaqs.slice(0, 3).map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveTab('faq')
                        setQuery(f.question)
                      }}
                      className="group flex cursor-pointer w-full items-center justify-between gap-2 rounded-xl border-2 border-sky-200/80 bg-white p-2.5 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-sky-400 hover:bg-sky-50/80 active:scale-[0.99] dark:border-sky-900/80 dark:bg-card dark:hover:bg-sky-950/50"
                    >
                      <span className="line-clamp-1 text-left">{f.question}</span>
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-sky-600 transition-transform group-hover:translate-x-0.5 dark:text-sky-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-sky-100 pt-3 dark:border-sky-900/60">
                <Button
                  type="button"
                  onClick={() => setActiveTab('faq')}
                  className="h-9 gap-2 rounded-xl border-2 border-sky-400/90 bg-sky-100 px-4 text-xs font-bold text-sky-950 shadow-2xs hover:border-sky-500 hover:bg-sky-200/80 active:scale-95 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 transition-all"
                >
                  <span>Ver Todas las Preguntas ({faqCount})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Banner inferior para explorar manual exhaustivo */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border-2 border-border/80 bg-muted/30 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground sm:text-sm">
                  ¿Querés leer el manual completo módulo por módulo?
                </p>
                <p className="text-xs text-muted-foreground">
                  Explorá todas las secciones con sus pasos detallados, ejemplos reales y buenas prácticas.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setActiveTab('all')}
              className="h-9 gap-2 rounded-xl border-2 border-border/90 bg-background px-4 text-xs font-bold text-foreground shadow-xs hover:border-primary hover:bg-accent active:scale-95 transition-all self-start sm:self-auto"
            >
              <span>Explorar Guía Completa ({available.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      ) : activeTab !== 'rubro' ? (
        /* ── Lista de Secciones ── */
        groups.map((group) => {
          const theme = GROUP_HEADER_THEMES[group.id]
          const HeaderIcon = theme?.icon

          return (
            <section key={group.id} id={`guia-grupo-${group.id}`} className="space-y-3 scroll-mt-20">
              <div className={cn('border-b border-border/60 pb-2.5 pt-1', theme?.borderClass)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {HeaderIcon && <HeaderIcon className="h-4 w-4 text-muted-foreground" aria-hidden />}
                    <h2 className={cn('text-base font-bold tracking-tight text-foreground sm:text-lg', theme?.titleClass)}>
                      {group.label}
                    </h2>
                    {theme && (
                      <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide', theme.badgeClass)}>
                        {theme.badge}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {group.sections.length} {group.sections.length === 1 ? 'sección' : 'secciones'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{group.description}</p>
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
          )
        })
      ) : null}
    </div>
  )
}
