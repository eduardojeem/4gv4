'use client'

import { useState, useMemo, Suspense, use } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { OptimizedTechnicianHeader } from '@/components/dashboard/technicians/detail/OptimizedTechnicianHeader'
import { OptimizedTechnicianActiveJobs } from '@/components/dashboard/technicians/detail/OptimizedTechnicianActiveJobs'
import { TechnicianWorkHistory } from '@/components/dashboard/technicians/detail/TechnicianWorkHistory'
import { TechnicianMetricsTab } from '@/components/dashboard/technicians/detail/TechnicianMetricsTab'
import { useTechnicians } from '@/hooks/use-technicians'
import { useRepairs } from '@/contexts/RepairsContext'
import { useTechnicianAnalytics } from '@/hooks/use-technician-analytics'
import { RefreshCw, Activity, BarChart3, History, User } from 'lucide-react'
import { toast } from 'sonner'

// Loading components optimizados
function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-32" />
      <div className="p-6 border rounded-lg">
        <div className="flex gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function OptimizedTechnicianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params)
  const { technicians, isLoading: isLoadingTechs } = useTechnicians()
  const { repairs, isLoading: isLoadingRepairs } = useRepairs()
  const [activeTab, setActiveTab] = useState('active')

  // Memoized technician lookup
  const technician = useMemo(() => {
    return technicians.find(t => t.id === resolvedParams.id)
  }, [technicians, resolvedParams.id])

  // Memoized technician repairs
  const technicianRepairs = useMemo(() => {
    return repairs.filter(r => r.technician?.id === resolvedParams.id)
  }, [repairs, resolvedParams.id])

  // Separate active and completed repairs with memoization
  const { activeRepairs, completedRepairs } = useMemo(() => {
    const active = technicianRepairs.filter(r =>
      r.dbStatus && !['listo', 'entregado', 'cancelado'].includes(r.dbStatus)
    )
    const completed = technicianRepairs.filter(r =>
      r.dbStatus && ['listo', 'entregado'].includes(r.dbStatus)
    )
    return { activeRepairs: active, completedRepairs: completed }
  }, [technicianRepairs])

  // Analytics hook
  const analytics = useTechnicianAnalytics(technicianRepairs)

  const isLoading = isLoadingTechs || isLoadingRepairs

  // Handle assign repair
  const handleAssignRepair = () => {
    toast.info('Funcionalidad de asignación próximamente')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        <HeaderSkeleton />
        <ContentSkeleton />
      </div>
    )
  }

  if (!technician) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Técnico no encontrado</h2>
            <p className="text-muted-foreground">
              No se pudo encontrar el técnico con ID: {resolvedParams.id}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Optimized Header */}
      <OptimizedTechnicianHeader
        id={technician.id}
        name={technician.name}
        specialty={technician.specialty}
        metrics={analytics.metrics}
        rating={4.5} // TODO: Get from database
        onAssignRepair={handleAssignRepair}
      />

      {/* Enhanced Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border-0 p-2">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent h-auto p-0">
            <TabsTrigger 
              value="active" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Trabajos Activos</span>
              <span className="sm:hidden">Activos</span>
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                {activeRepairs.length}
              </span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="history" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Historial</span>
              <span className="sm:hidden">Historial</span>
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                {completedRepairs.length}
              </span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="metrics" 
              className="flex items-center gap-2 p-3 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Métricas</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
            <OptimizedTechnicianActiveJobs repairs={activeRepairs} />
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
            <TechnicianWorkHistory repairs={completedRepairs} />
          </Suspense>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <Suspense fallback={<ContentSkeleton />}>
            <TechnicianMetricsTab analytics={analytics} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
