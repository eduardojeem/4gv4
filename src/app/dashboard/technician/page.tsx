'use client'

import { useState, useMemo, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/shared'
import {
  Plus,
  RefreshCw,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Activity,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react'
import { useTechnicianBoardV2 as useTechnicianBoard } from '@/hooks/use-technician-board-v2'
import { useTechnicians } from '@/hooks/use-technicians'
import { TechnicianFilters } from '@/components/technician/filters/TechnicianFilters'
import { TechnicianKanban } from '@/components/technician/board/TechnicianKanban'
import { RepairFormDialogV2 as RepairFormDialog, RepairFormMode } from '@/components/dashboard/repair-form-dialog-v2'
import type { RepairFormData } from '@/schemas'
import type { RepairFormData as PersistRepairFormData } from '@/contexts/RepairsContext'
import type { Repair } from '@/types/repairs'
import { RepairList } from '@/components/dashboard/repairs/RepairList'
import { RepairDetailDialog } from '@/components/dashboard/repairs/RepairDetailDialog'

type TechnicianRepairUpdatePayload = Omit<Partial<Repair>, 'images' | 'parts' | 'notes'> & {
  customer_id?: string
  technician_id?: string
  images?: string[]
  parts?: RepairFormData['parts']
  notes?: RepairFormData['notes']
}

export default function TechnicianPanel() {
  const {
    repairs,
    kanbanOrder,
    isLoading,
    showMyRepairsOnly,
    setShowMyRepairsOnly,
    canViewAllRepairs,
    onDragStart,
    onDropTo,
    updateRepair,
    createRepair,
    addImages,
    refreshRepairs,
  } = useTechnicianBoard()

  const { technicians } = useTechnicians()

  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<RepairFormMode>('add')
  const [selectedRepair, setSelectedRepair] = useState<Repair | undefined>(undefined)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailRepair, setDetailRepair] = useState<Repair | null>(null)

  const filteredRepairs = useMemo(() => {
    if (!searchTerm) return repairs

    const lowerTerm = searchTerm.toLowerCase()
    return repairs.filter((repair) =>
      repair.customer.name.toLowerCase().includes(lowerTerm) ||
      repair.device.toLowerCase().includes(lowerTerm) ||
      repair.id.toLowerCase().includes(lowerTerm) ||
      repair.issue.toLowerCase().includes(lowerTerm)
    )
  }, [repairs, searchTerm])

  const stats = useMemo(() => {
    const total = filteredRepairs.length
    const pending = filteredRepairs.filter((repair) => repair.dbStatus === 'recibido').length
    const inProgress = filteredRepairs.filter(
      (repair) => repair.dbStatus === 'reparacion' || repair.dbStatus === 'diagnostico'
    ).length
    const completed = filteredRepairs.filter(
      (repair) => repair.dbStatus === 'listo' || repair.dbStatus === 'entregado'
    ).length
    const urgent = filteredRepairs.filter(
      (repair) =>
        repair.urgency === 'urgent' &&
        repair.dbStatus !== 'listo' &&
        repair.dbStatus !== 'entregado'
    ).length

    return { total, pending, inProgress, completed, urgent }
  }, [filteredRepairs])

  const technicianOptions = useMemo(() => {
    if (technicians.length > 0) {
      return technicians.map((technician) => ({
        id: technician.id,
        name: technician.name || technician.full_name,
      }))
    }

    const map = new Map<string, string>()
    repairs.forEach((repair) => {
      if (repair.technician?.id) {
        map.set(repair.technician.id, repair.technician.name || repair.technician.id)
      }
    })

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [repairs, technicians])

  const handleEditRepair = (repair: Repair) => {
    setDialogMode('edit')
    setSelectedRepair(repair)
    setIsDialogOpen(true)
  }

  const handleViewRepair = (repair: Repair) => {
    setDetailRepair(repair)
    setIsDetailOpen(true)
  }

  const handleFormSubmit = async (data: RepairFormData) => {
    try {
      if (dialogMode === 'add') {
        const createdRepairs = await Promise.all(
          data.devices.map(async (device) => {
            const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'
            const payload: PersistRepairFormData = {
              customer_id: data.existingCustomerId || '',
              device: `${device.brand} ${device.model}`.trim(),
              deviceType: device.deviceType,
              brand: device.brand,
              model: device.model,
              issue: device.issue,
              description: device.description || '',
              accessType: device.accessType || 'none',
              accessPassword: device.accessPassword || undefined,
              priority: data.priority,
              urgency,
              technician_id: device.technician,
              estimated_cost: device.estimatedCost || 0,
              laborCost: data.laborCost || 0,
              finalCost: data.finalCost,
              warrantyMonths: data.warrantyMonths,
              warrantyType: data.warrantyType,
              warrantyNotes: data.warrantyNotes,
              parts: data.parts || [],
              notes: data.notes || [],
            }

            const created = await createRepair(payload)

            if (created?.id && Array.isArray(device.images) && device.images.length > 0) {
              await addImages(created.id, device.images, 'general')
            }

            return created
          })
        )

        const validRepairs = createdRepairs.filter(Boolean)

        if (validRepairs.length === 0) {
          return false
        }

        if (validRepairs.length !== createdRepairs.length) {
          toast.warning(`Se crearon ${validRepairs.length} de ${createdRepairs.length} reparaciones. Revisá el listado antes de reintentar.`)
          return true
        }

        return true
      } else if (selectedRepair) {
        const device = data.devices[0]
        const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'

        const updatePayload: TechnicianRepairUpdatePayload = {
          brand: device.brand,
          model: device.model,
          deviceType: device.deviceType,
          issue: device.issue,
          description: device.description,
          accessType: device.accessType || 'none',
          accessPassword: device.accessPassword || null,
          priority: data.priority,
          urgency,
          estimatedCost: device.estimatedCost,
          laborCost: data.laborCost || 0,
          finalCost: data.finalCost,
          warrantyMonths: data.warrantyMonths,
          warrantyType: data.warrantyType,
          warrantyNotes: data.warrantyNotes,
          customer_id: data.existingCustomerId || undefined,
          technician_id: device.technician || undefined,
          parts: data.parts || [],
          notes: data.notes || [],
          images: Array.isArray(device.images) ? device.images : [],
        }

        const updated = await updateRepair(selectedRepair.id, updatePayload)
        return Boolean(updated)
      }
    } catch (error) {
      logger.error('Error submitting technician form', { error })
      return false
    }

    return false
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !isDialogOpen) {
        event.preventDefault()
        const input = document.getElementById('technician-search-input') as HTMLInputElement | null
        input?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDialogOpen])

  const initialFormData: Partial<RepairFormData> | undefined = selectedRepair
    ? {
        existingCustomerId: selectedRepair.customer.id,
        customerName: selectedRepair.customer.name,
        customerPhone: selectedRepair.customer.phone,
        customerEmail: selectedRepair.customer.email,
        priority: selectedRepair.priority,
        urgency: selectedRepair.urgency === 'urgent' ? 'high' : 'medium',
        devices: [
          {
            deviceType: selectedRepair.deviceType,
            brand: selectedRepair.brand,
            model: selectedRepair.model,
            issue: selectedRepair.issue,
            description: selectedRepair.description,
            accessType: selectedRepair.accessType || 'none',
            accessPassword: selectedRepair.accessPassword || '',
            technician: selectedRepair.technician?.id || '',
            estimatedCost: selectedRepair.estimatedCost,
            images: selectedRepair.images?.map((image) => image.url) || [],
          },
        ],
        parts: (selectedRepair.parts || []).map((part) => ({
          id: part.id,
          name: part.name,
          cost: part.cost,
          quantity: part.quantity,
          supplier: part.supplier || '',
          partNumber: part.partNumber || '',
        })),
        notes: (selectedRepair.notes || []).map((note) => ({
          id: note.id,
          text: note.text,
          isInternal: note.isInternal ?? false,
        })),
        laborCost: selectedRepair.laborCost || 0,
        finalCost: selectedRepair.finalCost,
        warrantyMonths: selectedRepair.warrantyMonths ?? 3,
        warrantyType: selectedRepair.warrantyType || 'full',
        warrantyNotes: selectedRepair.warrantyNotes || '',
      }
    : undefined

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Metricas de Reparaciones</h2>
            <p className="text-sm text-muted-foreground">
              {showMyRepairsOnly ? 'Estado actual de tus reparaciones' : 'Estado actual del tablero tecnico'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshRepairs}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              onClick={() => {
                setDialogMode('add')
                setSelectedRepair(undefined)
                setIsDialogOpen(true)
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Reparacion
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Reparaciones"
            value={stats.total}
            subtitle="En el sistema"
            icon={Wrench}
            color="blue"
          />
          <StatsCard
            title="En Proceso"
            value={stats.inProgress}
            subtitle="Trabajando ahora"
            icon={Activity}
            color="orange"
          />
          <StatsCard
            title="Completadas"
            value={stats.completed}
            subtitle="Listas para entregar"
            icon={CheckCircle2}
            color="green"
          />
          <StatsCard
            title="Urgentes"
            value={stats.urgent}
            subtitle="Requieren atencion"
            icon={AlertCircle}
            color="red"
          />
        </div>
      </section>

      <section>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <TechnicianFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showMyRepairsOnly={showMyRepairsOnly}
                setShowMyRepairsOnly={setShowMyRepairsOnly}
                canViewAllRepairs={canViewAllRepairs}
                onRefresh={refreshRepairs}
                isLoading={isLoading}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="gap-2"
                >
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
            onDragStart={onDragStart}
            onDropTo={onDropTo}
            onEdit={handleEditRepair}
            onView={handleViewRepair}
            showMyRepairsOnly={showMyRepairsOnly}
          />
        ) : (
          <RepairList
            repairs={filteredRepairs}
            onEdit={handleEditRepair}
            onView={handleViewRepair}
          />
        )}
      </section>

      <RepairFormDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        mode={dialogMode}
        repair={selectedRepair}
        onSubmit={handleFormSubmit}
        initialData={initialFormData}
        technicians={technicianOptions}
      />

      <RepairDetailDialog
        open={isDetailOpen}
        repair={detailRepair}
        onClose={() => setIsDetailOpen(false)}
        onEdit={(repair) => {
          setIsDetailOpen(false)
          handleEditRepair(repair)
        }}
      />
    </div>
  )
}
