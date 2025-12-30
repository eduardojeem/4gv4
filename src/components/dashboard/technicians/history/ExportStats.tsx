'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Repair } from '@/types/repairs'

interface ExportStatsProps {
  repairs: Repair[]
  includeMetrics?: boolean
}

export function ExportStats({ repairs, includeMetrics = true }: ExportStatsProps) {
  const total = repairs.length
  const delivered = repairs.filter(r => r.dbStatus === 'entregado').length
  const ready = repairs.filter(r => r.dbStatus === 'listo').length
  const inProgress = repairs.filter(r => ['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.dbStatus || '')).length
  const cancelled = repairs.filter(r => r.dbStatus === 'cancelado').length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Exportación</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <div>• Total de registros: {total}</div>
        <div>• Entregadas: {delivered}</div>
        <div>• Listas: {ready}</div>
        <div>• En progreso: {inProgress}</div>
        <div>• Canceladas: {cancelled}</div>
        {includeMetrics && (
          <div className="text-muted-foreground">• Incluye métricas de rendimiento</div>
        )}
      </CardContent>
    </Card>
  )
}
