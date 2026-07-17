'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronRight, Home, LayoutGrid, List, RefreshCw, UserPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HelpButton } from '@/components/help/HelpButton'
import { TechnicianCard } from '@/components/dashboard/technicians/TechnicianCard'
import { TechnicianFilters } from '@/components/dashboard/technicians/TechnicianFilters'
import { TechnicianListItem } from '@/components/dashboard/technicians/TechnicianListItem'
import { TechnicianStatsGrid } from '@/components/dashboard/technicians/TechnicianStatsGrid'
import { useBranch } from '@/contexts/branch-context'
import { useAuth } from '@/contexts/auth-context'
import { useDebounce } from '@/hooks/use-debounce'
import { useTechnicianStats } from '@/hooks/use-technician-stats'

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

  const filteredTechnicians = useMemo(() => {
    let filtered = [...technicianData]

    if (debouncedSearch) {
      const normalizedSearch = debouncedSearch.toLowerCase()
      filtered = filtered.filter((tech) =>
        tech.name.toLowerCase().includes(normalizedSearch) ||
        tech.specialty?.toLowerCase().includes(normalizedSearch)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((tech) => tech.loadState === statusFilter)
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
    // Promediar solo sobre técnicos con cierres reales; los ociosos (0 días)
    // sesgaban el promedio del equipo hacia abajo.
    const techsWithCompletions = technicianData.filter((tech) => tech.avgCompletionDays > 0)
    const avgCompletionDays =
      techsWithCompletions.length > 0
        ? techsWithCompletions.reduce((sum, tech) => sum + tech.avgCompletionDays, 0) / techsWithCompletions.length
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

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 w-full max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80 font-medium">
        <Home
          className="h-4 w-4 cursor-pointer hover:text-primary transition-colors"
          onClick={() => router.push('/dashboard')}
        />
        <ChevronRight className="h-3 w-3" />
        <span
          className="cursor-pointer hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/repairs')}
        >
          Reparaciones
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Técnicos</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div>
          <h1 className="bg-gradient-to-br from-primary via-primary/90 to-primary/50 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-sm mb-2">
            Rendimiento de Técnicos
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
            Monitorea la carga operativa de tu equipo, balancea el trabajo y analiza la eficiencia en tiempo real.
          </p>
          {selectedBranch?.name && (
            <div className="mt-4">
              <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background/50 backdrop-blur-md border-primary/20 text-primary shadow-sm">
                Sucursal activa: <strong className="ml-1 font-bold">{selectedBranch.name}</strong>
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            title="Actualizar datos"
            disabled={isLoading}
            className="rounded-full h-10 w-10 border-border/50 bg-background/50 backdrop-blur-md hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </Button>
          <HelpButton guideKey="technicians" variant="outline" className="rounded-full h-10 w-10 border-border/50 bg-background/50 backdrop-blur-md hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm" />
          {canManageUsers && (
            <Button className="gap-2 rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5" onClick={handleAddTechnician}>
              <UserPlus className="h-4 w-4" />
              <span className="font-semibold">Agregar Técnico</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 blur-2xl -z-10 rounded-3xl" />
        <TechnicianStatsGrid {...overallStats} />
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <TechnicianFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          resultCount={filteredTechnicians.length}
          totalCount={technicianData.length}
        />

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/50 backdrop-blur-md p-1 shadow-sm ml-auto shrink-0">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            aria-label="Vista de grilla"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`rounded-lg h-7 w-7 p-0 transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            aria-label="Vista de lista"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`rounded-lg h-7 w-7 p-0 transition-all ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'}`}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 text-destructive shadow-sm rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Error de sincronización</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content Area */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
              <RefreshCw className="relative h-10 w-10 animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando información de técnicos...</p>
          </div>
        ) : showErrorState ? (
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-4 py-16 text-center transition-all">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 shadow-inner">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-bold text-foreground">Error al cargar los datos</h3>
              <p className="text-base text-muted-foreground">
                Revisa la conexión de red o la configuración y vuelve a intentarlo.
              </p>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="gap-2 mt-2 rounded-full border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all">
              <RefreshCw className="h-4 w-4" />
              Reintentar conexión
            </Button>
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-background/30 backdrop-blur-sm px-4 py-16 transition-all hover:bg-background/50 hover:border-border/80">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 shadow-inner">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">No se encontraron técnicos</h3>
              <p className="mb-6 text-base text-muted-foreground">
                {searchTerm || statusFilter !== 'all'
                  ? 'No hay resultados que coincidan con los filtros aplicados en esta vista.'
                  : selectedBranch?.name
                    ? `Aún no hay técnicos asignados a la sucursal ${selectedBranch.name}.`
                    : 'Comienza agregando miembros a tu equipo técnico.'}
              </p>
              {(!searchTerm && statusFilter === 'all' && canManageUsers) && (
                <Button onClick={handleAddTechnician} className="gap-2 rounded-full px-6 shadow-md hover:shadow-lg transition-all">
                  <UserPlus className="h-4 w-4" />
                  Agregar el primer técnico
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            {filteredTechnicians.map((tech) => (
              <TechnicianCard key={tech.id} {...tech} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/50 backdrop-blur-md shadow-sm animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <div className="hidden border-b border-border/40 bg-muted/20 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(180px,1fr)_auto] md:items-center md:gap-4">
              <span>Técnico</span>
              <span>Rendimiento</span>
              <span>Carga operativa</span>
              <span className="text-right">Detalle</span>
            </div>
            <div className="divide-y divide-border/20 p-1">
              {filteredTechnicians.map((tech) => (
                <TechnicianListItem key={tech.id} {...tech} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

