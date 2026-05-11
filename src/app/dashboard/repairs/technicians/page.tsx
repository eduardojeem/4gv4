'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home, ChevronRight, UserPlus, LayoutGrid, List, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { TechnicianStatsGrid } from '@/components/dashboard/technicians/TechnicianStatsGrid'
import { TechnicianFilters } from '@/components/dashboard/technicians/TechnicianFilters'
import { TechnicianCard } from '@/components/dashboard/technicians/TechnicianCard'
import { TechnicianListItem } from '@/components/dashboard/technicians/TechnicianListItem'
import { useTechnicianStats } from '@/hooks/use-technician-stats'
import { useDebounce } from '@/hooks/use-debounce'

export default function TechniciansPage() {
    const router = useRouter()
    const { technicians: technicianData, isLoading, error, refresh } = useTechnicianStats()

    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sortBy, setSortBy] = useState('name')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // Debounce search to avoid recalculating on every keystroke
    const debouncedSearch = useDebounce(searchTerm, 300)

    const handleAddTechnician = useCallback(() => {
        router.push('/admin/users')
    }, [router])

    const handleRefresh = useCallback(async () => {
        await refresh()
    }, [refresh])

    // Filter technicians with debounced search
    const filteredTechnicians = useMemo(() => {
        let filtered = [...technicianData]

        if (debouncedSearch) {
            const normalizedSearch = debouncedSearch.toLowerCase()
            filtered = filtered.filter(tech =>
                tech.name.toLowerCase().includes(normalizedSearch) ||
                tech.specialty?.toLowerCase().includes(normalizedSearch)
            )
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(tech => tech.status === statusFilter)
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
    }, [technicianData, debouncedSearch, statusFilter, sortBy])

    // Calculate overall stats
    const overallStats = useMemo(() => {
        const total = technicianData.length
        const available = technicianData.filter(t => t.status === 'available').length
        const totalActiveJobs = technicianData.reduce((sum, t) => sum + t.activeJobs, 0)
        const avgJobsPerTech = total > 0 ? totalActiveJobs / total : 0
        const avgCompletionDays = technicianData.length > 0
            ? technicianData.reduce((sum, t) => sum + t.avgCompletionDays, 0) / technicianData.length
            : 0

        const bestPerformer = technicianData.reduce((best, current) => {
            if (current.completedThisMonth === 0) return best
            return !best || current.completedThisMonth > best.completedThisMonth ? current : best
        }, undefined as (typeof technicianData)[number] | undefined)

        return {
            totalTechnicians: total,
            availableTechnicians: available,
            totalActiveJobs,
            avgJobsPerTech,
            avgCompletionTime: avgCompletionDays > 0 ? `${avgCompletionDays.toFixed(1)} días` : undefined,
            bestPerformer: bestPerformer?.name
        }
    }, [technicianData])

    const showErrorState = !isLoading && !!error && technicianData.length === 0

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                <ChevronRight className="h-3 w-3" />
                <span>Reparaciones</span>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-foreground">Técnicos</span>
            </div>

            {/* Back Button */}
            <div>
                <Button
                    variant="ghost"
                    onClick={() => router.push('/dashboard/repairs')}
                    className="gap-2 -ml-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver a Reparaciones
                </Button>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Gestión de Técnicos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Administra tu equipo técnico, asigna trabajos y monitorea el rendimiento.
                    </p>
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
                        Agregar Técnico
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <TechnicianStatsGrid {...overallStats} />

            {/* Filters and View Mode */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <TechnicianFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                />

                <div className="flex items-center gap-2 border rounded-lg p-1">
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

            {/* Technicians Grid/List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Cargando técnicos...</p>
                    </div>
                </div>
            ) : showErrorState ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-4 py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h3 className="text-lg font-semibold">No pudimos cargar los técnicos</h3>
                        <p className="text-sm text-muted-foreground">
                            Revisa la conexión o la configuración de datos y vuelve a intentarlo.
                        </p>
                    </div>
                    <Button onClick={handleRefresh} variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Reintentar
                    </Button>
                </div>
            ) : filteredTechnicians.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg">
                    <div className="text-center max-w-md">
                        <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                            <UserPlus className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No hay técnicos</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {searchTerm || statusFilter !== 'all'
                                ? 'No se encontraron resultados con los filtros aplicados.'
                                : 'Comienza agregando técnicos a tu equipo.'}
                        </p>
                    </div>
                </div>
            ) : (
                viewMode === 'grid' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredTechnicians.map(tech => (
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
                            {filteredTechnicians.map(tech => (
                                <TechnicianListItem key={tech.id} {...tech} />
                            ))}
                        </div>
                    </div>
                )
            )}
        </div>
    )
}
