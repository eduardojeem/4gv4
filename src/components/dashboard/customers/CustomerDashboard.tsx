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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  RefreshCw,
  ArrowUpCircle, ArrowDownCircle, MoreHorizontal, Info
} from 'lucide-react'
import { ImprovedMetricCard } from './ImprovedMetricCard'
// Componentes cargados dinámicamente para reducir el peso inicial
// Componente mejorado de lista de clientes
const CustomerListView = dynamic(() => import("./CustomerListView").then(m => ({ default: m.CustomerListView })), { ssr: false })
const CustomerDetail = dynamic(() => import("./CustomerDetail").then(m => m.CustomerDetail), { ssr: false })
const CustomerEditFormV2 = dynamic(() => import("./CustomerEditFormV2").then(m => m.CustomerEditFormV2), { ssr: false })
const CustomerHistory = dynamic(() => import("./CustomerHistory").then(m => m.CustomerHistory), { ssr: false })
const CustomerFilters = dynamic(() => import("./CustomerFilters").then(m => m.CustomerFilters), { ssr: false })
import { CustomerModal } from './CustomerModal'
import { CustomerQuickView } from './CustomerQuickView'
// Componente consolidado de analíticas
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })))
const CustomerAlerts = dynamic(() => import("./CustomerAlerts").then(m => m.CustomerAlerts), { ssr: false })
import { Customer } from '@/hooks/use-customer-state'
import { Pagination } from '@/components/ui/pagination'
import { prefetchCustomerPurchases, prefetchSimilarCustomers } from '@/hooks/useCustomerData'
import { Skeleton } from '@/components/ui/skeleton'
import { useKeyboardShortcuts, customerDashboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsIndicator } from '@/components/ui/keyboard-shortcuts-indicator'
import { toast } from 'sonner'
import { useCustomersWithCredits } from '@/hooks/use-customer-credits'
import { UpcomingInstallments } from '@/components/dashboard/credits/UpcomingInstallments'
import { useCredits } from '@/hooks/use-credits'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SearchStats, SearchInsights } from './SearchStats'
import searchService from '@/services/search-service'
import { formatCurrency } from '@/lib/currency'
import { useCustomers } from '@/contexts/CustomerContext'
import { usePlanModule } from '@/contexts/SubscriptionStatusContext'
import { cn } from '@/lib/utils'


// Tipos para la navegación
type ViewState = 'list' | 'detail' | 'history' | 'edit'

const dashboardTabs = [
  { value: "customers", icon: <Users className="h-4 w-4" />, label: "Clientes" },
  { value: "analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Analíticas" },
  { value: "notifications", icon: <Bell className="h-4 w-4" />, label: "Alertas" },
]

export function CustomerDashboard() {
  const hasCreditsModule = usePlanModule('credits')
  const { 
    customers, 
    filteredCustomers, 
    paginatedCustomers, 
    filters, 
    viewMode,
    loading, 
    error, 
    pagination,
    setPage,
    setItemsPerPage,
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
    setSelectedCustomer(customer)
    setCurrentView('detail')
  }, [])

  // Enhanced updateFilters with search intelligence
  const handleFiltersChange = React.useCallback((newFilters: Partial<import('@/hooks/use-customer-state').CustomerFilters>) => {
    const startTime = performance.now()
    
    // Update filters
    updateFilters(newFilters)
    
    // Measure search time
    const endTime = performance.now()
    setSearchTime(Math.round(endTime - startTime))
    
    // Generate suggestions if search has no results
    if (newFilters.search && filteredCustomers.length === 0) {
      const suggestions = searchService.generateSuggestions(customers, newFilters.search)
      setSearchSuggestions(suggestions.map(s => s.value))
    } else {
      setSearchSuggestions([])
    }
  }, [updateFilters, customers, filteredCustomers.length])
  const { creditSummaries } = useCustomersWithCredits(customers)
  const [activeTab, setActiveTab] = useState("customers")
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
  const [, setShowExportDialog] = useState(false)
  const [, setShowImportDialog] = useState(false)
  
  // Estados para navegación
  const [currentView, setCurrentView] = useState<ViewState>('list')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCreditCustomerId, setSelectedCreditCustomerId] = useState<string>("")
  const [creditSearchTerm, setCreditSearchTerm] = useState("")
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  
  // Estados para búsqueda inteligente
  const [searchTime, setSearchTime] = useState(0)
  // Quick view modal
  const [quickViewCustomer, setQuickViewCustomer] = useState<Customer | null>(null)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])

  // Calculate stats including credit metrics
  const totalCustomers = customers.length
  const activeCustomers = useMemo(() => customers.filter(c => c.status === "active").length, [customers])

  // Credit metrics
  const creditMetrics = useMemo(() => {
    const summaries = Object.values(creditSummaries)
    const totalActiveCredits = summaries.reduce((sum, s) => sum + s.active_credits, 0)
    const totalPendingAmount = summaries.reduce((sum, s) => sum + s.total_pending, 0)
    const customersWithCredits = summaries.length
    const overduePayments = summaries.filter(s => s.next_payment?.is_overdue).length
    
    return {
      totalActiveCredits,
      totalPendingAmount,
      customersWithCredits,
      overduePayments
    }
  }, [creditSummaries])

  const stats = useMemo(() => {
    // Función para formatear moneda
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount)
    }

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
        title: "Créditos Activos",
        value: creditMetrics.totalActiveCredits.toLocaleString(),
        icon: <CreditCard className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-green-500 to-emerald-500",
        description: `Créditos en estado activo`
      },
      {
        title: "Clientes con Crédito",
        value: creditMetrics.customersWithCredits.toLocaleString(),
        icon: <UserCheck className="h-5 w-5" />,
        change: undefined,
        changeType: "neutral" as const,
        gradient: "from-purple-500 to-violet-500",
        description: `${totalCustomers > 0 ? Math.round((creditMetrics.customersWithCredits / totalCustomers) * 100) : 0}% del total`
      },
      {
        title: "Saldo Pendiente",
        value: formatCurrency(creditMetrics.totalPendingAmount),
        icon: <TrendingUp className="h-5 w-5" />,
        change: creditMetrics.overduePayments > 0 ? `${creditMetrics.overduePayments} vencidos` : undefined,
        changeType: creditMetrics.overduePayments > 0 ? "negative" as const : "positive" as const,
        gradient: creditMetrics.overduePayments > 0 ? "from-red-500 to-orange-500" : "from-orange-500 to-red-500",
        description: creditMetrics.overduePayments > 0 ? `${creditMetrics.overduePayments} pagos vencidos` : 'Pagos al día'
      }
    ]
  }, [totalCustomers, activeCustomers, creditMetrics])

  const {
    credits,
    installments,
    payments,
    markInstallmentPaid,
  } = useCredits(hasCreditsModule)

  const customersWithActiveCredits = useMemo(() => {
    const term = creditSearchTerm.trim().toLowerCase()
    return customers.filter((c) => {
      const summary = creditSummaries[c.id]
      const hasActive = summary && summary.active_credits > 0
      const matches = term ? (c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term) || c.phone?.toLowerCase().includes(term)) : true
      return hasActive && matches
    })
  }, [customers, creditSummaries, creditSearchTerm])

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
    setSelectedCustomer(customer)
    setCurrentView('detail')
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

  const handleDeleteCustomer = async (customer: Customer) => {
    if (isDeletingCustomer) return
    const confirmed = window.confirm(`¿Eliminar cliente "${customer.name}"? Esta acción no se puede deshacer.`)
    if (!confirmed) return

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

  const handleExport = () => {
    setShowExportDialog(true)
  }

  const handleImport = () => {
    setShowImportDialog(true)
  }

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
        ...customerDashboardShortcuts.import,
        action: handleImport
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
                <div className="space-y-1">
                  <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                    Clientes
                  </h1>
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
                  {filteredCustomers.length !== totalCustomers && (
                    <Badge className="rounded-full border-0 px-3 py-1.5 text-sm font-medium bg-cyan-500/15 text-cyan-100">
                      {filteredCustomers.length} en vista
                    </Badge>
                  )}
                  {creditMetrics.overduePayments > 0 && (
                    <Badge className="rounded-full border-0 px-3 py-1.5 text-sm font-medium bg-red-500/15 text-red-100">
                      {creditMetrics.overduePayments} vencidos
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
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="h-10 flex-1 gap-2 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    Actualizar
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/70">
                  {creditMetrics.overduePayments > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-red-200" />
                      Hay {creditMetrics.overduePayments} cuotas vencidas por revisar.
                    </span>
                  ) : creditMetrics.totalActiveCredits > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-emerald-200" />
                      {creditMetrics.totalActiveCredits} créditos al día.
                    </span>
                  ) : (
                    <span>Sin deudas pendientes. Cartera al día.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Guía de funcionamiento de CRM/Clientes */}
        <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
          <details className="group">
            <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
              <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la sección de Clientes (CRM)?
              </div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
              </div>
            </summary>
            <CardContent className="pt-0 pb-5 text-xs">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                    Registro de Clientes
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Mantén una lista organizada de clientes con sus teléfonos, e-mails e identificación fiscal (RUC/CI). Registra clientes rápidos o detallados según la necesidad de facturación o reparación.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                    Historial y Trazabilidad
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Visualiza el historial completo de compras, órdenes de servicio técnico asociadas y comportamiento de pagos. Esto te permite evaluar el valor de vida del cliente.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                    Cartera y Cuenta Corriente
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Controla el saldo pendiente, cuotas activas y fechas de vencimiento de los créditos otorgados. El CRM te alertará en tiempo real sobre cuentas con retrasos de pago.
                  </p>
                </div>
              </div>
            </CardContent>
          </details>
        </Card>

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
                      <Card className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between gap-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            Créditos activos
                          </span>
                          <Badge variant="outline">{customersWithActiveCredits.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-2 lg:flex-row">
                          <Input
                            placeholder="Buscar cliente"
                            value={creditSearchTerm}
                            onChange={(e) => setCreditSearchTerm(e.target.value)}
                            className="lg:w-1/3"
                          />
                          <Select value={selectedCreditCustomerId} onValueChange={setSelectedCreditCustomerId}>
                            <SelectTrigger className="lg:w-1/3">
                              <SelectValue placeholder="Seleccionar cliente" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {customersWithActiveCredits.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} • {c.email || c.phone || ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryCSV}>CSV</Button>
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryExcel}>Excel</Button>
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryPDF}>PDF</Button>
                          </div>
                        </div>
                        {selectedCreditCustomerId && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <UpcomingInstallments
                              installments={selectedInstallments.filter(i => i.status === 'pending' || i.status === 'late')}
                              onMarkPaid={(id, method, amount) => markInstallmentPaid(id, method, amount)}
                              creditById={{}}
                            />
                            <Card className="rounded-lg border border-slate-200 shadow-sm dark:border-slate-800">
                              <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                  <span>Historial Completo</span>
                                  <Badge variant="secondary">{selectedInstallments.length}</Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr>
                                        <th className="text-left p-2">Cuota</th>
                                        <th className="text-left p-2">Vence</th>
                                        <th className="text-right p-2">Monto</th>
                                        <th className="text-left p-2">Estado</th>
                                        <th className="text-right p-2">Pagado</th>
                                        <th className="text-left p-2">Método</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedInstallments.map(i => {
                                        const isLate = i.status === "pending" && new Date(i.due_date) < new Date()
                                        return (
                                          <tr key={i.id} className="border-t">
                                            <td className="p-2">{i.installment_number}</td>
                                            <td className="p-2">{new Date(i.due_date).toLocaleDateString()}</td>
                                            <td className="p-2 text-right">{formatCurrency(i.amount)}</td>
                                            <td className="p-2">
                                              <Badge variant={isLate ? "destructive" : "outline"}>{isLate ? "late" : i.status}</Badge>
                                            </td>
                                            <td className="p-2 text-right">{formatCurrency(Number(i.amount_paid || 0))}</td>
                                            <td className="p-2">{i.payment_method || ""}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr>
                                        <th className="text-left p-2">Fecha</th>
                                        <th className="text-left p-2">Crédito</th>
                                        <th className="text-left p-2">Cuota</th>
                                        <th className="text-right p-2">Monto</th>
                                        <th className="text-left p-2">Método</th>
                                        <th className="text-left p-2">Referencia</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedPayments.map(p => (
                                        <tr key={p.id} className="border-t">
                                          <td className="p-2">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</td>
                                          <td className="p-2">{p.credit_id}</td>
                                          <td className="p-2">{p.installment_id || ""}</td>
                                          <td className="p-2 text-right">{formatCurrency(p.amount)}</td>
                                          <td className="p-2">{p.payment_method || ""}</td>
                                          <td className="p-2"></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <CustomerFilters
                      filters={filters}
                      onFiltersChange={handleFiltersChange}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      customers={customers}
                      onAddCustomer={handleAddCustomer}
                      onRefresh={handleRefresh}
                      compact={compactMode}
                      onCustomerSelect={handleCustomerSelectFromSearch}
                    />
                    
                    {/* Search Statistics */}
                    {filters.search && (
                      <SearchStats
                        totalResults={filteredCustomers.length}
                        searchTime={searchTime}
                        query={filters.search}
                        totalCustomers={totalCustomers}
                        className="mb-4"
                      />
                    )}
                    
                    {/* Search Insights for no results */}
                    <SearchInsights
                      query={filters.search}
                      totalResults={filteredCustomers.length}
                      suggestions={searchSuggestions}
                    />
                    
                    <CustomerListView
                      customers={paginatedCustomers}
                      selectedCustomers={selectedCustomers}
                      creditSummaries={creditSummaries}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      onCustomerToggle={(customerId) => {
                        setSelectedCustomers(prev => 
                          prev.includes(customerId) 
                            ? prev.filter(id => id !== customerId)
                            : [...prev, customerId]
                        )
                      }}
                      onSelectAll={() => {
                        setSelectedCustomers(paginatedCustomers.map(c => c.id))
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
                    />
                    
                    {/* Paginación */}
                    {!loading && !error && filteredCustomers.length > 0 && (
                      <div className="mt-6">
                        <Pagination
                          currentPage={pagination.currentPage}
                          totalPages={pagination.totalPages}
                          itemsPerPage={pagination.itemsPerPage}
                          totalItems={pagination.totalItems}
                          onPageChange={setPage}
                          onItemsPerPageChange={setItemsPerPage}
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
                          // Actualizar el cliente en la lista local si es necesible
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
              <Suspense fallback={<div className="p-4"><Skeleton className="h-24 w-full" /></div>}>
                <AnalyticsDashboard customers={customers} mode="interactive" showPredictions={true} showComparisons={true} />
              </Suspense>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <CustomerAlerts
                customers={customers}
                onViewCustomer={(customer) => {
                  setActiveTab('customers')
                  handleViewDetail(customer)
                }}
              />
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

      {/* Keyboard Shortcuts Indicator */}
      <KeyboardShortcutsIndicator
        shortcuts={[
          { keys: ['Ctrl', 'N'], description: 'Nuevo Cliente', category: 'Acciones' },
          { keys: ['Ctrl', 'K'], description: 'Buscar Cliente', category: 'Navegación' },
          { keys: ['Ctrl', 'E'], description: 'Exportar Clientes', category: 'Acciones' },
          { keys: ['Ctrl', 'I'], description: 'Importar Clientes', category: 'Acciones' },
          { keys: ['F5'], description: 'Actualizar Lista', category: 'Navegación' },
          { keys: ['Shift', '?'], description: 'Mostrar Ayuda', category: 'Ayuda' },
          { keys: ['Escape'], description: 'Cancelar/Cerrar', category: 'Navegación' }
        ]}
        position="bottom-right"
      />
    </div>
  )
}
