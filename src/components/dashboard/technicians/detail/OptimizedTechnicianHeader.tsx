'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { WorkStatusBadge } from '../WorkStatusBadge'
import { 
  ArrowLeft, 
  Edit, 
  UserPlus, 
  Star, 
  Clock, 
  Wrench,
  DollarSign,
  Target,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TechnicianMetrics } from '@/hooks/use-technician-analytics'
import { GSIcon } from '@/components/ui/standardized-components'

interface OptimizedTechnicianHeaderProps {
  id: string
  name: string
  avatar?: string
  specialty?: string
  metrics: TechnicianMetrics
  rating?: number
  onAssignRepair?: () => void
}

const workloadConfig = {
  light: { label: 'Carga Ligera', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', progress: 25 },
  normal: { label: 'Carga Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', progress: 50 },
  heavy: { label: 'Carga Pesada', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', progress: 75 },
  overloaded: { label: 'Sobrecargado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', progress: 100 }
}

export const OptimizedTechnicianHeader = memo(function OptimizedTechnicianHeader({
  id,
  name,
  avatar,
  specialty,
  metrics,
  rating,
  onAssignRepair
}: OptimizedTechnicianHeaderProps) {
  const router = useRouter()
  const workloadInfo = workloadConfig[metrics.workload]
  const loadIndicatorColor =
    metrics.loadState === 'no_load'
      ? 'bg-emerald-500'
      : metrics.loadState === 'light_load'
        ? 'bg-blue-500'
        : metrics.loadState === 'medium_load'
          ? 'bg-amber-500'
          : 'bg-red-500'

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/repairs/technicians')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a técnicos
      </Button>

      {/* Header Card */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6">
            {/* Top row: avatar + info + actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Avatar and Basic Info */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl sm:h-20 sm:w-20 sm:text-3xl">
                    {avatar ? (
                      <img src={avatar} alt={name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-background ${loadIndicatorColor}`} />
                </div>

                <div className="flex-1">
                  <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
                  {specialty && (
                    <p className="text-base text-muted-foreground sm:text-lg">{specialty}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <WorkStatusBadge status={metrics.loadState} />
                    <Badge variant="outline" className={workloadInfo.color}>
                      {workloadInfo.label}
                    </Badge>
                    {rating !== undefined && (
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {rating.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions — inline on mobile, column on sm+ */}
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1 sm:flex-none"
                  onClick={() => router.push(`/dashboard/repairs/technicians`)}
                >
                  <Edit className="h-4 w-4" />
                  Editar perfil
                </Button>
                <Button
                  size="sm"
                  onClick={onAssignRepair}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <UserPlus className="h-4 w-4" />
                  Asignar
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {/* Efficiency Progress — shown here on mobile */}
              <div className="col-span-2 space-y-1 lg:hidden">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Eficiencia General</span>
                  <span className="font-medium">{Math.round(metrics.efficiency)}%</span>
                </div>
                <Progress value={metrics.efficiency} className="h-2" />
              </div>

              {/* Total Jobs */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/50 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg">
                    <Wrench className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Total</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{metrics.totalJobs}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {metrics.completionRate.toFixed(1)}% completados
                </p>
              </div>

              {/* Active Jobs */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/50 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-orange-500 rounded-lg">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Activos</span>
                </div>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{metrics.activeJobs}</p>
                <div className="mt-1">
                  <Progress value={workloadInfo.progress} className="h-1.5" />
                </div>
              </div>

              {/* Completion Rate */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/50 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-500 rounded-lg">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">A Tiempo</span>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {Math.round(metrics.onTimeRate)}%
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {metrics.onTimeDeliveries} de {metrics.completedJobs}
                </p>
              </div>

              {/* Delivered Value */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/50 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-purple-500 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Valor</span>
                </div>
                <div className="flex items-center gap-1">
                  <GSIcon className="h-5 w-5 text-purple-900 dark:text-purple-100" />
                  <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {metrics.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Prom: {Math.round(metrics.avgJobValue).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Efficiency bar — shown on desktop inside stats area */}
            <div className="hidden space-y-1 lg:block">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Eficiencia General</span>
                <span className="font-medium">{Math.round(metrics.efficiency)}%</span>
              </div>
              <Progress value={metrics.efficiency} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
