'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ChevronRight, Home, LayoutGrid, List, RefreshCw, UserPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TechnicianCard } from '@/components/dashboard/technicians/TechnicianCard'
import { TechnicianFilters } from '@/components/dashboard/technicians/TechnicianFilters'
import { TechnicianListItem } from '@/components/dashboard/technicians/TechnicianListItem'
import { TechnicianStatsGrid } from '@/components/dashboard/technicians/TechnicianStatsGrid'
import { useBranch } from '@/contexts/branch-context'
import { useDebounce } from '@/hooks/use-debounce'
import { useTechnicianStats } from '@/hooks/use-technician-stats'

export default function TechniciansPage() {
  const router = useRouter()
  const { selectedBranch } = useBranch()
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
    const avgCompletionDays =
      technicianData.length > 0
        ? technicianData.reduce((sum, tech) => sum + tech.avgCompletionDays, 0) / technicianData.length
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
      avgCompletionTime: avgCompletionDays > 0 ? `${avgCompletionDays.toFixed(1)} dias` : undefined,
      topCloserName: topCloser?.name,
    }
  }, [technicianData])

  const showErrorState = !isLoading && !!error && technicianData.length === 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-3 w-3" />
        <span>Reparaciones</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Tecnicos</span>
      </div>

      <div>
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/repairs')}
          className="-ml-2 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Reparaciones
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Tecnicos
          </h1>
          <p className="mt-1 text-muted-foreground">
            Mira la carga real de trabajo de cada tecnico y entra a su detalle con un clic.
          </p>
          {selectedBranch?.name && (
            <div className="mt-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Sucursal actual: {selectedBranch.name}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            title="Actualizar"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button className="gap-2" onClick={handleAddTechnician}>
            <UserPlus className="h-4 w-4" />
            Agregar Tecnico
          </Button>
        </div>
      </div>

      <TechnicianStatsGrid {...overallStats} />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <TechnicianFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />

        <div className="flex items-center gap-2 rounded-lg border p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            aria-label="Cambiar a vista de grilla"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            title="Vista de grilla"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            aria-label="Cambiar a vista de lista"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            title="Vista de lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar datos</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando tecnicos...</p>
          </div>
        </div>
      ) : showErrorState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold">No pudimos cargar los tecnicos</h3>
            <p className="text-sm text-muted-foreground">
              Revisa la conexion o la configuracion de datos y vuelve a intentarlo.
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      ) : filteredTechnicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No hay tecnicos para mostrar</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchTerm || statusFilter !== 'all'
                ? 'No se encontraron resultados con los filtros aplicados.'
                : selectedBranch?.name
                  ? `Todavia no hay tecnicos asignados a ${selectedBranch.name}.`
                  : 'Comienza agregando tecnicos a tu equipo.'}
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTechnicians.map((tech) => (
            <TechnicianCard key={tech.id} {...tech} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="hidden border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(220px,1.2fr)_auto] md:items-center md:gap-4">
            <span>Tecnico</span>
            <span>Rendimiento</span>
            <span>Carga</span>
            <span className="text-right">Accion</span>
          </div>
          <div className="divide-y">
            {filteredTechnicians.map((tech) => (
              <TechnicianListItem key={tech.id} {...tech} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
