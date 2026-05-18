'use client'

import { useState, useMemo, Suspense, use } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { OptimizedTechnicianHeader } from '@/components/dashboard/technicians/detail/OptimizedTechnicianHeader'
import { OptimizedTechnicianActiveJobs } from '@/components/dashboard/technicians/detail/OptimizedTechnicianActiveJobs'
import { TechnicianWorkHistory } from '@/components/dashboard/technicians/detail/TechnicianWorkHistory'
import { useTechnicianStats } from '@/hooks/use-technician-stats'
import { useRepairs } from '@/contexts/RepairsContext'
import { useTechnicianAnalytics } from '@/hooks/use-technician-analytics'
import { Activity, BarChart3, History, User } from 'lucide-react'
import { isActiveRepair, isCompletedRepair } from '@/lib/constants/repair-status'
import { type Repair } from '@/types/repairs'

function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-32" />
      <div className="rounded-lg border p-6">
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
          <div className="grid flex-1 grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
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
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

const TechnicianMetricsTab = dynamic(
  () => import('@/components/dashboard/technicians/detail/TechnicianMetricsTab').then(mod => ({ default: mod.TechnicianMetricsTab })),
  {
    loading: () => <ContentSkeleton />,
    ssr: false
  }
)

export default function OptimizedTechnicianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { technicians, isLoading: isLoadingTechs } = useTechnicianStats()
  const { repairs, isLoading: isLoadingRepairs } = useRepairs()
  const [activeTab, setActiveTab] = useState('active')

  const technician = useMemo(() => {
    return technicians.find((item) => item.id === resolvedParams.id)
  }, [technicians, resolvedParams.id])

  const { technicianRepairs, activeRepairs, completedRepairs, averageRating } = useMemo(() => {
    const nextTechnicianRepairs: Repair[] = []
    const nextActiveRepairs: Repair[] = []
    const nextCompletedRepairs: Repair[] = []
    let ratingTotal = 0
    let ratedRepairsCount = 0

    repairs.forEach((repair) => {
      if (repair.technician?.id !== resolvedParams.id) {
        return
      }

      nextTechnicianRepairs.push(repair)

      if (isActiveRepair(repair)) {
        nextActiveRepairs.push(repair)
      }

      if (isCompletedRepair(repair)) {
        nextCompletedRepairs.push(repair)
      }

      if (typeof repair.customerRating === 'number') {
        ratingTotal += repair.customerRating
        ratedRepairsCount += 1
      }
    })

    return {
      technicianRepairs: nextTechnicianRepairs,
      activeRepairs: nextActiveRepairs,
      completedRepairs: nextCompletedRepairs,
      averageRating: ratedRepairsCount > 0 ? ratingTotal / ratedRepairsCount : undefined
    }
  }, [repairs, resolvedParams.id])

  const analytics = useTechnicianAnalytics(technicianRepairs)

  const isLoading = isLoadingTechs || isLoadingRepairs

  const handleAssignRepair = () => {
    router.push(`/dashboard/repairs?new=true&technician=${encodeURIComponent(resolvedParams.id)}`)
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <HeaderSkeleton />
        <ContentSkeleton />
      </div>
    )
  }

  if (!technician) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="mb-2 text-2xl font-bold">Tecnico no encontrado</h2>
            <p className="text-muted-foreground">
              No se pudo encontrar el tecnico con ID: {resolvedParams.id}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <OptimizedTechnicianHeader
        id={technician.id}
        name={technician.name}
        specialty={technician.specialty}
        metrics={analytics.metrics}
        rating={averageRating}
        onAssignRepair={handleAssignRepair}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="rounded-xl border-0 bg-white/80 p-2 shadow-lg backdrop-blur-sm dark:bg-slate-800/80">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3">
            <TabsTrigger
              value="active"
              className="flex items-center gap-2 rounded-lg p-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Trabajos Activos</span>
              <span className="sm:hidden">Activos</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{activeRepairs.length}</span>
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="flex items-center gap-2 rounded-lg p-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <History className="h-4 w-4" />
              <span>Historial</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{completedRepairs.length}</span>
            </TabsTrigger>

            <TabsTrigger
              value="metrics"
              className="flex items-center gap-2 rounded-lg p-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Metricas</span>
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
          <TechnicianMetricsTab analytics={analytics} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
