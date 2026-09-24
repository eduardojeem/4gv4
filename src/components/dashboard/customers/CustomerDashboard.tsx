"use client"

/**
 * CustomerDashboard
 * 
 * Dashboard principal para la gestión de clientes con:
 * - Vista de lista con filtros avanzados
 * - Vista de detalle de cliente individual
 * - Historial de reparaciones y compras
 * - Analíticas y métricas en tiempo real
 * - Sistema de segmentación inteligente
 * - Centro de notificaciones
 * - Gestión de estados y paginación
 */

import React, { useMemo, useState, useEffect, Suspense, lazy, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  TrendingUp,
  UserCheck,
  BarChart3,
  Bell,
  CreditCard,
  Plus,
  RefreshCw, Download
} from 'lucide-react'
import { exportCustomerDirectory, loadCustomerDirectoryForExport } from '@/lib/customers/export-directory'
import { SectionGuideButton } from '@/components/dashboard/common/SectionGuideButton'
import { CUSTOMERS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { ImprovedMetricCard } from './ImprovedMetricCard'
import { CustomerModal } from './CustomerModal'
import { CustomerQuickView } from './CustomerQuickView'
import { CustomerDeleteDialog } from './CustomerDeleteDialog'
import { Customer } from '@/hooks/use-customer-state'
import { Pagination } from '@/components/ui/pagination'
import { prefetchCustomerPurchases, prefetchSimilarCustomers } from '@/hooks/useCustomerData'
import { Skeleton } from '@/components/ui/skeleton'
import { useKeyboardShortcuts, customerDashboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsIndicator } from '@/components/ui/keyboard-shortcuts-indicator'
import { toast } from 'sonner'
import { useCustomersWithCredits } from '@/hooks/use-customer-credits'
import { useCustomerInsightsData } from '@/hooks/use-customer-insights-data'
import { useCredits } from '@/hooks/use-credits'
import { useCustomers } from '@/contexts/CustomerContext'
import { usePlanModule } from '@/contexts/SubscriptionStatusContext'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { customerDirectoryParams } from '@/hooks/use-customer-directory-state'
// Componentes cargados dinámicamente para reducir el peso inicial
// Componente mejorado de lista de clientes
const CustomerListView = dynamic(() => import("./CustomerListView").then(m => ({ default: m.CustomerListView })), { ssr: false })
const CustomerDetail = dynamic(() => import("./CustomerDetail").then(m => m.CustomerDetail), { ssr: false })
const CustomerEditFormV2 = dynamic(() => import("./CustomerEditFormV2").then(m => m.CustomerEditFormV2), { ssr: false })
const CustomerHistory = dynamic(() => import("./CustomerHistory").then(m => m.CustomerHistory), { ssr: false })
const CustomerFilters = dynamic(() => import("./CustomerFilters").then(m => m.CustomerFilters), { ssr: false })
// Componente consolidado de analíticas
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })))
const CustomerAlerts = dynamic(() => import("./CustomerAlerts").then(m => m.CustomerAlerts), { ssr: false })
const CustomerActiveCreditsTab = dynamic(() => import("./CustomerActiveCreditsTab").then(m => m.CustomerActiveCreditsTab), { ssr: false })


// Tipos para la navegación
type ViewState = 'list' | 'detail' | 'history' | 'edit'

const dashboardTabs = [
  { value: "customers", icon: <Users className="h-4 w-4" />, label: "Clientes" },
  { value: "analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Analíticas" },
  { value: "credits", icon: <CreditCard className="h-4 w-4" />, label: "Créditos Activos" },
  { value: "notifications", icon: <Bell className="h-4 w-4" />, label: "Alertas" },
]

export function CustomerDashboard() {
  const hasCreditsModule = usePlanModule('credits')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("customers")
  const { 
    customers, 
    filteredCustomers: _filteredCustomers,
    paginatedCustomers, 
    filters, 
    viewMode,
    loading, 
    error, 
    pagination,
    directorySummary,
    setPage,
    setItemsPerPage,
    setSort,
    sortBy,
    sortOrder,
    updateFilters, 
    setViewMode,
    deleteCustomer,
    bulkDelete,
    toggleCustomerStatus, 
    updateCustomer,
    bulkUpdateCustomerStatus,
    refreshCustomers 
  } = useCustomers()
  
  // Handle customer selection from search
  const handleCustomerSelectFromSearch = useCallback((customer: Customer) => {
    const from = encodeURIComponent(typeof window === 'undefined' ? '' : window.location.search)
    router.push(`/dashboard/customers/${encodeURIComponent(customer.id)}?from=${from}`)
  }, [router])

  // Enhanced updateFilters with search intelligence
  const handleFiltersChange = React.useCallback((newFilters: Partial<import('@/hooks/use-customer-state').CustomerFilters>) => {
    updateFilters(newFilters)
    const params = customerDirectoryParams({ ...filters, ...newFilters }, 1, pagination.itemsPerPage, sortBy, sortOrder)
    params.delete('limit')
    params.set('pageSize', String(pagination.itemsPerPage))
    router.replace(`/dashboard/customers?${params.toString()}`, { scroll: false })
    
  }, [updateFilters, filters, pagination.itemsPerPage, sortBy, sortOrder, router])
  const insights = useCustomerInsightsData(activeTab !== 'customers', activeTab === 'analytics')
  const { creditSummaries: pageCreditSummaries } = useCustomersWithCredits(customers, activeTab === 'customers')
  const { creditSummaries } = useCustomersWithCredits(
    insights.customers,
    activeTab === 'credits' || activeTab === 'notifications'
  )
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === 'true') {
      setShowCreateModal(true)
    }
  }, [])

  const [compactMode, setCompactMode] = useState(true)
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  
  // Estados para navegación
  const [currentView, setCurrentView] = useState<ViewState>('list')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCreditCustomerId, _setSelectedCreditCustomerId] = useState<string>("")
  const [creditSearchTerm, _setCreditSearchTerm] = useState("")
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  
  // Quick view modal
  const [quickViewCustomer, setQuickViewCustomer] = useState<Customer | null>(null)
  const [_showGuide, _setShowGuide] = useState(true)

  const handlePageChange = useCallback((page: number) => {
    setPage(page)
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    params.set('page', String(page))
    router.replace(`/dashboard/customers?${params.toString()}`, { scroll: false })
  }, [router, setPage])

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setItemsPerPage(pageSize)
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    params.set('page', '1')
    params.set('pageSize', String(pageSize))
    router.replace(`/dashboard/customers?${params.toString()}`, { scroll: false })
  }, [router, setItemsPerPage])

  const handleSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setSort(field, order)
    const params = new URLSearchParams(window.location.search)
    params.set('sort', field)
    params.set('order', order)
    params.set('page', '1')
    router.replace(`/dashboard/customers?${params.toString()}`, { scroll: false })
  }, [router, setSort])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetId = params.get('id') || params.get('customerId')
    if (targetId) {
      params.delete('id')
      params.delete('customerId')
      router.replace(`/dashboard/customers/${encodeURIComponent(targetId)}?from=${encodeURIComponent(`?${params.toString()}`)}`)
    }
  }, [router])

  // Calculate stats including credit metrics
  const totalCustomers = directorySummary.total
  const activeCustomers = directorySummary.active

  const stats = useMemo(() => {
    return [
      {
        title: "Total Clientes",
        value: totalCustomers.toLocaleString(),
        icon: <Users className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-blue-500 to-cyan-500",
        description: `${activeCustomers} activos de ${totalCustomers} total`
      },
      {
        title: "Resultados",
        value: pagination.totalItems.toLocaleString(),
        icon: <UserCheck className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-green-500 to-emerald-500",
        description: 'Clientes que cumplen los filtros'
      },
      {
        title: "Página actual",
        value: customers.length.toLocaleString(),
        icon: <Users className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-purple-500 to-violet-500",
        description: `Página ${pagination.currentPage} de ${Math.max(1, pagination.totalPages)}`
      },
      {
        title: "Clientes activos",
        value: activeCustomers.toLocaleString(),
        icon: <TrendingUp className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-orange-500 to-red-500",
        description: 'En toda la organización'
      }
    ]
  }, [totalCustomers, activeCustomers, pagination, customers.length])

  const {
    credits,
    installments,
    payments,
    markInstallmentPaid,
  } = useCredits(hasCreditsModule && activeTab === 'credits')

  const customersWithActiveCredits = useMemo(() => {
    const term = creditSearchTerm.trim().toLowerCase()
    return insights.customers.filter((c) => {
      const summary = creditSummaries[c.id]
      const hasActive = summary && summary.active_credits > 0
      const matches = term ? (c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term) || c.phone?.toLowerCase().includes(term)) : true
      return hasActive && matches
    })
  }, [insights.customers, creditSummaries, creditSearchTerm])

  const selectedCreditIds = useMemo(() => {
    return credits.filter(c => c.customer_id === selectedCreditCustomerId).map(c => c.id)
  }, [credits, selectedCreditCustomerId])

  const selectedInstallments = useMemo(() => {
    return installments.filter(i => selectedCreditIds.includes(i.credit_id))
  }, [installments, selectedCreditIds])

  const selectedPayments = useMemo(() => {
    return payments.filter(p => selectedCreditIds.includes(p.credit_id))
  }, [payments, selectedCreditIds])

  const exportSelectedHistoryCSV = () => {
    if (!selectedCreditCustomerId) return
    const instHeader = ["Cuota", "Vence", "Monto", "Estado", "Pagado", "Método"]
    const instRows = selectedInstallments.map(i => [
      String(i.installment_number),
      new Date(i.due_date).toLocaleDateString(),
      String(i.amount),
      i.status,
      String(i.amount_paid || 0),
      String(i.payment_method || "")
    ].join(","))
    const payHeader = ["Fecha", "Crédito", "Cuota", "Monto", "Método", "Referencia"]
    const payRows = selectedPayments.map(p => [
      p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
      String(p.credit_id),
      String(p.installment_id || ""),
      String(p.amount),
      String(p.payment_method || ""),
      ""
    ].join(","))
    const content = [
      "INSTALMENTS",
      instHeader.join(","),
      ...instRows,
      "",
      "PAYMENTS",
      payHeader.join(","),
      ...payRows
    ].join("\n")
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "historial_crediticio.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSelectedHistoryExcel = () => {
    if (!selectedCreditCustomerId) return
    const instHeader = ["Cuota", "Vence", "Monto", "Estado", "Pagado", "Método"]
    const instRows = selectedInstallments.map(i => [
      String(i.installment_number),
      new Date(i.due_date).toLocaleDateString(),
      String(i.amount),
      i.status,
      String(i.amount_paid || 0),
      String(i.payment_method || "")
    ].join("\t"))
    const payHeader = ["Fecha", "Crédito", "Cuota", "Monto", "Método", "Referencia"]
    const payRows = selectedPayments.map(p => [
      p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
      String(p.credit_id),
      String(p.installment_id || ""),
      String(p.amount),
      String(p.payment_method || ""),
      ""
    ].join("\t"))
    const content = [
      "INSTALMENTS",
      instHeader.join("\t"),
      ...instRows,
      "",
      "PAYMENTS",
      payHeader.join("\t"),
      ...payRows
    ].join("\n")
    const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "historial_crediticio.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSelectedHistoryPDF = () => {
    if (!selectedCreditCustomerId) return
    const customer = customers.find(c => c.id === selectedCreditCustomerId)
    
    // Sanitize values to prevent XSS when injecting into HTML
    const esc = (val: unknown): string => {
      const str = String(val ?? '')
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }
    
    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Historial Crediticio</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Historial de ${esc(customer?.name || "Cliente")}</h1>
        <h2>Cuotas</h2>
        <table>
          <thead><tr><th>Cuota</th><th>Vence</th><th>Monto</th><th>Estado</th><th>Pagado</th><th>Método</th></tr></thead>
          <tbody>
            ${selectedInstallments.map(i => `
              <tr>
                <td>${esc(i.installment_number)}</td>
                <td>${esc(new Date(i.due_date).toLocaleDateString())}</td>
                <td>${esc(i.amount)}</td>
                <td>${esc(i.status)}</td>
                <td>${esc(i.amount_paid || 0)}</td>
                <td>${esc(i.payment_method || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <h2>Pagos</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Crédito</th><th>Cuota</th><th>Monto</th><th>Método</th><th>Referencia</th></tr></thead>
          <tbody>
            ${selectedPayments.map(p => `
              <tr>
                <td>${esc(p.created_at ? new Date(p.created_at).toLocaleDateString() : "")}</td>
                <td>${esc(p.credit_id)}</td>
                <td>${esc(p.installment_id || "")}</td>
                <td>${esc(p.amount)}</td>
                <td>${esc(p.payment_method || "")}</td>
                <td></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `
    const w = window.open("", "_blank")
    if (w) {
      w.document.write(html)
      w.document.close()
      setTimeout(() => { w.print() }, 250)
    }
  }

  const handleAddCustomer = () => {
    setShowCreateModal(true)
  }

  const handleViewDetail = (customer: Customer) => {
    setQuickViewCustomer(customer)
  }

  const handleGoToFullDetail = (customer: Customer) => {
    setQuickViewCustomer(null)
    const from = encodeURIComponent(window.location.search)
    router.push(`/dashboard/customers/${encodeURIComponent(customer.id)}?from=${from}`)
  }

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCurrentView('history')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedCustomer(null)
  }

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCurrentView('edit')
  }

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer)
  }

  const handleConfirmDeleteCustomer = async (customer: Customer) => {
    if (isDeletingCustomer) return
    try {
      setIsDeletingCustomer(true)
      const result = await deleteCustomer(customer.id)
      if (result.success) {
        setSelectedCustomers(prev => prev.filter(id => id !== customer.id))
        if (selectedCustomer?.id === customer.id) {
          handleBackToList()
        }
        await refreshCustomers()
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('No se pudo eliminar el cliente')
    } finally {
      setIsDeletingCustomer(false)
      setCustomerToDelete(null)
    }
  }

  const handleDeactivateCustomer = async (customer: Customer) => {
    try {
      const result = await updateCustomer(customer.id, { status: 'inactive' })
      if (result.success) {
        toast.success(`Cliente "${customer.name}" desactivado`, {
          description: 'El cliente no aparecerá en ventas activas, conservando su historial.'
        })
        await refreshCustomers()
      }
    } catch (error) {
      console.error('Error deactivating customer:', error)
      toast.error('No se pudo desactivar el cliente')
    } finally {
      setCustomerToDelete(null)
    }
  }

  const handleToggleCustomerStatus = async (customer: Customer) => {
    try {
      const result = await toggleCustomerStatus(customer.id)
      if (result.success) {
        await refreshCustomers()
        toast.success('Estado actualizado')
      }
    } catch (error) {
      console.error('Error toggling customer status:', error)
    }
  }

  const handleBulkStatusChange = async (customerIds: string[], status: 'active' | 'inactive' | 'suspended') => {
    try {
      const result = await bulkUpdateCustomerStatus(customerIds, status)
      if (result.success) {
        // Clear selection and refresh
        setSelectedCustomers([])
        await refreshCustomers()
        toast.success('Estados actualizados')
      }
    } catch (error) {
      console.error('Error updating bulk status:', error)
    }
  }

  const handleBulkDelete = async (customerIds: string[]) => {
    if (isBulkDeleting) return
    if (customerIds.length === 0) return
    const confirmed = window.confirm(`¿Eliminar ${customerIds.length} cliente(s)? Esta acción no se puede deshacer.`)
    if (!confirmed) return

    try {
      setIsBulkDeleting(true)
      const result = await bulkDelete(customerIds)
      if (result.success) {
        setSelectedCustomers([])
        if (selectedCustomer && customerIds.includes(selectedCustomer.id)) {
          handleBackToList()
        }
        await refreshCustomers()
      }
    } catch (error) {
      console.error('Error deleting customers in bulk:', error)
      toast.error('No se pudo completar la eliminación masiva')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleRefresh = async () => {
    await refreshCustomers()
    toast.success('Lista actualizada')
  }

  const handleExport = async () => {
    try {
      const count = await exportCustomerDirectory(filters, sortBy, sortOrder)
      toast.success(`${count} cliente(s) exportado(s)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron exportar los clientes')
    }
  }

  const loadAllCustomersForExport = useCallback(
    () => loadCustomerDirectoryForExport(filters, sortBy, sortOrder),
    [filters, sortBy, sortOrder]
  )

  const focusSearch = () => {
    const searchInput = document.querySelector('input[placeholder*="Buscar"]') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
      toast.info('Búsqueda enfocada', { description: 'Escribe para buscar clientes' })
    }
  }

  // Configuración de atajos de teclado
  const { showShortcutsHelp } = useKeyboardShortcuts({
    shortcuts: [
      {
        ...customerDashboardShortcuts.newCustomer,
        action: handleAddCustomer
      },
      {
        ...customerDashboardShortcuts.search,
        action: focusSearch
      },
      {
        ...customerDashboardShortcuts.export,
        action: handleExport
      },
      {
        ...customerDashboardShortcuts.refresh,
        action: handleRefresh
      },
      {
        ...customerDashboardShortcuts.help,
        action: () => {
          // Show shortcuts help - will be defined by the hook
        }
      },
      {
        ...customerDashboardShortcuts.escape,
        action: () => {
          if (currentView !== 'list') {
            handleBackToList()
          } else if (showCreateModal) {
            setShowCreateModal(false)
          }
        }
      }
    ],
    enabled: true
  })

  // Use showShortcutsHelp after it's defined
  useEffect(() => {
    const helpShortcut = document.querySelector('[data-help-shortcut]')
    if (helpShortcut) {
      helpShortcut.addEventListener('click', showShortcutsHelp)
      return () => helpShortcut.removeEventListener('click', showShortcutsHelp)
    }
  }, [showShortcutsHelp])

  // Prefetch predictivo basado en navegación de usuario
  useEffect(() => {
    if (selectedCustomer) {
      prefetchCustomerPurchases(selectedCustomer.id)
      if (selectedCustomer.segment) {
        prefetchSimilarCustomers(selectedCustomer.segment)
      }
    }
  }, [selectedCustomer])

  return (
    <div className="flex flex-col gap-4">

        {/* ── Header — estilo consistente con Reparaciones ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm dark:border-slate-800"
        >
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: info */}
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
                    CRM
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                      Clientes
                    </h1>
                    <SectionGuideButton
                      guide={CUSTOMERS_GUIDE}
                      className="h-9 border-amber-200/40 bg-amber-400/15 px-3 text-amber-50 hover:bg-amber-400/25 hover:text-white"
                    />
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-white/70">
                    Gestiona tu cartera, historial y créditos desde una sola vista.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white/85">
                    <Users className="mr-1.5 h-4 w-4" />
                    {totalCustomers} registrados
                  </Badge>
                  <Badge className="rounded-full border-0 px-3 py-1.5 text-sm font-medium bg-white/[0.08] text-white">
                    {activeCustomers} activos
                  </Badge>
                  {pagination.totalItems !== totalCustomers && (
                    <Badge className="rounded-full border-0 px-3 py-1.5 text-sm font-medium bg-cyan-500/15 text-cyan-100">
                      {pagination.totalItems} resultados
                    </Badge>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex flex-col gap-3 lg:min-w-[260px] lg:max-w-[300px]">
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Button
                    onClick={handleAddCustomer}
                    className="h-10 flex-1 gap-2 rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo cliente
                    <kbd className="ml-auto hidden h-6 items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2 font-mono text-[10px] font-semibold text-emerald-900 sm:inline-flex">
                      Ctrl + N
                    </kbd>
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      disabled={loading}
                      className="h-10 flex-1 gap-1.5 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs font-semibold"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                      Actualizar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { void handleExport() }}
                      className="h-10 gap-1.5 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs font-semibold"
                      title="Exportar clientes filtrados en CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/70">
                  <span>Buscá un cliente o abrí Créditos activos para revisar saldos.</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {stats.map((stat) => (
            <ImprovedMetricCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              change={stat.change}
              changeType={stat.changeType}
              gradient={stat.gradient}
              description={stat.description}
              compact={compactMode}
            />
          ))}
        </motion.div>

        {/* Main Content — Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
              <TabsList className="inline-flex h-auto min-w-max gap-1 bg-transparent p-0">
                {dashboardTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex min-h-9 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-all data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Compact toggle movido al tab bar */}
              <div className="flex shrink-0 items-center gap-2 pr-2">
                <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Compacto</span>
                <Switch
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                  aria-label="Alternar modo compacto"
                />
              </div>
            </div>

            {/* Tab Content */}
            <TabsContent value="customers" className="space-y-4 mt-0">
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {currentView === 'list' && (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                    <CustomerFilters
                      filters={filters}
                      onFiltersChange={handleFiltersChange}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      customers={customers}
                      totalCount={pagination.totalItems}
                      loadAllCustomersForExport={loadAllCustomersForExport}
                      onAddCustomer={handleAddCustomer}
                      onRefresh={handleRefresh}
                      compact={compactMode}
                      onCustomerSelect={handleCustomerSelectFromSearch}
                    />
                    
                    {filters.search && !loading && (
                      <p className="text-sm text-muted-foreground" role="status">
                        {pagination.totalItems} resultado{pagination.totalItems === 1 ? '' : 's'} para “{filters.search}”
                      </p>
                    )}
                    
                    {/* Los dos campos manejan la misma busqueda: el de abajo
                        filtraba solo la pagina visible y con otras reglas. */}
                    <CustomerListView
                      customers={paginatedCustomers}
                      searchTerm={filters.search}
                      onSearchChange={(term) => handleFiltersChange({ search: term })}
                      selectedCustomers={selectedCustomers}
                      creditSummaries={pageCreditSummaries}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      sortField={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={handleSortChange}
                      onCustomerToggle={(customerId) => {
                        setSelectedCustomers(prev => 
                          prev.includes(customerId) 
                            ? prev.filter(id => id !== customerId)
                            : [...prev, customerId]
                        )
                      }}
                      onSelectAll={() => {
                        const pageIds = paginatedCustomers.map((customer) => customer.id)
                        setSelectedCustomers((previous) => pageIds.every((id) => previous.includes(id))
                          ? previous.filter((id) => !pageIds.includes(id))
                          : [...new Set([...previous, ...pageIds])])
                      }}
                      onClearSelection={() => setSelectedCustomers([])}
                      onViewCustomer={handleViewDetail}
                      onEditCustomer={handleEditCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                      onBulkDelete={handleBulkDelete}
                      onToggleCustomerStatus={handleToggleCustomerStatus}
                      onBulkStatusChange={handleBulkStatusChange}
                      bulkDeleting={isBulkDeleting}
                      loading={loading || isDeletingCustomer || isBulkDeleting}
                      compact={compactMode}
                    />
                    
                    {/* Al buscar no se pagina: la lista ya viene recortada y
                        ordenada por relevancia, y el hook devuelve una sola
                        pagina. Si el tope dejo gente afuera, se avisa. */}
                    {!loading && !error && pagination.totalPages > 1 && (
                      <div className="mt-6">
                        <Pagination
                          currentPage={pagination.currentPage}
                          totalPages={pagination.totalPages}
                          itemsPerPage={pagination.itemsPerPage}
                          totalItems={pagination.totalItems}
                          onPageChange={handlePageChange}
                          onItemsPerPageChange={handlePageSizeChange}
                          className="justify-center"
                        />
                      </div>
                    )}
                    </motion.div>
                )}

                {currentView === 'detail' && selectedCustomer && (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CustomerDetail
                      customer={selectedCustomer}
                      onBack={handleBackToList}
                      onEdit={handleEditCustomer}
                      onViewHistory={() => handleViewHistory(selectedCustomer)}
                      compact={compactMode}
                    />
                  </motion.div>
                )}

                {currentView === 'history' && selectedCustomer && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                  <CustomerHistory
                    customer={selectedCustomer}
                    onBack={handleBackToList}
                    onViewDetail={() => handleViewDetail(selectedCustomer)}
                  />
                  </motion.div>
                )}

                {currentView === 'edit' && selectedCustomer && (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                  <CustomerEditFormV2
                    customer={selectedCustomer}
                    onSave={async (formData) => {
                      try {
                        const result = await updateCustomer(selectedCustomer.id, formData as Partial<Customer>)
                        if (result.success) {
                          const updated = result.customer
                          if (updated) {
                            setSelectedCustomer(updated)
                          } else {
                            setSelectedCustomer(prev => prev ? ({ ...prev, ...formData } as Customer) : null)
                          }
                          // Actualizar el cliente en la lista local si es necesario
                          handleBackToList()
                          // Refresh the customer list
                          await refreshCustomers()
                          toast.success('Cliente actualizado correctamente')
                        } else {
                          // Mostrar error específico al usuario
                          const errorMsg = result.error || 'Error al actualizar cliente'
                          toast.error(typeof errorMsg === 'string' ? errorMsg : 'Error al actualizar cliente')
                          console.error('Update failed:', errorMsg)
                        }
                      } catch (error) {
                        console.error('Error updating customer:', error)
                        toast.error('Error inesperado al actualizar cliente')
                      }
                    }}
                    onCancel={handleBackToList}
                  />
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              {insights.loading && <div className="p-4 text-sm text-muted-foreground">Cargando análisis de clientes…</div>}
              {insights.error && <div role="alert" className="p-4 text-sm text-destructive">{insights.error}</div>}
              {!insights.loading && !insights.error && (
              <Suspense fallback={<div className="p-4"><Skeleton className="h-24 w-full" /></div>}>
                <AnalyticsDashboard
                  customers={insights.customers}
                  creditSummaries={creditSummaries}
                  mode="interactive"
                  showPredictions={true}
                  showComparisons={true}
                />
              </Suspense>
              )}
            </TabsContent>

            <TabsContent value="credits" className="mt-0">
              {insights.loading && <div className="p-4 text-sm text-muted-foreground">Cargando cartera de clientes…</div>}
              {insights.error && <div role="alert" className="p-4 text-sm text-destructive">{insights.error}</div>}
              {!insights.loading && !insights.error && (
              <Suspense fallback={<div className="p-4"><Skeleton className="h-32 w-full" /></div>}>
                <CustomerActiveCreditsTab
                  customers={insights.customers}
                  creditSummaries={creditSummaries}
                  credits={credits}
                  installments={installments}
                  onViewCustomer={(customer) => {
                    setActiveTab('customers')
                    handleViewDetail(customer)
                  }}
                  onMarkPaid={markInstallmentPaid}
                  compact={compactMode}
                />
              </Suspense>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              {insights.loading && <div className="p-4 text-sm text-muted-foreground">Cargando alertas de clientes…</div>}
              {insights.error && <div role="alert" className="p-4 text-sm text-destructive">{insights.error}</div>}
              {!insights.loading && !insights.error && (
              <CustomerAlerts
                customers={insights.customers}
                onViewCustomer={(customer) => {
                  setActiveTab('customers')
                  handleViewDetail(customer)
                }}
              />
              )}
            </TabsContent>


          </Tabs>
        </motion.div>

      {/* Modal para crear cliente */}
      {showCreateModal && (
        <CustomerModal
          customer={null}
          isOpen={showCreateModal}
          mode="create"
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Quick View Modal */}
      <CustomerQuickView
        customer={quickViewCustomer}
        open={!!quickViewCustomer}
        onClose={() => setQuickViewCustomer(null)}
        onViewDetail={handleGoToFullDetail}
        onEdit={(c) => { setQuickViewCustomer(null); handleEditCustomer(c) }}
      />

      {/* Delete / Deactivate Customer Confirmation Dialog */}
      <CustomerDeleteDialog
        customer={customerToDelete}
        isOpen={!!customerToDelete}
        onClose={() => setCustomerToDelete(null)}
        onConfirmDelete={handleConfirmDeleteCustomer}
        onDeactivate={handleDeactivateCustomer}
        isDeleting={isDeletingCustomer}
        creditSummary={customerToDelete ? pageCreditSummaries[customerToDelete.id] : null}
      />

      {/* Keyboard Shortcuts Indicator */}
      <KeyboardShortcutsIndicator
        shortcuts={[
          { keys: ['Ctrl', 'N'], description: 'Nuevo Cliente', category: 'Acciones' },
          { keys: ['Ctrl', 'K'], description: 'Buscar Cliente', category: 'Navegación' },
          { keys: ['Ctrl', 'E'], description: 'Exportar Clientes', category: 'Acciones' },
          { keys: ['F5'], description: 'Actualizar Lista', category: 'Navegación' },
          { keys: ['Shift', '?'], description: 'Mostrar Ayuda', category: 'Ayuda' },
          { keys: ['Escape'], description: 'Cancelar/Cerrar', category: 'Navegación' }
        ]}
        position="bottom-right"
      />
    </div>
  )
}
