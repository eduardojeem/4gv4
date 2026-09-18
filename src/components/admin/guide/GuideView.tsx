'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Monitor,
  Package,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Users,
  Wrench,
  X,
  type LucideIcon,
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

// Secciones que corresponden al ámbito Operativo / Dashboard (día a día)
const DASHBOARD_SECTION_IDS = ['cash-monitor', 'inventory', 'reports']

function iconFor(section: GuideSection): LucideIcon {
  if (section.navKey) {
    const item = getNavItemByKey(section.navKey)
    if (item) return item.icon
  }
  return CONCEPT_ICONS[section.id] ?? Sparkles
}

export type MainGuideTab = 'all' | 'dashboard' | 'admin' | 'rubro' | 'first-steps' | 'faq'

export function GuideView() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<MainGuideTab>('all')
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

  // Atajos de teclado: '/' para buscar, 'Esc' para limpiar
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

  // Filtrado según módulos del plan y permisos
  const available = useMemo(
    () => filterGuideSections(GUIDE_SECTIONS, { hasPermission, isAdmin, modules: effectiveModules }),
    [hasPermission, isAdmin, effectiveModules],
  )

  const results = useMemo(() => searchGuideSections(available, query), [available, query])
  const searching = query.trim().length > 0

  // Separación por ámbito: Dashboard (Día a día) vs Admin (Gestión/Control)
  const dashboardSections = useMemo(
    () => results.filter((s) => DASHBOARD_SECTION_IDS.includes(s.id)),
    [results],
  )

  const adminSections = useMemo(
    () => results.filter((s) => !DASHBOARD_SECTION_IDS.includes(s.id)),
    [results],
  )

  // Conteos para los botones
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

  // Secciones a mostrar según la pestaña activa
  const visibleSections = useMemo(() => {
    if (activeTab === 'dashboard') return dashboardSections
    if (activeTab === 'admin') return adminSections
    return results
  }, [activeTab, dashboardSections, adminSections, results])

  // Agrupamiento de secciones visibles
  const groups = useMemo(
    () =>
      GUIDE_GROUPS.map((group) => ({
        ...group,
        sections: visibleSections.filter((section) => section.group === group.id),
      })).filter((group) => group.sections.length > 0),
    [visibleSections],
  )

  // Recomendaciones específicas para el rubro seleccionado
  const verticalRec: VerticalRecommendation = useMemo(() => {
    return getVerticalRecommendation(selectedVertical)
  }, [selectedVertical])

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
            {/* Selector de Rubro */}
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

        {/* ── Buscador ── */}
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

        {/* ── Las 3 Secciones Principales solicitadas + Pestañas de Apoyo ── */}
        <div className="flex flex-col gap-2.5 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Temas de la guía" className="flex flex-wrap items-center gap-1.5">
            {/* 1. Dashboard / Operaciones */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'dashboard'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Dashboard / Operaciones</span>
              <span className={cn('rounded px-1 text-[10px] tabular-nums', activeTab === 'dashboard' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {dashboardCount}
              </span>
            </button>

            {/* 2. Admin / Gestión */}
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'admin'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin / Gestión</span>
              <span className={cn('rounded px-1 text-[10px] tabular-nums', activeTab === 'admin' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {adminCount}
              </span>
            </button>

            {/* 3. Inicio por Rubro */}
            <button
              type="button"
              onClick={() => setActiveTab('rubro')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeTab === 'rubro'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Store className="h-3.5 w-3.5" />
              <span>Inicio por Rubro</span>
              <Badge variant="secondary" className="h-4 border-transparent bg-amber-100 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Guía a medida
              </Badge>
            </button>

            {/* Todos los temas */}
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
                {available.length}
              </span>
            </button>

            {/* Primeros pasos */}
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

            {/* FAQ */}
            {faqCount > 0 && (
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
                  {faqCount}
                </span>
              </button>
            )}
          </nav>

          {/* Mini lectura y controles */}
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{readPercent}% leído</span>
              {readSections.length > 0 && (
                <button
                  type="button"
                  onClick={resetReadProgress}
                  className="text-muted-foreground hover:text-foreground"
                  title="Reiniciar progreso"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>

            {activeTab !== 'first-steps' && activeTab !== 'faq' && activeTab !== 'rubro' && (
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
      </header>

      {/* ── Banner contextual según sección activa ── */}
      {activeTab === 'dashboard' && !searching && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  Panel de Operaciones (El día a día del negocio)
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Acá trabajan cajeros, vendedores y encargados: registrar ventas en el punto de venta (POS), abrir y cerrar caja, controlar stock y pedidos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/pos"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <span>Abrir POS</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/dashboard/products"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-xs"
              >
                <span>Catálogo</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && !searching && (
        <div className="rounded-2xl border border-border bg-muted/20 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  Panel de Administración (Gestión, Equipo y Control)
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Herramientas del propietario y administradores: invitar colaboradores con roles, ver finanzas y gastos, sucursales, tienda web, seguridad y reportes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-xs"
              >
                <span>Equipo</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/admin/finances"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-xs"
              >
                <span>Finanzas</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/admin/website"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-xs"
              >
                <span>Tienda Web</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. VISTA DEDICADA: INICIO POR RUBRO Y RECOMENDACIONES ── */}
      {activeTab === 'rubro' && !searching ? (
        <div className="space-y-6">
          {/* Tarjeta de encabezado del rubro */}
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">{verticalRec.badge}</Badge>
                  <span className="text-xs text-muted-foreground">• Rubro seleccionado</span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-foreground sm:text-xl">{verticalRec.title}</h2>
                <p className="mt-0.5 text-xs font-medium text-primary sm:text-sm">{verticalRec.subtitle}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {verticalRec.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-card p-2">
                <span className="text-xs font-medium text-muted-foreground">Cambiar rubro:</span>
                <div className="flex flex-wrap gap-1">
                  {VERTICAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedVertical(opt.id)}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                        selectedVertical === opt.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fase 1: Cómo empezar a usar el sistema en tu rubro */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-bold text-foreground">
                Plan de Inicio: 4 pasos para poner a punto {verticalRec.title}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {verticalRec.startingSteps.map((step) => (
                <div key={step.step} className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {step.step}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {step.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-2">
                    <Link
                      href={step.actionHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{step.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fase 2: Rutina diaria recomendada */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Rutina Diaria Recomendada para {verticalRec.title}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Sunrise className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">1. Apertura</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.opening}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">2. Mostrador & Ventas</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.sales}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <Sun className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">3. Control Mediodía</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.midday}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Sunset className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">4. Cierre & Arqueo</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {verticalRec.dailyRoutine.closing}
                </p>
              </div>
            </div>
          </div>

          {/* Fase 3: Configuraciones clave del sistema para este rubro */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Configuraciones Clave en el Sistema
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {verticalRec.keySettings.map((sett) => (
                <div key={sett.title} className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{sett.title}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {sett.reason}
                    </p>
                  </div>
                  <div className="mt-3 pt-2">
                    <Link
                      href={sett.href}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Abrir módulo</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fase 4: Errores comunes a evitar y Consejo Pro */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold">Errores comunes a evitar en tu rubro</h4>
              </div>
              <ul className="mt-2.5 space-y-2 pl-2 text-xs leading-relaxed">
                {verticalRec.pitfallsToAvoid.map((pit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-amber-600">•</span>
                    <span>{pit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold">Consejo de Oro para vender más</h4>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed sm:text-sm">
                {verticalRec.proTip}
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('dashboard')}
                  className="h-8 gap-1 border-emerald-400 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300"
                >
                  <span>Explorar Operaciones</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
            <span className="text-xs text-muted-foreground">Coincidencias resaltadas</span>
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
      ) : activeTab !== 'rubro' ? (
        /* ── Lista de Secciones (según ámbito activo: Todos, Dashboard o Admin) ── */
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
      ) : null}
    </div>
  )
}
