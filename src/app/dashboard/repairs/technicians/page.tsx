'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home, ChevronRight, UserPlus, LayoutGrid, List, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TechnicianStatsGrid } from '@/components/dashboard/technicians/TechnicianStatsGrid'
import { TechnicianFilters } from '@/components/dashboard/technicians/TechnicianFilters'
import { TechnicianCard } from '@/components/dashboard/technicians/TechnicianCard'
import { useTechnicians } from '@/hooks/use-technicians'
import { useRepairs } from '@/contexts/RepairsContext'

export default function TechniciansPage() {
    const router = useRouter()
    const { technicians, isLoading: isLoadingTechs, refreshTechnicians } = useTechnicians()
    const { repairs, isLoading: isLoadingRepairs } = useRepairs()

    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sortBy, setSortBy] = useState('name')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // Calculate technician stats
    const technicianData = useMemo(() => {
        return technicians.map(tech => {
            const techRepairs = repairs.filter(r => r.technician?.id === tech.id)
            const activeJobs = techRepairs.filter(r =>
                r.dbStatus !== 'listo' && r.dbStatus !== 'entregado'
            ).length

            // Calculate completed this month
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const completedThisMonth = techRepairs.filter(r => {
                const completedDate = r.completedAt ? new Date(r.completedAt) : null
                return completedDate && completedDate >= startOfMonth &&
                    (r.dbStatus === 'listo' || r.dbStatus === 'entregado')
            }).length

            const totalCompleted = techRepairs.filter(r =>
                r.dbStatus === 'listo' || r.dbStatus === 'entregado'
            ).length

            // Determine status based on active jobs
            let status: 'available' | 'busy' | 'offline' | 'unavailable'
            if (activeJobs === 0) {
                status = 'available'
            } else if (activeJobs <= 3) {
                status = 'busy'
            } else {
                status = 'unavailable'
            }

            // Calculate workload percentage (assuming max 10 jobs = 100%)
            const workloadPercentage = Math.min((activeJobs / 10) * 100, 100)

            return {
                id: tech.id,
                name: tech.name,
                specialty: tech.specialty,
                status,
                activeJobs,
                completedThisMonth,
                totalCompleted,
                rating: 4.5, // TODO: Get from database
                workloadPercentage
            }
        })
    }, [technicians, repairs])

    // Filter technicians
    const filteredTechnicians = useMemo(() => {
        let filtered = technicianData

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(tech =>
                tech.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(tech => tech.status === statusFilter)
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name)
                case 'activeJobs':
                    return b.activeJobs - a.activeJobs
                case 'completedThisMonth':
                    return b.completedThisMonth - a.completedThisMonth
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0)
                case 'workload':
                    return b.workloadPercentage - a.workloadPercentage
                default:
                    return 0
            }
        })

        return filtered
    }, [technicianData, searchTerm, statusFilter, sortBy])

    // Calculate overall stats
    const overallStats = useMemo(() => {
        const total = technicianData.length
        const active = technicianData.filter(t => t.status === 'available' || t.status === 'busy').length
        const totalActiveJobs = technicianData.reduce((sum, t) => sum + t.activeJobs, 0)
        const avgJobsPerTech = total > 0 ? totalActiveJobs / total : 0

        // Find best performer
        const bestPerformer = technicianData.reduce((best, current) => {
            return current.completedThisMonth > (best?.completedThisMonth || 0) ? current : best
        }, technicianData[0])

        return {
            totalTechnicians: total,
            activeTechnicians: active,
            totalActiveJobs,
            avgJobsPerTech,
            avgCompletionTime: '2.5 días', // TODO: Calculate from actual data
            bestPerformer: bestPerformer?.name
        }
    }, [technicianData])

    const isLoading = isLoadingTechs || isLoadingRepairs

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
                        onClick={refreshTechnicians}
                        title="Actualizar"
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="gap-2">
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
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Technicians Grid/List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Cargando técnicos...</p>
                    </div>
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
                <div className={
                    viewMode === 'grid'
                        ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        : 'flex flex-col gap-4'
                }>
                    {filteredTechnicians.map(tech => (
                        <TechnicianCard key={tech.id} {...tech} />
                    ))}
                </div>
            )}
        </div>
    )
}
