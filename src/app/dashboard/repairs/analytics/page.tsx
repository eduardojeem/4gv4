'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, BarChart3, Activity, Zap } from 'lucide-react'
import { OptimizedRepairAnalytics } from '@/components/dashboard/repairs/analytics/OptimizedRepairAnalytics'
import { RepairPerformanceMetrics } from '@/components/dashboard/repairs/analytics/RepairPerformanceMetrics'
import { Skeleton } from '@/components/ui/skeleton'

// Componente de loading optimizado
function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function RepairsAnalyticsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header optimizado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Analytics de Reparaciones
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Análisis optimizado del rendimiento y métricas de reparaciones
              </p>
            </div>
          </div>
        </div>

        {/* Tabs optimizados */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border-0 p-2">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-transparent h-auto p-0">
              <TabsTrigger 
                value="overview" 
                className="flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Vista General</span>
              </TabsTrigger>
              <TabsTrigger 
                value="performance" 
                className="flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <Activity className="h-4 w-4" />
                <span>Rendimiento</span>
              </TabsTrigger>
              <TabsTrigger 
                value="optimized" 
                className="flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <Zap className="h-4 w-4" />
                <span>Optimizado</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6">
            <Suspense fallback={<AnalyticsLoading />}>
              <OptimizedRepairAnalytics />
            </Suspense>
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <Suspense fallback={<AnalyticsLoading />}>
              <RepairPerformanceMetrics />
            </Suspense>
          </TabsContent>

          <TabsContent value="optimized" className="mt-6">
            <Suspense fallback={<AnalyticsLoading />}>
              <OptimizedRepairAnalytics />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
