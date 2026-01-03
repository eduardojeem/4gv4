"use client"

/**
 * CustomerHistory - Componente consolidado
 * 
 * Combina funcionalidades de CustomerHistory, CustomerHistoryEnhanced y TransactionHistory
 * en un solo componente unificado con múltiples modos de visualización.
 * 
 * Características:
 * - Modo compacto/detallado/mejorado
 * - Historial completo de reparaciones y compras
 * - Timeline unificado de actividades
 * - Estadísticas y métricas avanzadas
 * - Filtros y búsqueda optimizada
 * - Exportación e impresión
 */

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Calendar,
  ShoppingBag,
  Wrench,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Download,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Star,
  FileText,
  Phone,
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Watch,
  Headphones,
  Camera,
  Gamepad2,
  Printer,
  Router,
  HardDrive,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  MapPin,
  User,
  Building,
  CreditCard,
  Receipt,
  History,
  BarChart3,
  PieChart,
  LineChart,
  ChevronDown,
  ChevronUp,
  ArrowUpDown
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Customer } from '@/hooks/use-customer-state'
import { useAuth } from '@/contexts/auth-context'
import { useDebounce } from '@/hooks/use-debounce'
import { config } from '@/lib/config'
import { generateReceiptNumber } from '@/lib/receipt-utils'
import { printRepairReceipt } from '@/lib/repair-receipt'
import { generatePersistentRepairTicketNumber, previewPersistentRepairTicketNumber } from '@/lib/repair-receipt'
import { formatCurrency } from '@/lib/currency'
import { useCustomerPurchases } from '@/hooks/useCustomerData'
import { useCustomerRepairs } from '@/hooks/useCustomerRepairs'
import { TimelineView } from './TimelineView'

interface CustomerHistoryProps {
  customer: Customer
  onBack: () => void
  onViewDetail?: () => void
  mode?: 'compact' | 'detailed' | 'enhanced'
}

// Tipos unificados para el historial
interface RepairRecord {
  id: string
  date: string
  device: string
  deviceType: 'phone' | 'laptop' | 'tablet' | 'watch' | 'other'
  issue: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  cost: number
  technician: string
  estimatedCompletion?: string
  notes?: string
}

interface PurchaseRecord {
  id: string
  date: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  status: 'completed' | 'pending' | 'cancelled' | 'refunded'
  paymentMethod: string
  invoiceNumber: string
}

interface HistoryItem {
  id: string
  type: 'repair' | 'purchase' | 'payment' | 'note'
  date: string
  title: string
  description: string
  amount?: number
  status: 'completed' | 'pending' | 'cancelled' | 'refunded' | 'in_progress'
  details?: any
}

// Datos de ejemplo (en una aplicación real, estos vendrían de la API)
const mockRepairs: RepairRecord[] = []

const mockPurchases: PurchaseRecord[] = []

function HistoryItemCard({ item, index, mode }: { item: HistoryItem; index: number; mode: string }) {
  const [expanded, setExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'refunded':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
        return <AlertCircle className="h-4 w-4" />
      case 'in_progress':
        return <RefreshCw className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <CreditCard className="h-5 w-5 text-blue-600" />
      case 'repair':
        return <Wrench className="h-5 w-5 text-orange-600" />
      case 'payment':
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case 'note':
        return <Activity className="h-5 w-5 text-purple-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const isCompact = mode === 'compact'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200"
    >
      <div className={isCompact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`${isCompact ? 'p-1' : 'p-2'} bg-gray-50 dark:bg-gray-800 rounded-lg`}>
              {getTypeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-semibold text-gray-900 dark:text-white truncate ${isCompact ? 'text-sm' : ''}`}>
                  {item.title}
                </h4>
                <Badge className={getStatusColor(item.status)}>
                  {getStatusIcon(item.status)}
                  <span className="ml-1 capitalize">{item.status}</span>
                </Badge>
              </div>
              <p className={`text-gray-600 dark:text-gray-400 mb-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {item.description}
              </p>
              <div className={`flex items-center gap-4 text-gray-500 ${isCompact ? 'text-xs' : 'text-xs'}`}>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(item.date).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(item.date).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.amount && (
              <div className="text-right">
                <p className={`font-bold text-gray-900 dark:text-white ${isCompact ? 'text-sm' : 'text-lg'}`}>
                  {formatCurrency(item.amount)}
                </p>
              </div>
            )}
            {mode === 'enhanced' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && mode === 'enhanced' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="space-y-3">
                {item.details && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <h5 className="font-medium text-sm text-gray-900 dark:text-white mb-2">
                      Detalles
                    </h5>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {JSON.stringify(item.details, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="h-3 w-3 mr-1" />
                    Ver detalles
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-3 w-3 mr-1" />
                    Descargar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function CustomerHistory({ customer, onBack, onViewDetail, mode = 'detailed' }: CustomerHistoryProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Estado para modales
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null)
  const [showPurchaseDetail, setShowPurchaseDetail] = useState(false)
  const [selectedRepair, setSelectedRepair] = useState<RepairRecord | null>(null)
  const [showRepairDetail, setShowRepairDetail] = useState(false)

  // Debounce de búsqueda para reducir re-renders
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Datos desde hooks con fallback a mock
  const { data: purchasesData } = useCustomerPurchases(customer.id)
  const { repairs, loading: loadingRepairs, fetchPendingRepairs } = useCustomerRepairs()

  // Fetch repairs when component mounts
  React.useEffect(() => {
    fetchPendingRepairs(customer.id)
  }, [customer.id, fetchPendingRepairs])

  const purchases: PurchaseRecord[] = useMemo(() => {
    return (Array.isArray(purchasesData) && purchasesData.length)
      ? (purchasesData as unknown as PurchaseRecord[])
      : mockPurchases
  }, [purchasesData])

  const repairRecords: RepairRecord[] = useMemo(() => {
    if (repairs && repairs.length > 0) {
      return repairs.map(repair => ({
        id: repair.id,
        date: repair.created_at || new Date().toISOString(),
        device: `${repair.device_brand} ${repair.device_model}`,
        deviceType: 'other' as const,
        issue: repair.problem_description,
        status: repair.status === 'completed' ? 'completed' : 
                repair.status === 'cancelled' ? 'cancelled' : 
                repair.status === 'in_progress' ? 'in_progress' : 'pending',
        cost: repair.estimated_cost || 0,
        technician: 'No asignado', // CustomerRepair doesn't have technician info
        notes: '' // CustomerRepair doesn't have notes
      }))
    }
    return mockRepairs
  }, [repairs])

  // Helper de rango de fechas para filtros
  const isWithinDateFilter = (dateStr: string, filter: string) => {
    if (filter === 'all') return true
    const date = new Date(dateStr)
    const now = new Date()
    const start = new Date(now)
    if (filter === 'last_month') {
      start.setMonth(now.getMonth() - 1)
    } else if (filter === 'last_3_months') {
      start.setMonth(now.getMonth() - 3)
    } else if (filter === 'last_year') {
      start.setFullYear(now.getFullYear() - 1)
    } else {
      return true
    }
    return date >= start && date <= now
  }

  // Combinar todos los elementos del historial
  const allHistoryItems = useMemo(() => {
    const items: HistoryItem[] = []

    // Agregar compras
    purchases.forEach(purchase => {
      items.push({
        id: `purchase-${purchase.id}`,
        type: 'purchase',
        date: purchase.date,
        title: `Compra #${purchase.invoiceNumber}`,
        description: `${purchase.items.length} artículo${purchase.items.length > 1 ? 's' : ''} - ${purchase.paymentMethod}`,
        amount: purchase.total,
        status: purchase.status,
        details: purchase
      })
    })

    // Agregar reparaciones
    repairRecords.forEach(repair => {
      items.push({
        id: `repair-${repair.id}`,
        type: 'repair',
        date: repair.date,
        title: `Reparación: ${repair.device}`,
        description: `${repair.issue} - ${repair.technician}`,
        amount: repair.cost,
        status: repair.status,
        details: repair
      })
    })

    // Ordenar por fecha (más reciente primero)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [purchases, repairRecords])

  // Filtrar elementos del historial
  const filteredItems = useMemo(() => {
    let filtered = allHistoryItems

    // Filtrar por tipo de tab
    if (activeTab !== "overview" && activeTab !== "timeline" && activeTab !== "all") {
      const tabTypeMap: Record<string, string> = {
        'repairs': 'repair',
        'purchases': 'purchase'
      }
      if (tabTypeMap[activeTab]) {
        filtered = filtered.filter(item => item.type === tabTypeMap[activeTab])
      }
    }

    // Filtrar por tipo específico
    if (typeFilter !== "all") {
      filtered = filtered.filter(item => item.type === typeFilter)
    }

    // Filtrar por término de búsqueda
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
      )
    }

    // Filtrar por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter)
    }

    // Filtrar por fecha
    if (dateFilter !== "all") {
      filtered = filtered.filter(item => isWithinDateFilter(item.date, dateFilter))
    }

    // Ordenar
    return filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      } else {
        const amountA = a.amount || 0
        const amountB = b.amount || 0
        return sortOrder === 'desc' ? amountB - amountA : amountA - amountB
      }
    })
  }, [allHistoryItems, activeTab, typeFilter, debouncedSearchTerm, statusFilter, dateFilter, sortBy, sortOrder])

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'phone': return <Smartphone className="h-4 w-4" />
      case 'laptop': return <Laptop className="h-4 w-4" />
      case 'tablet': return <Tablet className="h-4 w-4" />
      case 'watch': return <Watch className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'refunded': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'in_progress': return <RefreshCw className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calcular estadísticas
  const stats = useMemo(() => {
    const totalRepairs = repairRecords.length
    const totalRepairCost = repairRecords.reduce((sum, repair) => sum + repair.cost, 0)
    const totalPurchases = purchases.length
    const totalPurchaseAmount = purchases.reduce((sum, purchase) => sum + purchase.total, 0)
    const totalSpent = totalRepairCost + totalPurchaseAmount
    const avgOrderValue = totalPurchases > 0 ? totalPurchaseAmount / totalPurchases : 0
    const totalRefunds = purchases
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + p.total, 0)

    return {
      totalRepairs,
      totalRepairCost,
      totalPurchases,
      totalPurchaseAmount,
      totalSpent,
      avgOrderValue,
      totalRefunds
    }
  }, [repairRecords, purchases])

  const isCompact = mode === 'compact'
  const isEnhanced = mode === 'enhanced'

  return (
    <div className={isCompact ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-4"}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-3"}>
            <Avatar className={isCompact ? "h-8 w-8" : "h-10 w-10"}>
              <AvatarImage src={customer.avatar || undefined} alt={customer.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                {customer.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className={`font-bold text-gray-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
                Historial de {customer.name}
              </h1>
              <p className={`text-gray-600 dark:text-gray-400 ${isCompact ? 'text-sm' : ''}`}>
                {filteredItems.length} registros encontrados
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reparación
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className={isCompact ? "grid grid-cols-2 lg:grid-cols-4 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"}>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className={isCompact ? "p-4" : "p-6"}>
            <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-3"}>
              <div className={isCompact ? "p-2 bg-blue-500 rounded-lg" : "p-3 bg-blue-500 rounded-lg"}>
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className={`font-medium text-blue-700 dark:text-blue-300 ${isCompact ? 'text-xs' : 'text-sm'}`}>Total Reparaciones</p>
                <p className={`font-bold text-blue-900 dark:text-blue-100 ${isCompact ? 'text-xl' : 'text-2xl'}`}>{stats.totalRepairs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className={isCompact ? "p-4" : "p-6"}>
            <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-3"}>
              <div className={isCompact ? "p-2 bg-green-500 rounded-lg" : "p-3 bg-green-500 rounded-lg"}>
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className={`font-medium text-green-700 dark:text-green-300 ${isCompact ? 'text-xs' : 'text-sm'}`}>Total Compras</p>
                <p className={`font-bold text-green-900 dark:text-green-100 ${isCompact ? 'text-xl' : 'text-2xl'}`}>{stats.totalPurchases}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className={isCompact ? "p-4" : "p-6"}>
            <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-3"}>
              <div className={isCompact ? "p-2 bg-purple-500 rounded-lg" : "p-3 bg-purple-500 rounded-lg"}>
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className={`font-medium text-purple-700 dark:text-purple-300 ${isCompact ? 'text-xs' : 'text-sm'}`}>Valor Promedio</p>
                <p className={`font-bold text-purple-900 dark:text-purple-100 ${isCompact ? 'text-xl' : 'text-2xl'}`}>{formatCurrency(stats.avgOrderValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <CardContent className={isCompact ? "p-4" : "p-6"}>
            <div className={isCompact ? "flex items-center gap-2" : "flex items-center gap-3"}>
              <div className={isCompact ? "p-2 bg-orange-500 rounded-lg" : "p-3 bg-orange-500 rounded-lg"}>
                <GSIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className={`font-medium text-orange-700 dark:text-orange-300 ${isCompact ? 'text-xs' : 'text-sm'}`}>Total Gastado</p>
                <p className={`font-bold text-orange-900 dark:text-orange-100 ${isCompact ? 'text-xl' : 'text-2xl'}`}>{formatCurrency(stats.totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className={isCompact ? "p-3" : "p-4"}>
          <div className={isCompact ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-4"}>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar en historial..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={isCompact ? "pl-10 h-8" : "pl-10"}
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={isCompact ? "w-32 h-8" : "w-[140px]"}>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="repair">Reparaciones</SelectItem>
                <SelectItem value="purchase">Compras</SelectItem>
                <SelectItem value="payment">Pagos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={isCompact ? "w-32 h-8" : "w-[120px]"}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className={isCompact ? "w-32 h-8" : "w-[140px]"}>
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="last_month">Último mes</SelectItem>
                <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
                <SelectItem value="last_year">Último año</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSortBy(sortBy === 'date' ? 'amount' : 'date')
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
              }}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {sortBy === 'date' ? 'Fecha' : 'Monto'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      {isEnhanced ? (
        // Modo mejorado con cards expandibles
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <History className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sin registros
              </h3>
              <p className="text-gray-500">
                No se encontraron registros con los filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <HistoryItemCard key={item.id} item={item} index={index} mode={mode} />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Modo detallado/compacto con tabs
        <Tabs value={activeTab} onValueChange={setActiveTab} className={isCompact ? "space-y-4" : "space-y-6"}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className={isCompact ? "p-1 sm:p-2 text-xs" : "p-2 sm:p-3 text-sm"}>
              Resumen
            </TabsTrigger>
            <TabsTrigger value="repairs" className={isCompact ? "p-1 sm:p-2 text-xs" : "p-2 sm:p-3 text-sm"}>
              Reparaciones ({repairRecords.length})
            </TabsTrigger>
            <TabsTrigger value="purchases" className={isCompact ? "p-1 sm:p-2 text-xs" : "p-2 sm:p-3 text-sm"}>
              Compras ({purchases.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className={isCompact ? "p-1 sm:p-2 text-xs" : "p-2 sm:p-3 text-sm"}>
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className={isCompact ? "space-y-4" : "space-y-6"}>
            <div className={isCompact ? "grid grid-cols-1 lg:grid-cols-2 gap-3" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
              {/* Últimas reparaciones */}
              <Card>
                <CardHeader className={isCompact ? "p-3" : "p-4"}>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Últimas Reparaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className={isCompact ? "p-3" : "p-4"}>
                  <div className={isCompact ? "space-y-3" : "space-y-4"}>
                    {repairRecords.slice(0, 3).map((repair) => (
                      <div key={repair.id} className={isCompact ? "flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg" : "flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"}>
                        <div className={isCompact ? "p-1 bg-blue-100 dark:bg-blue-900 rounded-lg" : "p-2 bg-blue-100 dark:bg-blue-900 rounded-lg"}>
                          {getDeviceIcon(repair.deviceType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={isCompact ? "font-medium text-gray-900 dark:text-white truncate text-sm" : "font-medium text-gray-900 dark:text-white truncate"}>{repair.device}</p>
                          <p className={isCompact ? "text-xs text-gray-600 dark:text-gray-400" : "text-sm text-gray-600 dark:text-gray-400"}>{repair.issue}</p>
                          <div className={isCompact ? "flex items-center gap-1 mt-1" : "flex items-center gap-2 mt-1"}>
                            <Badge className={`text-xs ${getStatusColor(repair.status)}`}>
                              {repair.status === 'completed' ? 'Completada' :
                                repair.status === 'in_progress' ? 'En Progreso' :
                                  repair.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                            </Badge>
                            <span className="text-xs text-gray-500">{formatDate(repair.date)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={isCompact ? "font-semibold text-gray-900 dark:text-white text-sm" : "font-semibold text-gray-900 dark:text-white"}>{formatCurrency(repair.cost)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Últimas compras */}
              <Card>
                <CardHeader className={isCompact ? "p-3" : "p-4"}>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Últimas Compras
                  </CardTitle>
                </CardHeader>
                <CardContent className={isCompact ? "p-3" : "p-4"}>
                  <div className={isCompact ? "space-y-3" : "space-y-4"}>
                    {purchases.slice(0, 3).map((purchase) => (
                      <div key={purchase.id} className={isCompact ? "flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg" : "flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"}>
                        <div className={isCompact ? "p-1 bg-green-100 dark:bg-green-900 rounded-lg" : "p-2 bg-green-100 dark:bg-green-900 rounded-lg"}>
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {purchase.items.length} artículo{purchase.items.length > 1 ? 's' : ''}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {purchase.items[0].name}
                            {purchase.items.length > 1 && ` y ${purchase.items.length - 1} más`}
                          </p>
                          <div className={isCompact ? "flex items-center gap-1 mt-1" : "flex items-center gap-2 mt-1"}>
                            <Badge className={`text-xs ${getStatusColor(purchase.status)}`}>
                              {purchase.status === 'completed' ? 'Completada' :
                                purchase.status === 'pending' ? 'Pendiente' :
                                  purchase.status === 'cancelled' ? 'Cancelada' : 'Reembolsada'}
                            </Badge>
                            <span className="text-xs text-gray-500">{formatDate(purchase.date)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(purchase.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="repairs" className={isCompact ? "space-y-4" : "space-y-6"}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Historial de Reparaciones
                  </span>
                  <Badge variant="secondary">{repairRecords.length} reparaciones</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead>Problema</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Costo</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairRecords.map((repair) => (
                        <TableRow key={repair.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(repair.date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(repair.deviceType)}
                              <span className="font-medium">{repair.device}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{repair.issue}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(repair.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(repair.status)}
                                <span>
                                  {repair.status === 'completed' ? 'Completada' :
                                    repair.status === 'in_progress' ? 'En Progreso' :
                                      repair.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                </span>
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{repair.technician}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{formatCurrency(repair.cost)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedRepair(repair)
                                  setShowRepairDetail(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className={isCompact ? "space-y-4" : "space-y-6"}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Historial de Compras
                  </span>
                  <Badge variant="secondary">{purchases.length} compras</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Artículos</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(purchase.date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{purchase.invoiceNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{purchase.items.length} artículo{purchase.items.length > 1 ? 's' : ''}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {purchase.items[0].name}
                                {purchase.items.length > 1 && ` y ${purchase.items.length - 1} más`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(purchase.status)}>
                              {purchase.status === 'completed' ? 'Completada' :
                                purchase.status === 'pending' ? 'Pendiente' :
                                  purchase.status === 'cancelled' ? 'Cancelada' : 'Reembolsada'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{purchase.paymentMethod}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{formatCurrency(purchase.total)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedPurchase(purchase)
                                  setShowPurchaseDetail(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className={isCompact ? "space-y-4" : "space-y-6"}>
            <TimelineView
              customers={[customer]}
              onCustomerSelect={() => {}}
              selectedCustomerId={customer.id}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Modales */}
      <Dialog open={showRepairDetail} onOpenChange={setShowRepairDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Reparación</DialogTitle>
          </DialogHeader>
          {selectedRepair && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Dispositivo</label>
                  <p className="text-gray-900">{selectedRepair.device}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Fecha</label>
                  <p className="text-gray-900">{formatDate(selectedRepair.date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Problema</label>
                  <p className="text-gray-900">{selectedRepair.issue}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Técnico</label>
                  <p className="text-gray-900">{selectedRepair.technician}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Estado</label>
                  <Badge className={getStatusColor(selectedRepair.status)}>
                    {selectedRepair.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Costo</label>
                  <p className="text-gray-900 font-semibold">{formatCurrency(selectedRepair.cost)}</p>
                </div>
              </div>
              {selectedRepair.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Notas</label>
                  <p className="text-gray-900">{selectedRepair.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPurchaseDetail} onOpenChange={setShowPurchaseDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de Compra</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Factura</label>
                  <p className="text-gray-900 font-mono">{selectedPurchase.invoiceNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Fecha</label>
                  <p className="text-gray-900">{formatDate(selectedPurchase.date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Método de Pago</label>
                  <p className="text-gray-900">{selectedPurchase.paymentMethod}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Estado</label>
                  <Badge className={getStatusColor(selectedPurchase.status)}>
                    {selectedPurchase.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Artículos</label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchase.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell>{formatCurrency(item.price * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-4">
                  <div className="text-right">
                    <p className="text-lg font-semibold">Total: {formatCurrency(selectedPurchase.total)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}