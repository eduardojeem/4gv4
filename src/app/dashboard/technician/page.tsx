'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/shared'
import {
  Plus,
  RefreshCw,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Activity,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react'
import { useTechnicianBoardV2 as useTechnicianBoard } from '@/hooks/use-technician-board-v2'
import { useTechnicians } from '@/hooks/use-technicians'
import { TechnicianFilters } from '@/components/technician/filters/TechnicianFilters'
import { TechnicianKanban } from '@/components/technician/board/TechnicianKanban'
import { RepairFormDialogV2 as RepairFormDialog, RepairFormMode } from '@/components/dashboard/repair-form-dialog-v2'
import type { RepairFormData } from '@/schemas'
import { Repair } from '@/types/repairs'
import { toast } from 'sonner'
import { RepairList } from '@/components/dashboard/repairs/RepairList'
import type { RepairFormData as PersistRepairFormData } from '@/contexts/RepairsContext'

export default function TechnicianPanel() {
  const {
    repairs,
    kanbanOrder,
    isLoading,
    draggedRepairId,
    showMyRepairsOnly,
    setShowMyRepairsOnly,
    onDragStart,
    onDropTo,
    updateRepair,
    createRepair,
    addImages,
    refreshRepairs
  } = useTechnicianBoard()

  const { technicians } = useTechnicians()

  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<RepairFormMode>('edit')
  const [selectedRepair, setSelectedRepair] = useState<Repair | undefined>(undefined)

  const filteredRepairs = useMemo(() => {
    if (!searchTerm) return repairs
    const lowerTerm = searchTerm.toLowerCase()
    return repairs.filter(r =>
      r.customer.name.toLowerCase().includes(lowerTerm) ||
      r.device.toLowerCase().includes(lowerTerm) ||
      r.id.toLowerCase().includes(lowerTerm) ||
      r.issue.toLowerCase().includes(lowerTerm)
    )
  }, [repairs, searchTerm])

  const stats = useMemo(() => {
    const total = filteredRepairs.length
    const pending = filteredRepairs.filter(r => r.dbStatus === 'recibido').length
    const inProgress = filteredRepairs.filter(r => r.dbStatus === 'reparacion' || r.dbStatus === 'diagnostico').length
    const completed = filteredRepairs.filter(r => r.dbStatus === 'listo' || r.dbStatus === 'entregado').length
    const urgent = filteredRepairs.filter(r => r.urgency === 'urgent' && r.dbStatus !== 'listo' && r.dbStatus !== 'entregado').length
    return { total, pending, inProgress, completed, urgent }
  }, [filteredRepairs])

  const technicianIds = useMemo(() => {
    if (technicians.length > 0) return technicians.map(t => t.id)
    const techs = new Set<string>()
    repairs.forEach(r => {
      if (r.technician?.id) techs.add(r.technician.id)
    })
    return Array.from(techs)
  }, [repairs, technicians])

  const technicianOptions = useMemo(() => {
    if (technicians.length > 0) {
      return technicians.map(t => ({ id: t.id, name: t.name || t.full_name }))
    }
    const map = new Map<string, string>()
    repairs.forEach(r => {
      if (r.technician?.id) {
        map.set(r.technician.id, r.technician.name || r.technician.id)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [repairs, technicians])

  const handleEditRepair = (repair: Repair) => {
    setDialogMode('edit')
    setSelectedRepair(repair)
    setIsDialogOpen(true)
  }

  const handleFormSubmit = async (data: RepairFormData) => {
    try {
      if (selectedRepair) {
        // Convertir RepairFormData a RepairUpdateData
        const updateData: any = {
          ...data
        }
        await updateRepair(selectedRepair.id, updateData)
        toast.success('Reparación actualizada correctamente')
      } else {
        const d = data.devices[0]
        const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'
        const payload: PersistRepairFormData = {
          customer_id: data.existingCustomerId || '',
          device: `${d.brand} ${d.model}`.trim(),
          deviceType: d.deviceType,
          brand: d.brand,
          model: d.model,
          issue: d.issue,
          description: d.description || '',
          priority: data.priority,
          urgency,
          technician_id: d.technician,
          estimated_cost: d.estimatedCost || 0,
          metadata: d.accessPassword ? { device_password: d.accessPassword } : undefined
        }
        
        // Convertir a RepairCreateData para el hook
        const createData: any = {
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          device_brand: d.brand,
          device_model: d.model,
          issue_description: d.issue,
          priority: data.priority,
          urgency,
          estimated_cost: d.estimatedCost || 0
        }
        
        const created = await createRepair(createData)
        if (created?.id && Array.isArray(d.images) && d.images.length > 0) {
          await addImages(created.id, d.images, 'general')
        }
      }
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Error al actualizar la reparación')
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isDialogOpen) {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Buscar"]') as HTMLInputElement
        searchInput?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDialogOpen])

  const initialFormData: Partial<RepairFormData> | undefined = selectedRepair ? {
    customerName: selectedRepair.customer.name,
    customerPhone: selectedRepair.customer.phone,
    customerEmail: selectedRepair.customer.email,
    priority: selectedRepair.priority,
    urgency: selectedRepair.urgency === 'urgent' ? 'high' : 'medium',
    devices: [{
      deviceType: selectedRepair.deviceType,
      brand: selectedRepair.brand,
      model: selectedRepair.model,
      issue: selectedRepair.issue,
      description: selectedRepair.description,
      accessType: 'none' as const,
      technician: selectedRepair.technician?.id || '',
      estimatedCost: selectedRepair.estimatedCost,
      images: []
    }]
  } : undefined

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Métricas de Reparaciones</h2>
            <p className="text-sm text-muted-foreground">Estado actual de tus reparaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshRepairs} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button onClick={() => { setDialogMode('add'); setSelectedRepair(undefined); setIsDialogOpen(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Reparación
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Reparaciones" value={stats.total} subtitle="En el sistema" icon={Wrench} color="blue" />
          <StatsCard title="En Proceso" value={stats.inProgress} subtitle="Trabajando ahora" icon={Activity} color="orange" />
          <StatsCard title="Completadas" value={stats.completed} subtitle="Listas para entregar" icon={CheckCircle2} color="green" />
          <StatsCard title="Urgentes" value={stats.urgent} subtitle="Requieren atención" icon={AlertCircle} color="red" />
        </div>
      </section>

      <section>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <TechnicianFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showMyRepairsOnly={showMyRepairsOnly}
                setShowMyRepairsOnly={setShowMyRepairsOnly}
                onRefresh={refreshRepairs}
                isLoading={isLoading}
              />
              <div className="flex items-center gap-2">
                <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')} className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="gap-2">
                  <ListIcon className="h-4 w-4" />
                  Lista
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        {viewMode === 'kanban' ? (
          <TechnicianKanban
            repairs={filteredRepairs}
            kanbanOrder={kanbanOrder}
            draggedRepairId={draggedRepairId}
            onDragStart={onDragStart}
            onDropTo={onDropTo}
            onEdit={handleEditRepair}
            technicianIds={technicianIds}
            showMyRepairsOnly={showMyRepairsOnly}
          />
        ) : (
          <RepairList repairs={filteredRepairs} onEdit={handleEditRepair} />
        )}
      </section>

      <RepairFormDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        mode={dialogMode}
        onSubmit={handleFormSubmit}
        initialData={initialFormData}
        technicians={technicianOptions}
      />
    </div>
  )
}
