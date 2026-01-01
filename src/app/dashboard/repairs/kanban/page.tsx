'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
  RefreshCw, 
  Settings, 
  Eye, 
  EyeOff,
  BarChart3,
  Kanban as KanbanIcon,
  Maximize2,
  Minimize2
} from 'lucide-react'

// Optimized components
import { KanbanColumn } from '@/components/dashboard/repairs/kanban/KanbanColumn'
import { KanbanFilters } from '@/components/dashboard/repairs/kanban/KanbanFilters'
import { KanbanMetrics } from '@/components/dashboard/repairs/kanban/KanbanMetrics'

// Hooks and utilities
import { useKanbanAnalytics, KanbanFilters as KanbanFiltersType } from '@/hooks/use-kanban-analytics'
import { useRepairsRealtime } from '@/hooks/useRepairsRealtime'
import { useRepairs } from '@/contexts/RepairsContext'
import { useTechnicians } from '@/hooks/use-technicians'

// Types and mappings
import { RepairOrder } from '@/types/repairs'
import { stageToStatus, statusToStage, StatusKey } from '@/lib/repairs/mapping'
import { calculatePriorityScore } from '@/services/repair-priority'

const columns: { key: StatusKey; title: string }[] = [
  { key: 'pending', title: 'Pendiente' },
  { key: 'in_progress', title: 'En Progreso' },
  { key: 'waiting_parts', title: 'Esperando Repuestos' },
  { key: 'on_hold', title: 'En Espera' },
  { key: 'completed', title: 'Completado' },
  { key: 'cancelled', title: 'Cancelado' },
]

// Loading skeleton component
function KanbanSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function OptimizedRepairsKanbanPage() {
  // State management
  const [scores, setScores] = useState<Record<string, number>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<StatusKey | null>(null)
  const [collapsedColumns, setCollapsedColumns] = useState<StatusKey[]>([])
  const [showMetrics, setShowMetrics] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Filters state
  const [filters, setFilters] = useState<KanbanFiltersType>({
    searchTerm: '',
    minUrgency: 1,
    maxUrgency: 5,
    showOverdueOnly: false,
    showUrgentOnly: false
  })

  // Data hooks
  const { repairs, isLoading: isLoadingRepairs, refreshRepairs } = useRepairs()
  const { technicians, isLoading: isLoadingTechnicians } = useTechnicians()

  // Convert repairs to RepairOrder format
  const repairOrders: RepairOrder[] = useMemo(() => {
    return repairs.map(repair => ({
      id: repair.id,
      customerName: repair.customer?.name || 'Cliente desconocido',
      deviceModel: `${repair.brand} ${repair.model}`,
      issueDescription: repair.issue,
      createdAt: repair.createdAt,
      updatedAt: repair.lastUpdate,
      urgency: repair.priority === 'high' ? 5 : repair.priority === 'medium' ? 3 : 1,
      technicalComplexity: 3, // Default value
      historicalValue: repair.finalCost || repair.estimatedCost || 0,
      stage: repair.dbStatus as RepairOrder['stage'],
      technician: repair.technician ? {
        id: repair.technician.id,
        name: repair.technician.name
      } : undefined,
      deviceType: repair.deviceType
    }))
  }, [repairs])

  // Analytics hook
  const { filteredItems, metrics, itemsByStatus } = useKanbanAnalytics(repairOrders, filters)

  // Get unique device types for filters
  const deviceTypes = useMemo(() => {
    const types = new Set(repairOrders.map(item => item.deviceType).filter(Boolean))
    return Array.from(types) as string[]
  }, [repairOrders])

  // Real-time updates
  useRepairsRealtime({
    onInsert: () => {
      toast.success('Nueva reparación agregada')
    },
    onUpdate: () => {
      toast.info('Reparación actualizada')
    },
    onDelete: () => {
      toast.info('Reparación eliminada')
    }
  })

  // Load and persist collapsed columns
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kanban-collapsed-columns')
      if (saved) {
        setCollapsedColumns(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error loading collapsed columns:', error)
    }
  }, [])

  const saveCollapsedColumns = useCallback((columns: StatusKey[]) => {
    try {
      localStorage.setItem('kanban-collapsed-columns', JSON.stringify(columns))
    } catch (error) {
      console.error('Error saving collapsed columns:', error)
    }
  }, [])

  // Calculate priority scores
  const fetchScores = useCallback(async (items: RepairOrder[]) => {
    const newScores: Record<string, number> = {}
    
    // Calculate scores locally for better performance
    items.forEach(item => {
      newScores[item.id] = calculatePriorityScore(item, {
        weights: { 
          urgencyWeight: 0.4, 
          waitTimeWeight: 0.3, 
          historicalValueWeight: 0.2, 
          technicalComplexityWeight: 0.1 
        },
        rules: []
      })
    })
    
    setScores(newScores)
  }, [])

  // Initialize scores
  useEffect(() => {
    if (repairOrders.length > 0) {
      fetchScores(repairOrders)
    }
  }, [repairOrders, fetchScores])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: StatusKey) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('text/plain')
    
    if (!itemId) return

    const item = repairOrders.find(r => r.id === itemId)
    if (!item) return

    const currentStatus = stageToStatus(item.stage)
    if (currentStatus === targetStatus) return

    try {
      // Optimistic update
      const newStage = statusToStage(targetStatus)
      
      // Update via API
      const response = await fetch(`/api/repairs/${encodeURIComponent(itemId)}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Error updating status')
      }

      toast.success(`Reparación movida a ${columns.find(c => c.key === targetStatus)?.title}`)
      
      // Refresh data to ensure consistency
      await refreshRepairs()
      
    } catch (error) {
      console.error('Error updating repair status:', error)
      toast.error('Error al actualizar el estado de la reparación')
    } finally {
      setDraggedItem(null)
      setDragOverColumn(null)
    }
  }, [repairOrders, refreshRepairs])

  // Column management
  const toggleColumnCollapse = useCallback((status: StatusKey) => {
    setCollapsedColumns(prev => {
      const newCollapsed = prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
      saveCollapsedColumns(newCollapsed)
      return newCollapsed
    })
  }, [saveCollapsedColumns])

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refreshRepairs(),
        fetchScores(repairOrders)
      ])
      toast.success('Datos actualizados')
    } catch (error) {
      toast.error('Error al actualizar datos')
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshRepairs, fetchScores, repairOrders])

  // Filter handlers
  const handleFiltersChange = useCallback((newFilters: Partial<KanbanFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Item action handlers
  const handleViewItem = useCallback((id: string) => {
    // Navigate to repair detail
    window.open(`/dashboard/repairs?id=${id}`, '_blank')
  }, [])

  const handleEditItem = useCallback((id: string) => {
    // Navigate to repair edit
    window.open(`/dashboard/repairs?id=${id}&edit=true`, '_blank')
  }, [])

  const handleDeleteItem = useCallback(async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta reparación?')) return
    
    try {
      const response = await fetch(`/api/repairs/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error deleting repair')
      }

      toast.success('Reparación eliminada')
      await refreshRepairs()
    } catch (error) {
      toast.error('Error al eliminar la reparación')
    }
  }, [refreshRepairs])

  const isLoading = isLoadingRepairs || isLoadingTechnicians

  if (isLoading) {
    return (
      <div className="p-6">
        <KanbanSkeleton />
      </div>
    )
  }

  return (
    <div className={`p-6 space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
            <KanbanIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kanban de Reparaciones</h1>
            <p className="text-muted-foreground">
              Gestiona el flujo de trabajo arrastrando las tarjetas entre columnas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetrics(!showMetrics)}
          >
            {showMetrics ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showMetrics ? 'Ocultar' : 'Mostrar'} Métricas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
            {isFullscreen ? 'Salir' : 'Pantalla Completa'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {showMetrics && (
        <KanbanMetrics metrics={metrics} />
      )}

      {/* Filters */}
      <KanbanFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        technicians={technicians}
        deviceTypes={deviceTypes}
        totalItems={repairOrders.length}
        filteredCount={filteredItems.length}
      />

      {/* Kanban Board */}
      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        onDragEnd={handleDragEnd}
      >
        {columns.map(column => (
          <KanbanColumn
            key={column.key}
            title={column.title}
            status={column.key}
            items={itemsByStatus[column.key] || []}
            scores={scores}
            metrics={metrics.byStatus[column.key]}
            isCollapsed={collapsedColumns.includes(column.key)}
            isDragOver={dragOverColumn === column.key}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onToggleCollapse={() => toggleColumnCollapse(column.key)}
            onViewItem={handleViewItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && repairOrders.length > 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2">No se encontraron elementos</h3>
          <p className="text-muted-foreground mb-4">
            Ajusta los filtros para ver más reparaciones
          </p>
          <Button variant="outline" onClick={() => handleFiltersChange({
            searchTerm: '',
            minUrgency: 1,
            maxUrgency: 5,
            technicianId: undefined,
            deviceType: undefined,
            showOverdueOnly: false,
            showUrgentOnly: false,
            dateRange: undefined
          })}>
            Limpiar Filtros
          </Button>
        </div>
      )}

      {repairOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">No hay reparaciones</h3>
          <p className="text-muted-foreground">
            Las reparaciones aparecerán aquí cuando se agreguen al sistema
          </p>
        </div>
      )}
    </div>
  )
}