'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

// Icons
import {
  Users, BarChart3, MessageSquare, Package, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { GlobalSearch } from '@/components/ui/global-search'
import { KanbanSkeleton, CalendarSkeleton } from '@/components/ui/skeleton-loader'

// Custom Hooks
import { useRepairs } from '@/contexts/RepairsContext'
import { useTechnicians } from '@/hooks/use-technicians'
import { useComponentPreload, useAutoPreload } from '@/hooks/use-component-preload'
import { useRepairFilters } from '@/hooks/use-repair-filters'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'

// Repair Components
import { RepairStats } from '@/components/dashboard/repairs/RepairStats'
import { RepairFilters } from '@/components/dashboard/repairs/RepairFilters'
import { RepairList } from '@/components/dashboard/repairs/RepairList'
import { RepairHeader } from '@/components/dashboard/repairs/RepairHeader'
import { QuickAccessNav } from '@/components/dashboard/repairs/QuickAccessNav'
import { RepairViewSelector } from '@/components/dashboard/repairs/RepairViewSelector'
import { RepairOperationsOverview } from '@/components/dashboard/repairs/RepairOperationsOverview'
import { RepairEmptyState } from '@/components/dashboard/repairs/RepairEmptyState'
import { RepairDeleteDialog } from '@/components/dashboard/repairs/RepairDeleteDialog'
import { RepairDetailDialog } from '@/components/dashboard/repairs/RepairDetailDialog'
import { RepairSuccessDialog } from '@/components/dashboard/repairs/RepairSuccessDialog'
import { RepairCardsView } from '@/components/dashboard/repairs/RepairCardsView'
import { RepairDeliveryDialog } from '@/components/dashboard/repairs/RepairDeliveryDialog'
import { RepairPaymentDialog, type RepairPaymentResult } from '@/components/dashboard/repairs/RepairPaymentDialog'
import { RepairFormDialogV2 as RepairFormDialog, RepairFormMode } from '@/components/dashboard/repair-form-dialog-v2'
import type { RepairFormData } from '@/schemas'
import type { RepairFormData as PersistRepairFormData } from '@/contexts/RepairsContext'
import { RepairPrintPayload } from '@/lib/repair-receipt'
import { deviceTypeConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'

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
    deliverRepair,
    createRepair,
    updateRepair,
    deleteRepair,
    refreshRepairs,
    addImages
  } = useRepairs()

  const { technicians } = useTechnicians()
  const { settings: sharedSettings } = useSharedSettings()
  const { selectedBranchId, selectedBranch } = useBranch()

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
    filteredRepairs
  } = useRepairFilters({ repairs })

  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'kanban' | 'calendar'>('table')
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<RepairFormMode>('add')
  const [selectedRepair, setSelectedRepair] = useState<Repair | undefined>(undefined)
  const [detailRepair, setDetailRepair] = useState<Repair | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deliverTarget, setDeliverTarget] = useState<Repair | null>(null)
  const [payTarget, setPayTarget] = useState<Repair | null>(null)
  const [pageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [searchOpen, setSearchOpen] = useState(false)
  const [successDialogData, setSuccessDialogData] = useState<RepairPrintPayload | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [quickAccessOpen, setQuickAccessOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const searchParams = useSearchParams()
  const requestedTechnicianId = searchParams.get('technician') || ''
  const shouldOpenNewRepair = searchParams.get('new') === 'true'

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false)
    setSelectedRepair(undefined)

    const params = new URLSearchParams(searchParams.toString())
    const hadEditParams = params.has('id') || params.has('edit')
    const hadCreateParams = params.has('new') || params.has('technician')

    if (hadEditParams) {
      params.delete('id')
      params.delete('edit')
    }

    if (hadCreateParams) {
      params.delete('new')
      params.delete('technician')
    }

    if (hadEditParams || hadCreateParams) {
      const query = params.toString()
      router.replace(query ? `/dashboard/repairs?${query}` : '/dashboard/repairs')
    }
  }, [router, searchParams])

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

  useEffect(() => {
    if (isLoading || isDialogOpen) return
    if (!shouldOpenNewRepair) return

    setDialogMode('add')
    setSelectedRepair(undefined)
    setIsDialogOpen(true)
  }, [isLoading, isDialogOpen, shouldOpenNewRepair])

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

  // Optimize visible repairs calculation with pagination
  const totalPages = Math.ceil(uiFiltered.length / pageSize)
  const visibleRepairs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return uiFiltered.slice(start, start + pageSize)
  }, [uiFiltered, currentPage, pageSize])
  const visibleRangeStart = uiFiltered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const visibleRangeEnd = uiFiltered.length === 0
    ? 0
    : Math.min(currentPage * pageSize, uiFiltered.length)

  const repairPulse = useMemo(() => {
    const activeRepairs = repairs.filter((repair) => repair.status !== 'entregado' && repair.status !== 'cancelado')
    const urgentRepairs = activeRepairs.filter((repair) => repair.urgency === 'urgent')
    const readyRepairs = repairs.filter((repair) => repair.status === 'listo')
    return {
      activeRepairs: activeRepairs.length,
      urgentRepairs: urgentRepairs.length,
      readyRepairs: readyRepairs.length,
    }
  }, [repairs])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, priorityFilter, technicianFilter, dateRange])

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
        logger.error('Error deleting repair', { error })
        // Error is already handled in deleteRepair function
      }
    }
  }, [deleteId, deleteRepair])

  const handleQuickPayConfirm = useCallback(async (repairId: string, result: RepairPaymentResult) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const updateData: Record<string, unknown> = {
        payment_status: 'pagado',
        paid_amount: result.amount,
        updated_at: new Date().toISOString(),
      }

      if (result.markDelivered) {
        const now = new Date().toISOString()
        updateData.status = 'entregado'
        updateData.picked_up_at = now
        updateData.completed_at = now
        updateData.delivery_outcome = result.outcome || 'repaired'
      }

      if (result.note) {
        updateData.solution = result.note
      }

      let updateQuery = supabase.from('repairs').update(updateData).eq('id', repairId)
      updateQuery = withBranchFilter(updateQuery, selectedBranchId)
      const { error } = await updateQuery
      if (error) throw error

      await refreshRepairs()
      toast.success(result.markDelivered ? 'Pago registrado y equipo entregado' : 'Pago registrado exitosamente')
    } catch (err) {
      logger.error('Error registering payment', { error: err })
      toast.error('Error al registrar el pago')
      throw err
    }
  }, [refreshRepairs, selectedBranchId])

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
            estimated_cost: d.estimatedCost || 0,
            laborCost: data.laborCost || 0,
            finalCost: data.finalCost,
            warrantyMonths: data.warrantyMonths,
            warrantyType: data.warrantyType,
            warrantyNotes: data.warrantyNotes,
            parts: data.parts || [],
            notes: data.notes || []
          }
          const created = await createRepair(payload)
          if (created?.id && Array.isArray(d.images) && d.images.length > 0) {
            await addImages(created.id, d.images, 'general')
          }
          return created
        })

        const creationResults = await Promise.allSettled(promises)
        const createdRepairs = creationResults.map((result) =>
          result.status === 'fulfilled' ? result.value : null
        )
        const failedCount = creationResults.filter((result) => result.status === 'rejected').length +
          createdRepairs.filter((repair) => !repair).length

        // Show success dialog with print options
        const validRepairs = createdRepairs.filter(Boolean) as Repair[]
        if (validRepairs.length === 0) {
          toast.error('No se pudo crear ninguna reparacion. Revisa los datos e intenta de nuevo.')
          return false
        }

        if (failedCount > 0) {
          toast.warning(`Se crearon ${validRepairs.length} de ${createdRepairs.length} reparaciones. Revisá el listado antes de reintentar.`)
          return true
        }

        if (validRepairs.length > 0) {
          
          let verificationHash: string | undefined = undefined
          let dateObj = new Date()

          // If single repair, fetch secure hash from server
          if (validRepairs.length === 1) {
            const repair = validRepairs[0]
            const ticketNum = repair.ticketNumber || repair.id
            const customerName = repair.customer?.name || data.customerName
            dateObj = new Date(repair.createdAt) // Use DB timestamp for consistency

            try {
              const res = await fetch('/api/repairs/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ticketNumber: ticketNum,
                  customerName: customerName,
                  date: dateObj.toISOString()
                })
              })
              const json = await res.json()
              if (json.success) {
                verificationHash = json.hash
              }
            } catch (e) {
              logger.error('Failed to sign ticket', { error: e })
            }
          }

          const payload: RepairPrintPayload = {
            customer: {
              id: validRepairs[0]?.customer?.id || data.existingCustomerId,
              name: data.customerName,
              phone: data.customerPhone,
              email: data.customerEmail,
              address: data.customerAddress,
              document: data.customerDocument,
              city: data.customerCity,
              country: data.customerCountry
            },
            date: dateObj,
            ticketNumber: validRepairs.length === 1 ? (validRepairs[0].ticketNumber || validRepairs[0].id) : undefined,
            priority: data.priority,
            urgency: data.urgency,
            warrantyMonths: data.warrantyMonths,
            warrantyType: data.warrantyType,
            warrantyNotes: data.warrantyNotes,
            verificationHash,
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
                ticketNumber: createdRepair.ticketNumber || createdRepair.id
              }
            }).filter((device): device is NonNullable<typeof device> => device !== null)
          }
          setSuccessDialogData(payload)
          setShowSuccessDialog(true)
        }
        return true
      } else if (selectedRepair) {
        const d = data.devices[0]
        const urgency: 'urgent' | 'normal' = data.urgency === 'high' ? 'urgent' : 'normal'

        const updatePayload: Omit<Partial<Repair>, 'images' | 'parts' | 'notes'> & {
          customer_id?: string
          technician_id?: string
          parts?: RepairFormData['parts']
          notes?: RepairFormData['notes']
          images?: string[]
        } = {
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
          warrantyMonths: data.warrantyMonths,
          warrantyType: data.warrantyType,
          warrantyNotes: data.warrantyNotes,
          customer_id: data.existingCustomerId || undefined,
          technician_id: d.technician || undefined,
          parts: data.parts || [],
          notes: data.notes || [],
          images: Array.isArray(d.images) ? d.images : []
        }
        
        const updated = await updateRepair(selectedRepair.id, updatePayload)
        return Boolean(updated)
      }
    } catch (error) {
      logger.error('Error submitting repair form', { error })
      return false
    }
    return false
  }, [dialogMode, selectedRepair, createRepair, updateRepair, addImages, technicianOptions])

  const handleGlobalSearch = useCallback(({ query }: { query: string }) => {
    if (!query || query.length < 2) return []
    
    const q = query.toLowerCase()
    const results: Array<{ title: string; subtitle: string; href: string }> = []
    
    for (const repair of repairs) {
      if (results.length >= 10) break
      
      const customerName = repair.customer.name.toLowerCase()
      const device = repair.device.toLowerCase()
      const id = repair.id.toLowerCase()
      const ticket = (repair.ticketNumber || '').toLowerCase()
      
      if (customerName.includes(q) || device.includes(q) || id.includes(q) || ticket.includes(q)) {
        results.push({
          title: `${repair.customer.name} • ${repair.device}`,
          subtitle: `${repair.ticketNumber || repair.id.slice(0, 8)} • ${repair.status}`,
          href: `/dashboard/repairs?search=${encodeURIComponent(repair.id)}`
        })
      }
    }
    
    return results
  }, [repairs])

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
  const initialFormData: Partial<RepairFormData> | undefined = useMemo(() => {
    if (selectedRepair) {
      return {
        existingCustomerId: selectedRepair.customer.id,
        customerName: selectedRepair.customer.name,
        customerPhone: selectedRepair.customer.phone,
        customerEmail: selectedRepair.customer.email,
        priority: selectedRepair.priority,
        urgency: selectedRepair.urgency === 'urgent' ? 'high' : 'medium',
        laborCost: selectedRepair.laborCost || 0,
        finalCost: selectedRepair.finalCost,
        warrantyMonths: selectedRepair.warrantyMonths ?? 3,
        warrantyType: selectedRepair.warrantyType || 'full',
        warrantyNotes: selectedRepair.warrantyNotes || '',
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
          images: Array.isArray(selectedRepair.images) ? selectedRepair.images.map(img => img.url) : []
        }],
        parts: selectedRepair.parts || [],
        notes: (selectedRepair.notes || []).map(n => ({ text: n.text, isInternal: n.isInternal ?? false, id: n.id }))
      }
    }

    if (shouldOpenNewRepair && requestedTechnicianId) {
      return {
        priority: 'medium',
        urgency: 'medium',
        devices: [{
          deviceType: 'smartphone',
          brand: '',
          model: '',
          issue: '',
          description: '',
          accessType: 'none',
          images: [],
          technician: requestedTechnicianId,
          estimatedCost: 0
        }]
      }
    }

    return undefined
  }, [requestedTechnicianId, selectedRepair, shouldOpenNewRepair])

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

  const calendarRepairs = useMemo(() => {
    return uiFiltered.filter(r => {
      if (!calendarDate) return true
      // Use estimatedCompletion if available, fall back to createdAt
      const dateStr = r.estimatedCompletion || r.createdAt
      const d = new Date(dateStr)
      return d.toDateString() === calendarDate.toDateString()
    })
  }, [uiFiltered, calendarDate])

  const repairListCompanyInfo = useMemo(() => ({
    name: sharedSettings.companyName,
    phone: sharedSettings.companyPhone,
    address: sharedSettings.companyAddress,
    email: sharedSettings.companyEmail
  }), [
    sharedSettings.companyAddress,
    sharedSettings.companyEmail,
    sharedSettings.companyName,
    sharedSettings.companyPhone
  ])
  const hasActiveFilters = !!(
    searchTerm ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    (technicianFilter && technicianFilter !== 'all') ||
    dateRange?.from ||
    dateRange?.to
  )

  return (
    <div className="flex flex-col gap-5 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.06),_transparent_30%),linear-gradient(to_bottom,_rgba(248,250,252,0.9),_transparent_26%)] p-4 sm:gap-6 sm:p-5 lg:p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.09),_transparent_28%),linear-gradient(to_bottom,_rgba(2,6,23,0.82),_transparent_30%)]">
      <RepairHeader
        onRefresh={refreshRepairs}
        onNewRepair={handleNewRepair}
        isLoading={isLoading}
        totalRepairs={repairs.length}
        activeRepairs={repairPulse.activeRepairs}
        urgentRepairs={repairPulse.urgentRepairs}
        readyRepairs={repairPulse.readyRepairs}
        selectedBranchName={selectedBranch?.name}
      />

      <RepairStats repairs={repairs} visibleCount={uiFiltered.length} />

      <RepairOperationsOverview
        repairs={repairs}
        filteredCount={uiFiltered.length}
        selectedBranchName={selectedBranch?.name}
        statusFilter={statusFilter}
        onStatusFilterSelect={setStatusFilter}
      />

      <div className="hidden">
        <Collapsible open={quickAccessOpen} onOpenChange={setQuickAccessOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="text-sm font-medium">Accesos rápidos</span>
              <span className={cn("text-xs transition-transform", quickAccessOpen && "rotate-180")}>⌄</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <QuickAccessNav sections={quickAccessSections} />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="text-sm font-medium">Métricas</span>
              <span className={cn("text-xs transition-transform", statsOpen && "rotate-180")}>⌄</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <RepairStats repairs={repairs} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="hidden">
        <QuickAccessNav sections={quickAccessSections} />
      </div>

      <div className="hidden">
        <RepairStats repairs={repairs} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
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
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 xl:min-w-[280px] xl:flex-col xl:items-end">
              <RepairViewSelector
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onPreload={(view) => preload(view)}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {uiFiltered.length} reparaciones
                </Badge>
                {hasActiveFilters && (
                  <Badge variant="outline" className="rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-200">
                    con filtros
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isLoading && uiFiltered.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Mostrando {viewMode === 'kanban' || viewMode === 'calendar' ? uiFiltered.length : `${visibleRangeStart}–${visibleRangeEnd}`} de {uiFiltered.length} reparaciones
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vista {viewMode === 'table' ? 'lista' : viewMode === 'cards' ? 'tarjetas' : viewMode === 'kanban' ? 'kanban' : 'calendario'}
                {selectedBranch?.name ? ` en ${selectedBranch.name}` : ''}.
              </p>
            </div>
            {(viewMode === 'table' || viewMode === 'cards') && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                  Página {currentPage} / {totalPages}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/80 py-14 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/60">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando reparaciones...</p>
            </div>
          </div>
        ) : uiFiltered.length === 0 ? (
          <RepairEmptyState
            hasFilters={hasActiveFilters}
            onNewRepair={handleNewRepair}
          />
        ) : viewMode === 'table' ? (
          <RepairList
            repairs={visibleRepairs}
            onStatusChange={updateStatus}
            onEdit={handleEditRepair}
            onView={handleViewRepair}
            onDelete={handleDeleteClick}
            onDeliver={setDeliverTarget}
            isLoading={false}
            companyInfo={repairListCompanyInfo}
          />
        ) : viewMode === 'cards' ? (
          <RepairCardsView
            repairs={visibleRepairs}
            onView={handleViewRepair}
            onEdit={handleEditRepair}
            onDelete={handleDeleteClick}
            onDeliver={setDeliverTarget}
          />
        ) : viewMode === 'kanban' ? (
          <div className="h-[calc(100vh-300px)] min-h-[500px]">
            <RepairKanban
              repairs={uiFiltered}
              onStatusChange={async (id, status) => { await updateStatus(id, status) }}
              onEdit={handleEditRepair}
              onView={handleViewRepair}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1 rounded-[24px] border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
              <Calendar mode="single" selected={calendarDate} onSelect={handleCalendarSelect} />
            </div>
            <div className="lg:col-span-2 rounded-[24px] border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 space-y-2">
              {calendarRepairs.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-200/80 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800/80 dark:hover:bg-slate-900/70">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.customer.name} • {r.device}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleEditRepair(r)}>Programar</Button>
                </div>
              ))}
              {calendarRepairs.length === 0 && (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay reparaciones para la fecha seleccionada.
                </div>
              )}
            </div>
          </div>
        )}

        <QuickAccessNav sections={quickAccessSections} />
      </div>

      <RepairFormDialog
        open={isDialogOpen}
        mode={dialogMode}
        technicians={technicianOptions}
        initialData={initialFormData}
        repair={selectedRepair}
        onClose={handleDialogClose}
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

      {false && uiFiltered.length > pageSize && (viewMode === 'table' || viewMode === 'cards') && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, uiFiltered.length)} de {uiFiltered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs font-medium px-3">{currentPage} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSearch={handleGlobalSearch}
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
        onQuickPay={(repair) => setPayTarget(repair)}
      />

      <RepairDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        repairContext={deleteId ? (() => {
          const r = repairs.find(r => r.id === deleteId)
          return { ticketNumber: r?.ticketNumber, customerName: r?.customer.name }
        })() : undefined}
      />

      <RepairDeliveryDialog
        open={!!deliverTarget}
        repair={deliverTarget}
        onOpenChange={(open) => !open && setDeliverTarget(null)}
        onConfirm={async (id, outcome, note) => { await deliverRepair(id, outcome, note) }}
      />

      <RepairPaymentDialog
        open={!!payTarget}
        repair={payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        onConfirm={handleQuickPayConfirm}
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
