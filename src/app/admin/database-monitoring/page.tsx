import { Suspense } from 'react'
import { Metadata } from 'next'
import DatabaseMonitoring from '@/components/admin/system/database-monitoring'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Monitoreo de Base de Datos | Admin',
  description: 'Supervisa el tamaño, rendimiento y salud de tu base de datos Supabase',
}

function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 bg-muted rounded w-64 animate-pulse" />
        <div className="h-4 bg-muted rounded w-96 animate-pulse" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                <div className="h-8 bg-muted rounded w-16 animate-pulse" />
                <div className="h-3 bg-muted rounded w-32 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Cargando métricas de base de datos...</span>
        </div>
      </div>
    </div>
  )
}

export default function DatabaseMonitoringPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DatabaseMonitoring />
    </Suspense>
  )
}