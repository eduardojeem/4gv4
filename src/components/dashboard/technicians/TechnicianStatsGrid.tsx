'use client'

import { Award, Clock, Gauge, TrendingUp, Users, Wrench } from 'lucide-react'
import { StatsCard } from '@/components/shared'

interface TechnicianStatsGridProps {
  totalTechnicians: number
  techniciansWithoutLoad: number
  highLoadTechnicians: number
  totalActiveJobs: number
  avgJobsPerTech: number
  avgCompletionTime?: string
  topCloserName?: string
}

export function TechnicianStatsGrid({
  totalTechnicians,
  techniciansWithoutLoad,
  highLoadTechnicians,
  totalActiveJobs,
  avgJobsPerTech,
  avgCompletionTime,
  topCloserName,
}: TechnicianStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatsCard
        title="Total Tecnicos"
        value={totalTechnicians}
        subtitle="Visibles en esta sucursal"
        icon={Users}
        color="blue"
      />

      <StatsCard
        title="Sin Carga"
        value={techniciansWithoutLoad}
        subtitle="Ahora mismo"
        icon={Gauge}
        color="green"
      />

      <StatsCard
        title="Carga Alta"
        value={highLoadTechnicians}
        subtitle="Conviene repartir mejor"
        icon={TrendingUp}
        color="orange"
      />

      <StatsCard
        title="Trabajos Activos"
        value={totalActiveJobs}
        subtitle="En curso ahora"
        icon={Wrench}
        color="purple"
      />

      <StatsCard
        title="Promedio por Tecnico"
        value={avgJobsPerTech.toFixed(1)}
        subtitle="Trabajos activos"
        icon={TrendingUp}
        color="purple"
      />

      {avgCompletionTime && (
        <StatsCard
          title="Tiempo Promedio"
          value={avgCompletionTime}
          subtitle="Para cerrar un trabajo"
          icon={Clock}
          color="cyan"
        />
      )}

      {topCloserName && (
        <StatsCard
          title="Mas Cierres"
          value={topCloserName}
          subtitle="Este mes"
          icon={Award}
          color="orange"
        />
      )}
    </div>
  )
}
