'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Home,
  LayoutGrid,
  List,
  RefreshCw,
  RotateCcw,
  UserPlus,
  Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpButton } from '@/components/help/HelpButton'
import { TechnicianCard } from '@/components/dashboard/technicians/TechnicianCard'
import { TechnicianFilters } from '@/components/dashboard/technicians/TechnicianFilters'
import { TechnicianListItem } from '@/components/dashboard/technicians/TechnicianListItem'
import { TechnicianStatsGrid } from '@/components/dashboard/technicians/TechnicianStatsGrid'
import { useBranch } from '@/contexts/branch-context'
import { useAuth } from '@/contexts/auth-context'
import { useDebounce } from '@/hooks/use-debounce'
import { useTechnicianStats } from '@/hooks/use-technician-stats'

function LoadingSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <div className="pt-3 border-t border-border/40 flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingSkeletonList() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/30 p-2 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-36 rounded-md hidden md:block" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default function TechniciansPage() {
  const router = useRouter()
  const { selectedBranch } = useBranch()
  const { hasPermission } = useAuth()
  const canManageUsers = hasPermission('users.manage')
  const { technicians: technicianData, isLoading, error, refresh } = useTechnicianStats()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const debouncedSearch = useDebounce(searchTerm, 300)

  const handleAddTechnician = useCallback(() => {
    router.push('/admin/users')
  }, [router])

  const handleRefresh = useCallback(async () => {
    await refresh()
  }, [refresh])

  const handleResetFilters = useCallback(() => {
    setSearchTerm('')
    setStatusFilter('all')
    setSortBy('name')
  }, [])

  // Conteo rápido por categoría para los chips
  const statusCounts = useMemo(() => {
    return {
      all: technicianData.length,
      no_load: technicianData.filter((tech) => tech.loadState === 'no_load').length,
      active_load: technicianData.filter(
        (tech) => tech.loadState === 'light_load' || tech.loadState === 'medium_load',
      ).length,
      high_load: technicianData.filter((tech) => tech.loadState === 'high_load').length,
    }
  }, [technicianData])

  const filteredTechnicians = useMemo(() => {
    let filtered = [...technicianData]

    if (debouncedSearch) {
      const normalizedSearch = debouncedSearch.toLowerCase().trim()
      filtered = filtered.filter(
        (tech) =>
          tech.name.toLowerCase().includes(normalizedSearch) ||
          (tech.specialty && tech.specialty.toLowerCase().includes(normalizedSearch)),
      )
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active_load') {
        filtered = filtered.filter(
          (tech) => tech.loadState === 'light_load' || tech.loadState === 'medium_load',
        )
      } else {
        filtered = filtered.filter((tech) => tech.loadState === statusFilter)
      }
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'activeJobs':
          return b.activeJobs - a.activeJobs
        case 'completedThisMonth':
          return b.completedThisMonth - a.completedThisMonth
        case 'totalCompleted':
          return b.totalCompleted - a.totalCompleted
        case 'workload':
          return b.workloadPercentage - a.workloadPercentage
        default:
          return 0
      }
    })

    return filtered
  }, [debouncedSearch, sortBy, statusFilter, technicianData])

  const overallStats = useMemo(() => {
    const total = technicianData.length
    const techniciansWithoutLoad = technicianData.filter((tech) => tech.loadState === 'no_load').length
    const highLoadTechnicians = technicianData.filter((tech) => tech.loadState === 'high_load').length
    const totalActiveJobs = technicianData.reduce((sum, tech) => sum + tech.activeJobs, 0)
    const avgJobsPerTech = total > 0 ? totalActiveJobs / total : 0

    const techsWithCompletions = technicianData.filter((tech) => tech.avgCompletionDays > 0)
    const avgCompletionDays =
      techsWithCompletions.length > 0
        ? techsWithCompletions.reduce((sum, tech) => sum + tech.avgCompletionDays, 0) /
          techsWithCompletions.length
        : 0

    const topCloser = technicianData.reduce((best, current) => {
      if (current.completedThisMonth === 0) return best
      return !best || current.completedThisMonth > best.completedThisMonth ? current : best
    }, undefined as (typeof technicianData)[number] | undefined)

    return {
      totalTechnicians: total,
      techniciansWithoutLoad,
      highLoadTechnicians,
      totalActiveJobs,
      avgJobsPerTech,
      avgCompletionTime: avgCompletionDays > 0 ? `${avgCompletionDays.toFixed(1)} días` : undefined,
      topCloserName: topCloser?.name,
    }
  }, [technicianData])

  const showErrorState = !isLoading && !!error && technicianData.length === 0
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all'

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <nav aria-label="Navegación" className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Inicio</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <Link
          href="/dashboard/repairs"
          className="hover:text-primary transition-colors"
        >
          Reparaciones
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-foreground font-semibold">Técnicos</span>
      </nav>

      {/* Header Section */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-border/60 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Rendimiento de Técnicos
                </h1>
                {selectedBranch?.name && (
                  <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 text-xs border-primary/25 bg-primary/5 text-primary">
                    <Building2 className="h-3 w-3" />
                    <span>{selectedBranch.name}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Supervisa la disponibilidad operativa, balancea las órdenes de reparación y analiza la eficiencia en tiempo real de tu equipo técnico.
          </p>

          {selectedBranch?.name && (
            <div className="sm:hidden pt-1">
              <Badge variant="outline" className="inline-flex items-center gap-1 text-xs border-primary/25 bg-primary/5 text-primary">
                <Building2 className="h-3 w-3" />
                <span>Sucursal: {selectedBranch.name}</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Actualizar datos"
            disabled={isLoading}
            className="h-9 gap-1.5 border-border/70 hover:bg-muted text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoading ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          <HelpButton guideKey="technicians" variant="outline" className="h-9 border-border/70 text-xs" />

          {canManageUsers && (
            <Button
              size="sm"
              onClick={handleAddTechnician}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>Agregar Técnico</span>
            </Button>
          )}
        </div>
      </header>

      {/* Stats KPI Overview */}
      <section aria-label="Métricas de rendimiento de técnicos">
        <TechnicianStatsGrid {...overallStats} />
      </section>

      {/* Toolbar & Filters */}
      <section aria-label="Filtros y búsqueda de técnicos" className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-card/60 rounded-2xl border border-border/70 p-4 shadow-xs">
        <div className="flex-1 w-full">
          <TechnicianFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            resultCount={filteredTechnicians.length}
            totalCount={technicianData.length}
            counts={statusCounts}
          />
        </div>

        {/* View mode toggle button */}
        <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0">
          <div className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              aria-label="Vista de cuadrícula"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`h-7 px-2.5 text-xs font-semibold gap-1 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              aria-label="Vista de lista"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`h-7 px-2.5 text-xs font-semibold gap-1 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Error State Banner */}
      {error && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-destructive shadow-xs rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Error de sincronización</AlertTitle>
          <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      <main className="min-h-[350px]">
        {isLoading ? (
          viewMode === 'grid' ? (
            <LoadingSkeletonGrid />
          ) : (
            <LoadingSkeletonList />
          )
        ) : showErrorState ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-lg font-bold text-foreground">Error al cargar la nómina de técnicos</h2>
              <p className="text-xs text-muted-foreground">
                No pudimos recuperar las estadísticas del equipo técnico. Comprueba tu conexión o reintenta la sincronización.
              </p>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 mt-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar sincronización
            </Button>
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 sm:p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Users className="h-7 w-7" />
            </div>

            <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
              {hasActiveFilters ? 'No hay técnicos que coincidan' : 'No hay técnicos registrados'}
            </h2>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mb-5 leading-relaxed">
              {hasActiveFilters
                ? `No se encontraron resultados para los filtros seleccionados (${searchTerm ? `"${searchTerm}"` : ''}${statusFilter !== 'all' ? ` estado: ${statusFilter}` : ''}).`
                : selectedBranch?.name
                ? `Aún no hay técnicos asignados a la sucursal ${selectedBranch.name}.`
                : 'Comienza agregando los primeros miembros al equipo de reparaciones de tu negocio.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button
                  onClick={handleResetFilters}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer filtros
                </Button>
              )}

              {!hasActiveFilters && canManageUsers && (
                <Button
                  onClick={handleAddTechnician}
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                >
                  <UserPlus className="h-4 w-4" />
                  Agregar primer técnico
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTechnicians.map((tech) => (
              <TechnicianCard key={tech.id} {...tech} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
            <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(180px,1.2fr)_auto] md:items-center md:gap-4">
              <span>Colaborador / Especialidad</span>
              <span>Rendimiento Operativo</span>
              <span>Carga de Trabajo</span>
              <span className="text-right">Acción</span>
            </div>
            <div className="divide-y divide-border/40 p-1.5">
              {filteredTechnicians.map((tech) => (
                <TechnicianListItem key={tech.id} {...tech} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
