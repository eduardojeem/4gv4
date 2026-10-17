'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronRight,
  Download,
  Home,
  Loader2,
  Shield,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AnalyticsOverview } from '@/components/dashboard/repairs/analytics/AnalyticsOverview'
import { AnalyticsTechnicians } from '@/components/dashboard/repairs/analytics/AnalyticsTechnicians'
import { RepairPerformanceMetrics } from '@/components/dashboard/repairs/analytics/RepairPerformanceMetrics'
import { useRepairs } from '@/contexts/RepairsContext'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'
import { generateAnalyticsPDF } from '@/lib/repairs/analytics-pdf'
import { useBranch } from '@/contexts/branch-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { roleHasPermission } from '@/lib/saas/permissions'
import { useAuth } from '@/contexts/auth-context'

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-card border border-border/60 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-[360px] rounded-2xl bg-card border border-border/60 p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RepairsAnalyticsPage() {
  const { hasPermission, loading: authLoading } = useAuth()
  const active = useOptionalActiveOrganization()
  const canAccess = active ? Boolean(active.organization && roleHasPermission(active.organization.role, 'analytics.read')) : hasPermission('analytics.read')
  const [activeTab, setActiveTab] = useState('overview')
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [timeRange, setTimeRange] = useState('6months')
  const analyticsData = useRepairAnalytics(timeRange)
  const { refreshRepairs } = useRepairs()
  const { selectedBranch } = useBranch()

  const handleExportPDF = async () => {
    setIsExportingPDF(true)
    try {
      generateAnalyticsPDF(analyticsData, selectedBranch?.name || 'Taller Central')
    } finally {
      setIsExportingPDF(false)
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 py-28">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Verificando permisos de acceso…</p>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl border border-border/80 shadow-lg">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <Shield className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Acceso Restringido</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Las analíticas financieras, métricas de productividad y tiempos del taller están reservadas exclusivamente para administradores y gerencia.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2 text-xs font-semibold rounded-xl mt-2 w-full">
            <Link href="/dashboard/repairs">
              <ArrowLeft className="h-4 w-4" />
              Volver al Módulo de Reparaciones
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (analyticsData.error) return <div role="alert" className="space-y-3 p-6 text-destructive"><p>No se pudo cargar la lista completa de reparaciones. Las analíticas no están disponibles.</p><Button variant="outline" onClick={() => void refreshRepairs()}>Reintentar</Button></div>
  if (analyticsData.isLoading) return <AnalyticsLoading />

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto print:p-0 print:gap-4">
      {/* Breadcrumbs */}
      <nav aria-label="Navegación de analíticas" className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium print:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Inicio</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <Link
          href="/dashboard/repairs"
          className="hover:text-primary transition-colors"
        >
          Reparaciones
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-foreground font-semibold">Analíticas</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Analíticas de Reparaciones
                </h1>
                {selectedBranch?.name && (
                  <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 text-xs border-primary/25 bg-primary/5 text-primary">
                    <Building2 className="h-3 w-3" />
                    <span>{selectedBranch.name}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Diagnóstico integral del flujo operativo, volumen de ingresos, cumplimiento de plazos y productividad técnica del taller.
          </p>

          {selectedBranch?.name && (
            <div className="sm:hidden pt-1">
              <Badge variant="outline" className="inline-flex items-center gap-1 text-xs border-primary/25 bg-primary/5 text-primary">
                <Building2 className="h-3 w-3" />
                <span>Sucursal: {selectedBranch.name}</span>
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <Button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="h-9 gap-2 text-xs font-semibold shadow-xs"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando PDF…</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Exportar Informe PDF</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="rounded-xl border border-border/70 bg-card/60 p-1.5 shadow-2xs print:hidden">
          <TabsList className="flex w-full sm:w-auto bg-transparent h-auto p-0 gap-1.5">
            <TabsTrigger
              value="overview"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Vista General</span>
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Activity className="h-4 w-4" />
              <span>Rendimiento y Tiempos</span>
            </TabsTrigger>
            <TabsTrigger
              value="technicians"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Users className="h-4 w-4" />
              <span>Productividad por Técnico</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div>
          <TabsContent value="overview" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <AnalyticsOverview timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            </Suspense>
          </TabsContent>

          <TabsContent value="performance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <RepairPerformanceMetrics />
            </Suspense>
          </TabsContent>

          <TabsContent value="technicians" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Suspense fallback={<AnalyticsLoading />}>
              <AnalyticsTechnicians timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
