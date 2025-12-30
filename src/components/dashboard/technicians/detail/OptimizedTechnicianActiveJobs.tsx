'use client'

import { memo, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Repair } from '@/types/repairs'
import { Clock, ExternalLink, Search, Filter, AlertTriangle, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface OptimizedTechnicianActiveJobsProps {
  repairs: Repair[]
}

const statusConfig = {
  recibido: { 
    label: 'Recibido', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    priority: 1
  },
  diagnostico: { 
    label: 'Diagnóstico', 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    priority: 2
  },
  reparacion: { 
    label: 'Reparación', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    priority: 3
  },
  pausado: { 
    label: 'Pausado', 
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    priority: 4
  }
}

const priorityConfig = {
  low: { label: 'Baja', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  medium: { label: 'Media', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
}

export const OptimizedTechnicianActiveJobs = memo(function OptimizedTechnicianActiveJobs({ 
  repairs 
}: OptimizedTechnicianActiveJobsProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date')

  // Filtrar y ordenar reparaciones
  const filteredAndSortedRepairs = useMemo(() => {
    let filtered = repairs.filter(repair => {
      const matchesSearch = !searchTerm || 
        repair.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repair.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repair.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repair.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' || repair.dbStatus === statusFilter
      const matchesPriority = priorityFilter === 'all' || repair.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })

    // Ordenar
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
          if (aPriority !== bPriority) return bPriority - aPriority
          // Si tienen la misma prioridad, ordenar por urgencia
          if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1
          if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1
          break
        case 'status':
          const aStatus = statusConfig[a.dbStatus as keyof typeof statusConfig]?.priority || 999
          const bStatus = statusConfig[b.dbStatus as keyof typeof statusConfig]?.priority || 999
          if (aStatus !== bStatus) return aStatus - bStatus
          break
        case 'date':
        default:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return 0
    })

    return filtered
  }, [repairs, searchTerm, statusFilter, priorityFilter, sortBy])

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const urgent = repairs.filter(r => r.urgency === 'urgent').length
    const highPriority = repairs.filter(r => r.priority === 'high').length
    const overdue = repairs.filter(r => {
      const daysSince = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSince > 7
    }).length

    return { urgent, highPriority, overdue }
  }, [repairs])

  if (repairs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Trabajos Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">¡Excelente trabajo!</h3>
            <p className="text-muted-foreground">No hay trabajos activos en este momento</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Trabajos Activos ({repairs.length})
            </CardTitle>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-4 mt-2">
              {stats.urgent > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.urgent} Urgente{stats.urgent > 1 ? 's' : ''}
                </Badge>
              )}
              {stats.highPriority > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {stats.highPriority} Alta Prioridad
                </Badge>
              )}
              {stats.overdue > 0 && (
                <Badge variant="outline" className="gap-1 border-orange-200 text-orange-700">
                  <Clock className="h-3 w-3" />
                  {stats.overdue} Atrasado{stats.overdue > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, dispositivo, problema o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="recibido">Recibido</SelectItem>
              <SelectItem value="diagnostico">Diagnóstico</SelectItem>
              <SelectItem value="reparacion">Reparación</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Por Fecha</SelectItem>
              <SelectItem value="priority">Por Prioridad</SelectItem>
              <SelectItem value="status">Por Estado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {filteredAndSortedRepairs.map(repair => {
            const statusInfo = statusConfig[repair.dbStatus as keyof typeof statusConfig]
            const priorityInfo = priorityConfig[repair.priority as keyof typeof priorityConfig]
            
            const timeAgo = (() => {
              try {
                if (!repair.createdAt) return 'Fecha no disponible'
                const date = new Date(repair.createdAt)
                if (isNaN(date.getTime())) return 'Fecha inválida'
                return formatDistanceToNow(date, {
                  addSuffix: true,
                  locale: es
                })
              } catch (error) {
                return 'Fecha no disponible'
              }
            })()

            const daysSince = (Date.now() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            const isOverdue = daysSince > 7

            return (
              <div
                key={repair.id}
                className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                  repair.urgency === 'urgent' 
                    ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' 
                    : isOverdue
                    ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Header with customer and badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-lg">{repair.customer.name}</h4>
                      
                      {statusInfo && (
                        <Badge variant="outline" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      )}
                      
                      {priorityInfo && (
                        <Badge variant="outline" className={priorityInfo.color}>
                          {priorityInfo.label}
                        </Badge>
                      )}
                      
                      {repair.urgency === 'urgent' && (
                        <Badge variant="destructive" className="animate-pulse">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Urgente
                        </Badge>
                      )}
                      
                      {isOverdue && (
                        <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                          <Clock className="h-3 w-3 mr-1" />
                          Atrasado
                        </Badge>
                      )}
                    </div>

                    {/* Device info */}
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="font-medium text-foreground">
                        {repair.device} - {repair.brand} {repair.model}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {repair.issue}
                      </p>
                    </div>

                    {/* Footer info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo}
                        </div>
                        <span>ID: {repair.id.slice(0, 8)}</span>
                        {repair.estimatedCost && (
                          <span>Estimado: ${repair.estimatedCost.toLocaleString()}</span>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {Math.round(daysSince)} día{Math.round(daysSince) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/repairs?id=${repair.id}`)}
                    className="flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredAndSortedRepairs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No se encontraron trabajos con los filtros aplicados</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})