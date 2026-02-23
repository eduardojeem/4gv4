
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Award } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'
import { cn } from '@/lib/utils'

interface AnalyticsTechniciansProps {
  className?: string
}

export function AnalyticsTechnicians({ className }: AnalyticsTechniciansProps) {
  const [timeRange, setTimeRange] = useState('6months')
  const analytics = useRepairAnalytics(timeRange)

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Rendimiento por Técnico</h2>
          <p className="text-muted-foreground text-sm">
            Análisis de eficiencia y productividad del equipo
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6months">Últimos 6 meses</SelectItem>
            <SelectItem value="12months">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Ranking de Técnicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.technicianAnalysis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos suficientes para mostrar el ranking
              </div>
            ) : (
              analytics.technicianAnalysis.map((tech, index) => {
                const gradients = [
                  'from-yellow-400 via-orange-500 to-red-500',
                  'from-gray-300 via-gray-400 to-gray-500',
                  'from-amber-600 via-yellow-700 to-orange-800',
                  'from-blue-400 via-indigo-500 to-purple-600',
                  'from-green-400 via-teal-500 to-cyan-600'
                ]
                
                // Fallback gradient for index > 4
                const gradient = gradients[index] || 'from-slate-400 to-slate-600'
                
                return (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{tech.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tech.completedRepairs} de {tech.totalRepairs} completadas
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={tech.efficiency} className="w-20 h-2" />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(tech.efficiency)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-bold justify-end">
                        <GSIcon className="h-4 w-4" />
                        {tech.revenue.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(tech.avgTime)} días promedio
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
