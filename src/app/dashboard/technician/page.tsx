'use client'

import { useState, useMemo, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { mapLegacyRoleToOrganizationRole, roleHasPermission } from '@/lib/saas/permissions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  Plus,
  RefreshCw,
  Wrench,
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
import { RepairDeliveryDialog } from '@/components/dashboard/repairs/RepairDeliveryDialog'
import { cn } from '@/lib/utils'

type TechnicianRepairUpdatePayload = Omit<Partial<Repair>, 'images' | 'parts' | 'notes'> & {
  customer_id?: string
  technician_id?: string
  images?: string[]
  parts?: RepairFormData['parts']
  notes?: RepairFormData['notes']
}

// ---------------------------------------------------------------------------
// Hero metric
// ---------------------------------------------------------------------------

type Tone = 'indigo' | 'amber' | 'emerald' | 'red'

const toneClasses: Record<Tone, { wrap: string; iconBg: string }> = {
  indigo:  { wrap: 'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',  iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  amber:   { wrap: 'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',     iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  emerald: { wrap: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  red:     { wrap: 'from-red-500/10 to-transparent border-red-200/50 dark:border-red-900/50',           iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

function MetricCard({
  label, value, sub, icon: Icon, tone,
}: {
  label: string
  value: number | string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}) {
  const t = toneClasses[tone]
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-gradient-to-br p-5', t.wrap)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TechnicianPanel() {
  // Declarado antes del hook para poder pasárselo como callback de "soltaste
  // una tarjeta en Entregado": abre el diálogo de entrega en vez de marcar
  // entregado en silencio con el drag.
  const [deliverTarget, setDeliverTarget] = useState<Repair | null>(null)

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
    updateStatus,
    deliverRepair,
  } = useTechnicianBoard({ onRequestDeliver: setDeliverTarget })

  const { technicians } = useTechnicians()

  // El rol 'technician' (SaaS) no tiene 'repairs.orders.create' — solo
  // 'read'/'update'. Quien registra el ingreso de un equipo es vendedor,
  // manager o admin; el técnico gestiona lo que ya está creado. Sin este
  // chequeo, un técnico podía completar todo el formulario de alta y
  // recibir un 403 recién al enviarlo.
  const { user } = useAuth()
  const canCreateRepair = roleHasPermission(
    mapLegacyRoleToOrganizationRole(user?.role),
    'repairs.orders.create'
  )

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

  // Métricas sobre el dataset completo (respeta "solo mis reparaciones" del hook),
  // no sobre el resultado de la búsqueda de texto — así los totales no cambian al buscar.
  const stats = useMemo(() => {
    const total = repairs.length
    const pending = repairs.filter((repair) => repair.dbStatus === 'recibido').length
    const inProgress = repairs.filter(
      (repair) => repair.dbStatus === 'reparacion' || repair.dbStatus === 'diagnostico'
    ).length
    const completed = repairs.filter(
      (repair) => repair.dbStatus === 'listo' || repair.dbStatus === 'entregado'
    ).length
    const urgent = repairs.filter(
      (repair) =>
        repair.urgency === 'urgent' &&
        repair.dbStatus !== 'listo' &&
        repair.dbStatus !== 'entregado'
    ).length

    return { total, pending, inProgress, completed, urgent }
  }, [repairs])

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
        const hasSharedRepairData =
          data.devices.length > 1 &&
          (
            (data.parts?.length ?? 0) > 0 ||
            (data.notes?.length ?? 0) > 0 ||
            (data.laborCost ?? 0) > 0 ||
            data.finalCost !== null
          )

        if (hasSharedRepairData) {
          toast.error('Para varios dispositivos, crea una reparación por equipo si necesitas repuestos, notas o costos distintos.')
          return false
        }

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
        customerDocument: selectedRepair.customer.ruc || '',
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
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Wrench className="h-3.5 w-3.5" />
            Panel técnico
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {showMyRepairsOnly ? 'Mis reparaciones' : 'Tablero de reparaciones'}
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {showMyRepairsOnly
              ? 'Reparaciones asignadas a tu cuenta. Arrastrá para cambiar el estado.'
              : 'Vista global del estado de todas las reparaciones del equipo.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={refreshRepairs}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
          {canCreateRepair && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setDialogMode('add')
                setSelectedRepair(undefined)
                setIsDialogOpen(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva reparación
            </Button>
          )}
        </div>
      </header>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          value={stats.total}
          sub="reparaciones en el sistema"
          icon={Wrench}
          tone="indigo"
        />
        <MetricCard
          label="En proceso"
          value={stats.inProgress}
          sub="trabajando ahora"
          icon={Activity}
          tone="amber"
        />
        <MetricCard
          label="Completadas"
          value={stats.completed}
          sub="listas para entregar"
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          label="Urgentes"
          value={stats.urgent}
          sub={stats.urgent > 0 ? 'requieren atención' : 'sin urgencias'}
          icon={AlertCircle}
          tone={stats.urgent > 0 ? 'red' : 'emerald'}
        />
      </section>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="w-full lg:flex-1">
              <TechnicianFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showMyRepairsOnly={showMyRepairsOnly}
                setShowMyRepairsOnly={setShowMyRepairsOnly}
                canViewAllRepairs={canViewAllRepairs}
                onRefresh={refreshRepairs}
                isLoading={isLoading}
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Lista
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Board */}
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
        onDeliver={(repair) => setDeliverTarget(repair)}
        onStatusChange={updateStatus}
      />

      <RepairDeliveryDialog
        open={!!deliverTarget}
        repair={deliverTarget}
        onOpenChange={(open) => !open && setDeliverTarget(null)}
        onConfirm={async (id, payload) => { await deliverRepair(id, payload.outcome, payload.note) }}
        allowPayment={false}
      />
    </div>
  )
}
