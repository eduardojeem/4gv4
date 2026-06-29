'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, BarChart3, Activity, Users, ArrowLeft, Home, ChevronRight, Download } from 'lucide-react'
import { AnalyticsOverview } from '@/components/dashboard/repairs/analytics/AnalyticsOverview'
import { AnalyticsTechnicians } from '@/components/dashboard/repairs/analytics/AnalyticsTechnicians'
import { RepairPerformanceMetrics } from '@/components/dashboard/repairs/analytics/RepairPerformanceMetrics'
import { Skeleton } from '@/components/ui/skeleton'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'
import { generateAnalyticsPDF } from '@/lib/repairs/analytics-pdf'
import { useBranch } from '@/contexts/branch-context'

function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/50 border border-border/30 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[400px] rounded-2xl bg-muted/30 border border-border/30" />
        ))}
      </div>
    </div>
  )
}

export default function RepairsAnalyticsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const analyticsData = useRepairAnalytics('6m')
  const { selectedBranch } = useBranch()

  const handleExportPDF = () => {
    generateAnalyticsPDF(analyticsData, selectedBranch?.name || 'Taller')
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 w-full max-w-7xl mx-auto animate-in fade-in duration-500 relative print:p-0 print:gap-4">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none print:hidden" />

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80 font-medium relative z-10 print:hidden">
        <Home className="h-4 w-4 hover:text-primary transition-colors cursor-pointer" />
        <ChevronRight className="h-3 w-3" />
        <span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => router.push('/dashboard/repairs')}>Reparaciones</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Analytics</span>
      </div>

      <div className="-mt-4 relative z-10 print:hidden">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="-ml-4 gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-primary/20 flex items-center justify-center shadow-inner print:border-none print:shadow-none">
            <BarChart3 className="h-8 w-8 text-primary drop-shadow-sm" />
          </div>
          <div>
            <h1 className="bg-gradient-to-br from-primary via-primary/90 to-primary/50 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-sm mb-2 print:text-black">
              Analytics de Reparaciones
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
              Análisis integral del rendimiento, métricas operativas y productividad de tu taller.
            </p>
          </div>
        </div>
        <Button 
          onClick={handleExportPDF}
          className="gap-2 shadow-md hover:shadow-lg transition-all print:hidden"
        >
          <Download className="h-4 w-4" />
          Exportar a PDF
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full relative z-10">
        <div className="bg-background/50 backdrop-blur-xl rounded-2xl border border-border/50 shadow-sm p-1.5 inline-flex w-full overflow-x-auto no-scrollbar print:hidden">
          <TabsList className="flex w-full sm:w-auto bg-transparent h-auto p-0 gap-1.5">
            <TabsTrigger 
              value="overview" 
              className="flex-1 sm:flex-none flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300 group"
            >
              <BarChart3 className="h-4 w-4 group-data-[state=active]:animate-pulse" />
              <span>Vista General</span>
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className="flex-1 sm:flex-none flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300 group"
            >
              <Activity className="h-4 w-4 group-data-[state=active]:animate-pulse" />
              <span>Rendimiento</span>
            </TabsTrigger>
            <TabsTrigger 
              value="technicians" 
              className="flex-1 sm:flex-none flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300 group"
            >
              <Users className="h-4 w-4 group-data-[state=active]:animate-pulse" />
              <span>Técnicos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-8 relative">
          <TabsContent value="overview" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <AnalyticsOverview />
            </Suspense>
          </TabsContent>

          <TabsContent value="performance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <RepairPerformanceMetrics />
            </Suspense>
          </TabsContent>

          <TabsContent value="technicians" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <AnalyticsTechnicians />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
