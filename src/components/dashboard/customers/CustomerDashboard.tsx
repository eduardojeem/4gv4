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
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { 
  Users, 
  TrendingUp, 
  UserCheck, 
  Sparkles,
  BarChart3,
  PieChart,
  Activity,
  Bell,
  CreditCard,
  MessageSquare
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { ImprovedMetricCard } from './ImprovedMetricCard'
// Componentes cargados dinámicamente para reducir el peso inicial
// Componente mejorado de lista de clientes
const CustomerListView = dynamic(() => import("./CustomerListView").then(m => ({ default: m.CustomerListView })), { ssr: false })
const CustomerDetail = dynamic(() => import("./CustomerDetail").then(m => m.CustomerDetail), { ssr: false })
const CustomerEditFormV2 = dynamic(() => import("./CustomerEditFormV2").then(m => m.CustomerEditFormV2), { ssr: false })
const CustomerHistory = dynamic(() => import("./CustomerHistory").then(m => m.CustomerHistory), { ssr: false })
const CustomerFilters = dynamic(() => import("./CustomerFilters").then(m => m.CustomerFilters), { ssr: false })
import { CustomerModal } from './CustomerModal'
import { CustomerEditDialog } from './CustomerEditDialog'
// Componente consolidado de analíticas
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })))
// Componente consolidado de segmentación
const SegmentationSystem = lazy(() => import("./SegmentationSystem").then(m => ({ default: m.SegmentationSystem })))
const CustomerCommunications = lazy(() => import("./advanced/CustomerCommunications").then(m => ({ default: m.CustomerCommunications })))
const NotificationCenter = dynamic(() => import("./NotificationCenter").then(m => m.NotificationCenter), { ssr: false })
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


// Tipos para la navegación
type ViewState = 'list' | 'detail' | 'history' | 'edit'

export function CustomerDashboard() {
  const { 
    customers, 
    filteredCustomers, 
    paginatedCustomers, 
    filters, 
    loading, 
    error, 
    pagination,
    setPage,
    setItemsPerPage,
    updateFilters, 
    toggleCustomerStatus, 
    updateCustomer,
    updateCustomerStatus, 
    bulkUpdateCustomerStatus,
    refreshCustomers 
  } = useCustomers()
  
  // Handle customer selection from search
  const handleCustomerSelectFromSearch = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    setCurrentView('detail')
  }, [])

  // Enhanced updateFilters with search intelligence
  const handleFiltersChange = React.useCallback((newFilters: any) => {
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
  const { creditSummaries, getCustomerCreditSummary } = useCustomersWithCredits(customers)
  const [viewMode, setViewMode] = useState<"table" | "grid" | "timeline">("table")
  const [activeTab, setActiveTab] = useState("customers")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [compactMode, setCompactMode] = useState(true)
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  
  // Estados para navegación
  const [currentView, setCurrentView] = useState<ViewState>('list')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [selectedCreditCustomerId, setSelectedCreditCustomerId] = useState<string>("")
  const [creditSearchTerm, setCreditSearchTerm] = useState("")
  
  // Estados para búsqueda inteligente
  const [searchTime, setSearchTime] = useState(0)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])

  // Calculate stats including credit metrics
  const totalCustomers = customers.length
  const activeCustomers = useMemo(() => customers.filter(c => c.status === "active").length, [customers])
  const averageOrderValue = useMemo(() => {
    const total = customers.reduce((sum, c) => sum + c.lifetime_value, 0)
    return totalCustomers ? total / totalCustomers : 0
  }, [customers, totalCustomers])
  const totalRevenue = useMemo(() => customers.reduce((sum, c) => sum + c.lifetime_value, 0), [customers])

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
        change: "+12%",
        changeType: "positive" as const,
        gradient: "from-blue-500 to-cyan-500",
        description: `${activeCustomers} activos de ${totalCustomers} total`
      },
      {
        title: "Créditos Activos",
        value: creditMetrics.totalActiveCredits.toLocaleString(),
        icon: <CreditCard className="h-5 w-5" />,
        change: "+18%",
        changeType: "positive" as const,
        gradient: "from-green-500 to-emerald-500",
        description: `Créditos en estado activo`
      },
      {
        title: "Clientes con Crédito",
        value: creditMetrics.customersWithCredits.toLocaleString(),
        icon: <UserCheck className="h-5 w-5" />,
        change: "+15%",
        changeType: "positive" as const,
        gradient: "from-purple-500 to-violet-500",
        description: `${Math.round((creditMetrics.customersWithCredits / totalCustomers) * 100)}% del total`
      },
      {
        title: "Saldo Pendiente",
        value: formatCurrency(creditMetrics.totalPendingAmount),
        icon: <TrendingUp className="h-5 w-5" />,
        change: creditMetrics.overduePayments > 0 ? "-5%" : "+8%",
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
  } = useCredits()

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
        <h1>Historial de ${customer?.name || "Cliente"}</h1>
        <h2>Cuotas</h2>
        <table>
          <thead><tr><th>Cuota</th><th>Vence</th><th>Monto</th><th>Estado</th><th>Pagado</th><th>Método</th></tr></thead>
          <tbody>
            ${selectedInstallments.map(i => `
              <tr>
                <td>${i.installment_number}</td>
                <td>${new Date(i.due_date).toLocaleDateString()}</td>
                <td>${i.amount}</td>
                <td>${i.status}</td>
                <td>${i.amount_paid || 0}</td>
                <td>${i.payment_method || ""}</td>
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
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</td>
                <td>${p.credit_id}</td>
                <td>${p.installment_id || ""}</td>
                <td>${p.amount}</td>
                <td>${p.payment_method || ""}</td>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600 rounded-xl shadow-lg">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Gestión de Clientes
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Panel de control avanzado para la gestión integral de clientes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white border-0 text-xs sm:text-sm">
                IA Activada
              </Badge>
            </div>
            <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-800/70 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-700 dark:text-gray-300">Compacto</span>
              <Switch 
                checked={compactMode} 
                onCheckedChange={setCompactMode}
                className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Stats Cards - Using ImprovedMetricCard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={compactMode ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"}
        >
          {stats.map((stat, index) => (
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

        {/* Main Content - Responsive Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className={compactMode ? "space-y-3 sm:space-y-4" : "space-y-4 sm:space-y-6"}>
            {/* Mobile-Optimized Tab List */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2">
              <TabsList className={compactMode ? "grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1 bg-transparent h-auto p-0" : "grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-transparent h-auto p-0"}>
                <TabsTrigger 
                  value="customers" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Clientes</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analíticas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="segmentation" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <PieChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Segmentación</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="communications" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Comunicaciones</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="metrics" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Métricas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className={compactMode ? "flex flex-col sm:flex-row items-center gap-1 p-1 sm:p-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" : "flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notificaciones</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <TabsContent value="customers" className={compactMode ? "space-y-3 sm:space-y-4 mt-0" : "space-y-4 sm:space-y-6 mt-0"}>
              <div className={compactMode ? "space-y-3 sm:space-y-4" : "space-y-4 sm:space-y-6"}>
                {currentView === 'list' && (
                  <>
                    <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white/80 dark:bg-slate-800/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                          Créditos Activos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-2">
                          <Input
                            placeholder="Buscar cliente"
                            value={creditSearchTerm}
                            onChange={(e) => setCreditSearchTerm(e.target.value)}
                            className="lg:w-1/3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          />
                          <Select value={selectedCreditCustomerId} onValueChange={setSelectedCreditCustomerId}>
                            <SelectTrigger className="lg:w-1/3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                              <SelectValue placeholder="Seleccionar cliente" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                              {customersWithActiveCredits.map(c => (
                                <SelectItem key={c.id} value={c.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                                  {c.name} • {c.email || c.phone || ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryCSV} className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Exportar CSV</Button>
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryExcel} className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Exportar Excel</Button>
                            <Button variant="outline" size="sm" disabled={!selectedCreditCustomerId} onClick={exportSelectedHistoryPDF} className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Exportar PDF</Button>
                          </div>
                        </div>
                        {selectedCreditCustomerId && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <UpcomingInstallments
                              installments={selectedInstallments.filter(i => i.status === 'pending' || i.status === 'late')}
                              onMarkPaid={(id, method, amount) => markInstallmentPaid(id, method, amount)}
                              creditById={{}}
                            />
                            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
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
                      onCustomerSelect={handleViewDetail}
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
                      onDeleteCustomer={(customer) => {
                        // Implementar lógica de eliminación
                        console.log('Delete customer:', customer.id)
                      }}
                      onToggleCustomerStatus={handleToggleCustomerStatus}
                      onBulkStatusChange={handleBulkStatusChange}
                      loading={loading}
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
                  </>
                )}

                {currentView === 'detail' && selectedCustomer && (
                  <CustomerDetail
                    customer={selectedCustomer}
                    onBack={handleBackToList}
                    onEdit={handleEditCustomer}
                    onViewHistory={() => handleViewHistory(selectedCustomer)}
                    compact={compactMode}
                  />
                )}

                {currentView === 'history' && selectedCustomer && (
                  <CustomerHistory
                    customer={selectedCustomer}
                    onBack={handleBackToList}
                    onViewDetail={() => handleViewDetail(selectedCustomer)}
                  />
                )}

                {currentView === 'edit' && selectedCustomer && (
                  <CustomerEditFormV2
                    customer={selectedCustomer}
                    onSave={async (formData) => {
                      try {
                        const result = await updateCustomer(selectedCustomer.id, formData)
                        if (result.success) {
                          // Actualizar el cliente en la lista local si es necesible
                          handleBackToList()
                          // Refresh the customer list
                          await refreshCustomers()
                          toast.success('Cliente actualizado correctamente')
                        } else {
                          // Mostrar error específico al usuario
                          const errorMsg = (result as any).error || 'Error al actualizar cliente'
                          toast.error(errorMsg)
                          console.error('Update failed:', errorMsg)
                        }
                      } catch (error) {
                        console.error('Error updating customer:', error)
                        toast.error('Error inesperado al actualizar cliente')
                      }
                    }}
                    onCancel={handleBackToList}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <Suspense fallback={<div className="p-4"><Skeleton className="h-24 w-full" /></div>}>
                <AnalyticsDashboard customers={customers} mode="interactive" showPredictions={true} showComparisons={true} />
              </Suspense>
            </TabsContent>

            <TabsContent value="segmentation" className="mt-0">
              <Suspense fallback={<div className="p-4"><Skeleton className="h-24 w-full" /></div>}>
                <SegmentationSystem customers={customers} mode="advanced" showAIInsights={true} />
              </Suspense>
            </TabsContent>

            <TabsContent value="communications" className="mt-0">
              <Suspense fallback={<div className="p-4"><Skeleton className="h-24 w-full" /></div>}>
                <CustomerCommunications customers={customers} />
              </Suspense>
            </TabsContent>

            <TabsContent value="metrics" className="mt-0">
              <AnalyticsDashboard customers={customers} mode="realtime" compact={true} />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <NotificationCenter customers={customers} />
            </TabsContent>


          </Tabs>
        </motion.div>
      </div>

      {/* Modal para crear cliente */}
      {showCreateModal && (
        <CustomerModal
          customer={null}
          isOpen={showCreateModal}
          mode="create"
          onClose={() => setShowCreateModal(false)}
        />
      )}

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
