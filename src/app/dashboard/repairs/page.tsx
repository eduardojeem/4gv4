'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import type { DateRange } from 'react-day-picker'

// Icons
import {
  Plus, Download, Users, BarChart3, MessageSquare, Package, RefreshCw
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { GlobalSearch } from '@/components/ui/global-search'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KanbanSkeleton, CalendarSkeleton } from '@/components/ui/skeleton-loader'

// Custom Hooks
import { useRepairs } from '@/contexts/RepairsContext'
import { useTechnicians } from '@/hooks/use-technicians'
import { useComponentPreload, useAutoPreload } from '@/hooks/use-component-preload'
import { useRepairFilters } from '@/hooks/use-repair-filters'

// Repair Components
import { RepairStats } from '@/components/dashboard/repairs/RepairStats'
import { RepairFilters } from '@/components/dashboard/repairs/RepairFilters'
import { RepairList } from '@/components/dashboard/repairs/RepairList'
import { RepairHeader } from '@/components/dashboard/repairs/RepairHeader'
import { QuickAccessNav } from '@/components/dashboard/repairs/QuickAccessNav'
import { RepairViewSelector } from '@/components/dashboard/repairs/RepairViewSelector'
import { RepairEmptyState } from '@/components/dashboard/repairs/RepairEmptyState'
import { RepairDeleteDialog } from '@/components/dashboard/repairs/RepairDeleteDialog'
import { RepairDetailDialog } from '@/components/dashboard/repairs/RepairDetailDialog'
import { RepairSuccessDialog } from '@/components/dashboard/repairs/RepairSuccessDialog'
import { RepairFormDialogV2 as RepairFormDialog, RepairFormMode } from '@/components/dashboard/repair-form-dialog-v2'
import type { RepairFormData } from '@/schemas'
import type { RepairFormData as PersistRepairFormData } from '@/contexts/RepairsContext'
import { RepairPrintPayload } from '@/lib/repair-receipt'
import { deviceTypeConfig } from '@/config/repair-constants'

// Types
import { Repair } from '@/types/repairs'

// Code splitting: Cargar componentes pesados bajo demanda
// Mejora el tiempo de carga inicial y reduce el bundle size
// (ya importado arriba)

const RepairKanban = dynamic(
  () => import('@/components/dashboard/repairs/RepairKanban').then(mod => ({ default: mod.RepairKanban })),
  {
    loading: () => <KanbanSkeleton />,
    ssr: false // No renderizar en servidor (componente interactivo)
  }
)

const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(mod => ({ default: mod.Calendar })),
  {
    loading: () => <CalendarSkeleton />,
    ssr: false // No renderizar en servidor
  }
)

function RepairsPageContent() {
  const router = useRouter()
  const {
    repairs,
    isLoading,
    updateStatus,
    createRepair,
    updateRepair,
    deleteRepair,
    refreshRepairs,
    addImages
  } = useRepairs()

  const { technicians, isLoading: isLoadingTechs } = useTechnicians()

  // New unified filter hook
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    technicianFilter,
    setTechnicianFilter,
    dateRange,
    setDateRange,
    filteredRepairs,
    activeFiltersCount
  } = useRepairFilters({ repairs })

  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>('table')
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<RepairFormMode>('add')
  const [selectedRepair, setSelectedRepair] = useState<Repair | undefined>(undefined)
  const [detailRepair, setDetailRepair] = useState<Repair | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<number>(20)
  const [searchOpen, setSearchOpen] = useState(false)
  const [successDialogData, setSuccessDialogData] = useState<RepairPrintPayload | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const searchParams = useSearchParams()

  // Handle URL query parameters for direct edit
  useEffect(() => {
    if (isLoading || repairs.length === 0) return

    const editId = searchParams.get('id')
    const isEdit = searchParams.get('edit') === 'true'

    if (editId && isEdit && !isDialogOpen) {
      const repairToEdit = repairs.find(r => r.id === editId)
      if (repairToEdit) {
        setSelectedRepair(repairToEdit)
        setDialogMode('edit')
        setIsDialogOpen(true)
      }
    }
  }, [isLoading, repairs, searchParams, isDialogOpen])

  // Preload: Precargar componentes pesados para mejorar UX
  const preload = useComponentPreload({
    kanban: () => import('@/components/dashboard/repairs/RepairKanban'),
    calendar: () => import('@/components/ui/calendar'),
  })

  // Auto-preload: Precargar componentes después de 3 segundos (cuando el usuario ya está navegando)
  useAutoPreload({
    kanban: () => import('@/components/dashboard/repairs/RepairKanban'),
    calendar: () => import('@/components/ui/calendar'),
  }, 3000)

  // Optimized technician options with memoization
  const technicianOptions = useMemo(() => {
    if (technicians.length > 0) {
      return technicians.map(t => ({ id: t.id, name: t.name || t.full_name }))
    }
    
    // Use Map for better performance with large datasets
    const techMap = new Map<string, string>()
    for (const repair of repairs) {
      if (repair.technician?.id && !techMap.has(repair.technician.id)) {
        techMap.set(repair.technician.id, repair.technician.name || repair.technician.id)
      }
    }
    
    return Array.from(techMap.entries()).map(([id, name]) => ({ id, name }))
  }, [repairs, technicians])

  // The filteredRepairs from useRepairFilters already handles all filtering
  // Remove duplicate filtering logic
  const uiFiltered = filteredRepairs

  // Optimize visible repairs calculation
  const visibleRepairs = useMemo(() => {
    return uiFiltered.slice(0, pageSize)
  }, [uiFiltered, pageSize])

  // Optimized callbacks with proper dependencies
  const handleCalendarSelect = useCallback((d?: Date) => {
    setCalendarDate(d)
  }, [])

  const handleNewRepair = useCallback(() => {
    setDialogMode('add')
    setSelectedRepair(undefined)
    setIsDialogOpen(true)
  }, [])

  const handleEditRepair = useCallback((repair: Repair) => {
    setDialogMode('edit')
    setSelectedRepair(repair)
    setIsDialogOpen(true)
  }, [])

  const handleViewRepair = useCallback((repair: Repair) => {
    setDetailRepair(repair)
    setIsDetailOpen(true)
  }, [])

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteId(id)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (deleteId) {
      try {
        await deleteRepair(deleteId)
        setDeleteId(null)
      } catch (error) {
        console.error('Error deleting repair:', error)
        // Error is already handled in deleteRepair function
      }
    }
  }, [deleteId, deleteRepair])

  const handleFormSubmit = useCallback(async (data: RepairFormData) => {
    try {
      if (dialogMode === 'add') {
        // Handle multiple devices - create one repair per device
        const promises = data.devices.map(async (d) => {
          const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'
          const payload: PersistRepairFormData = {
            customer_id: data.existingCustomerId || '',
            device: `${d.brand} ${d.model}`.trim(),
            deviceType: d.deviceType,
            brand: d.brand,
            model: d.model,
            issue: d.issue,
            description: d.description || '',
            accessType: d.accessType || 'none',
            accessPassword: d.accessPassword || undefined,
            priority: data.priority,
            urgency,
            technician_id: d.technician,
            estimated_cost: d.estimatedCost || 0
          }
          const created = await createRepair(payload)
          if (created?.id && Array.isArray(d.images) && d.images.length > 0) {
            await addImages(created.id, d.images, 'general')
          }
          return created
        })

        const createdRepairs = await Promise.all(promises)

        // Show success dialog with print options
        const validRepairs = createdRepairs.filter(Boolean) as Repair[]
        if (validRepairs.length > 0) {
          const payload: RepairPrintPayload = {
            customer: {
              name: data.customerName,
              phone: data.customerPhone,
              email: data.customerEmail,
              address: data.customerAddress,
              document: data.customerDocument,
              city: data.customerCity,
              country: data.customerCountry
            },
            date: new Date(),
            ticketNumber: validRepairs.length === 1 ? validRepairs[0].id : undefined,
            priority: data.priority,
            urgency: data.urgency,
            devices: data.devices.map((deviceFormData, index) => {
              const createdRepair = createdRepairs[index]
              if (!createdRepair) return null

              const techName = technicianOptions.find(t => t.id === deviceFormData.technician)?.name || 'Sin asignar'
              
              return {
                typeLabel: deviceTypeConfig[deviceFormData.deviceType]?.label || deviceFormData.deviceType,
                brand: deviceFormData.brand,
                model: deviceFormData.model,
                issue: deviceFormData.issue,
                description: deviceFormData.description,
                technician: techName,
                estimatedCost: deviceFormData.estimatedCost,
                ticketNumber: createdRepair.id
              }
            }).filter(Boolean) as any
          }
          setSuccessDialogData(payload)
          setShowSuccessDialog(true)
        }
      } else if (selectedRepair) {
        const d = data.devices[0]
        const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'

        const updatePayload: Partial<Repair> = {
          brand: d.brand,
          model: d.model,
          deviceType: d.deviceType,
          issue: d.issue,
          description: d.description,
          accessType: d.accessType || 'none',
          accessPassword: d.accessPassword || null,
          priority: data.priority,
          urgency,
          estimatedCost: d.estimatedCost,
          laborCost: data.laborCost || 0,
          finalCost: data.finalCost,
          technician: d.technician ? { id: d.technician, name: '' } : undefined
        }
        
        await updateRepair(selectedRepair.id, updatePayload)
      }
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Error al guardar la reparación')
    }
  }, [dialogMode, selectedRepair, createRepair, updateRepair, addImages, technicianOptions])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New repair
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewRepair()
      }
      // /: Focus search
      if (e.key === '/' && !isDialogOpen) {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Buscar"]') as HTMLInputElement
        searchInput?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDialogOpen, handleNewRepair])

  // Helper to map Repair to RepairFormData for editing
  const initialFormData: Partial<RepairFormData> | undefined = selectedRepair ? {
    existingCustomerId: selectedRepair.customer.id,
    customerName: selectedRepair.customer.name,
    customerPhone: selectedRepair.customer.phone,
    customerEmail: selectedRepair.customer.email,
    priority: selectedRepair.priority,
    urgency: selectedRepair.urgency === 'urgent' ? 'high' : 'medium',
    laborCost: selectedRepair.laborCost || 0,
    finalCost: selectedRepair.finalCost,
    devices: [{
      deviceType: selectedRepair.deviceType,
      brand: selectedRepair.brand,
      model: selectedRepair.model,
      issue: selectedRepair.issue,
      description: selectedRepair.description,
      accessType: selectedRepair.accessType || 'none',
      accessPassword: selectedRepair.accessPassword || '',
      technician: selectedRepair.technician?.id || '',
      estimatedCost: selectedRepair.estimatedCost,
      images: []
    }]
  } : undefined

  // Quick access navigation items
  const quickAccessSections = [
    {
      title: 'Técnicos',
      description: 'Gestionar equipo técnico',
      icon: Users,
      path: '/dashboard/repairs/technicians',
      color: 'blue' as const
    },
    {
      title: 'Analíticas',
      description: 'Reportes y métricas',
      icon: BarChart3,
      path: '/dashboard/repairs/analytics',
      color: 'purple' as const
    },
    {
      title: 'Comunicaciones',
      description: 'Mensajes y notificaciones',
      icon: MessageSquare,
      path: '/dashboard/repairs/communications',
      color: 'green' as const
    },
    {
      title: 'Inventario',
      description: 'Piezas y repuestos',
      icon: Package,
      path: '/dashboard/repairs/inventory',
      color: 'orange' as const
    }
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <RepairHeader
        onRefresh={refreshRepairs}
        onNewRepair={handleNewRepair}
        isLoading={isLoading}
      />

      <QuickAccessNav sections={quickAccessSections} />

      <RepairStats repairs={repairs} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <RepairFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={(p) => setPriorityFilter(p as 'low' | 'medium' | 'high' | 'all')}
            technicians={technicians}
            technicianFilter={technicianFilter}
            setTechnicianFilter={setTechnicianFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onOpenSearch={() => setSearchOpen(true)}
          />
          <div className="flex md:items-center">
            <RepairViewSelector
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onPreload={(view) => preload(view)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando reparaciones...</p>
            </div>
          </div>
        ) : uiFiltered.length === 0 ? (
          <RepairEmptyState
            hasFilters={!!(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all')}
            onNewRepair={handleNewRepair}
          />
        ) : viewMode === 'table' ? (
          <RepairList
            repairs={visibleRepairs}
            onStatusChange={updateStatus}
            onEdit={handleEditRepair}
            onView={handleViewRepair}
            onDelete={handleDeleteClick}
            isLoading={false}
          />
        ) : viewMode === 'kanban' ? (
          <div className="h-[calc(100vh-300px)] min_h-[500px]">
            <RepairKanban
              repairs={uiFiltered}
              onStatusChange={async (id, status) => { await updateStatus(id, status) }}
              onEdit={handleEditRepair}
              onView={handleViewRepair}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 rounded-lg border p-3">
              <Calendar mode="single" selected={calendarDate} onSelect={handleCalendarSelect} />
            </div>
            <div className="lg:col-span-2 rounded-lg border p-3 space-y-2">
              {uiFiltered.filter(r => {
                if (!calendarDate) return true
                const d = new Date(r.createdAt)
                return d.toDateString() === calendarDate.toDateString()
              }).map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{r.customer.name} • {r.device}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleEditRepair(r)}>Programar</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RepairFormDialog
        open={isDialogOpen}
        mode={dialogMode}
        technicians={technicianOptions}
        initialData={initialFormData}
        repair={selectedRepair}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <RepairSuccessDialog
        open={showSuccessDialog}
        onClose={() => {
          setShowSuccessDialog(false)
          setSuccessDialogData(null)
        }}
        data={successDialogData}
      />

      {uiFiltered.length > visibleRepairs.length && viewMode === 'table' && (
        <div className="flex items-center justify-center">
          <Button variant="outline" onClick={() => setPageSize(s => s + 20)}>Cargar más</Button>
        </div>
      )}

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSearch={useCallback(({ query }: { query: string }) => {
          if (!query || query.length < 2) return []
          
          const q = query.toLowerCase()
          const results: Array<{ title: string; subtitle: string; href: string }> = []
          
          // Optimize search with early termination
          for (const repair of uiFiltered) {
            if (results.length >= 10) break
            
            const customerName = repair.customer.name.toLowerCase()
            const device = repair.device.toLowerCase()
            const id = repair.id.toLowerCase()
            
            if (customerName.includes(q) || device.includes(q) || id.includes(q)) {
              results.push({
                title: `${repair.customer.name} • ${repair.device}`,
                subtitle: `${repair.id} • ${repair.status}`,
                href: `/dashboard/repairs?search=${encodeURIComponent(repair.id)}`
              })
            }
          }
          
          return results
        }, [uiFiltered])}
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

      <RepairDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default function RepairsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando página...</p>
        </div>
      </div>
    }>
      <RepairsPageContent />
    </Suspense>
  )
}
