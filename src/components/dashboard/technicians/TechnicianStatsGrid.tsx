'use client'

import { StatsCard } from '@/components/shared'
import { Users, UserCheck, Wrench, Clock, TrendingUp, Award } from 'lucide-react'

interface TechnicianStatsGridProps {
    totalTechnicians: number
    activeTechnicians: number
    totalActiveJobs: number
    avgJobsPerTech: number
    avgCompletionTime?: string
    bestPerformer?: string
}

export function TechnicianStatsGrid({
    totalTechnicians,
    activeTechnicians,
    totalActiveJobs,
    avgJobsPerTech,
    avgCompletionTime,
    bestPerformer
}: TechnicianStatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatsCard
                title="Total Técnicos"
                value={totalTechnicians}
                subtitle="En el equipo"
                icon={Users}
                color="blue"
            />

            <StatsCard
                title="Disponibles"
                value={activeTechnicians}
                subtitle={`${Math.round((activeTechnicians / totalTechnicians) * 100)}% del equipo`}
                icon={UserCheck}
                color="green"
            />

            <StatsCard
                title="Trabajos Activos"
                value={totalActiveJobs}
                subtitle="En proceso ahora"
                icon={Wrench}
                color="orange"
            />

            <StatsCard
                title="Promedio por Técnico"
                value={avgJobsPerTech.toFixed(1)}
                subtitle="Trabajos activos"
                icon={TrendingUp}
                color="purple"
            />

            {avgCompletionTime && (
                <StatsCard
                    title="Tiempo Promedio"
                    value={avgCompletionTime}
                    subtitle="De resolución"
                    icon={Clock}
                    color="cyan"
                />
            )}

            {bestPerformer && (
                <StatsCard
                    title="Mejor Técnico"
                    value={bestPerformer}
                    subtitle="Este mes"
                    icon={Award}
                    color="orange"
                />
            )}
        </div>
    )
}
