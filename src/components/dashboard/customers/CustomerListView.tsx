"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import {
  Grid3X3,
  List,
  Search,
  SortAsc,
  SortDesc,
  Mail,
  Phone,
  MapPin,
  Eye,
  History,
  Star,
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  Clock,
  Power,
  PowerOff,
  ShoppingBag,
  Wrench,
  Copy,
  Check,
  CreditCard
} from 'lucide-react'
import { toast } from 'sonner'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerSalesMetricsMap, CustomerMetrics } from '@/hooks/use-customer-metrics'
import { StatusBadge, StatusToggle, BulkStatusSelector } from '@/components/ui/StatusBadge'
import { formatters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { CustomerCreditBadge } from './CustomerCreditBadge'
import { CustomerCreditSummary } from '@/hooks/use-customer-credits'

interface CustomerListViewProps {
  customers: Customer[]
  selectedCustomers: string[]
  creditSummaries?: Record<string, CustomerCreditSummary>

  onCustomerToggle: (customerId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  viewMode: 'table' | 'grid' | 'timeline'
  onViewModeChange: (mode: 'table' | 'grid' | 'timeline') => void
  onBulkDelete?: (customerIds: string[]) => void
  bulkDeleting?: boolean
  onToggleCustomerStatus?: (customer: Customer) => void
  onBulkStatusChange?: (customerIds: string[], status: 'active' | 'inactive' | 'suspended' | 'pending') => void
  loading?: boolean
  compact?: boolean
}
type SortField = 'name' | 'email' | 'phone' | 'status' | 'lifetime_value' | 'last_activity' | 'total_purchases'
type SortOrder = 'asc' | 'desc'

export function CustomerListView({
  customers,
  selectedCustomers,
  creditSummaries = {},

  onCustomerToggle,
  onSelectAll,
  onClearSelection,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  viewMode,
  onViewModeChange,
  onBulkDelete,
  bulkDeleting = false,
  onToggleCustomerStatus,
  onBulkStatusChange,
  compact = false
}: CustomerListViewProps) {
  const { isAdmin, isManager } = useAuth()
  const canDelete = isAdmin || isManager
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const effectiveViewMode = viewMode === 'grid' ? 'grid' : 'table'

  // Filtrar y ordenar clientes
  const processedCustomers = useMemo(() => {
    let filtered = [...customers]

    // Aplicar búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(customer =>
        (customer.name && customer.name.toLowerCase().includes(search)) ||
        (customer.email && customer.email.toLowerCase().includes(search)) ||
        (customer.phone && customer.phone.includes(search))
      )
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      let aValue: unknown = a[sortField as keyof Customer]
      let bValue: unknown = b[sortField as keyof Customer]

      // Manejar valores especiales
      if (sortField === 'lifetime_value') {
        aValue = a.lifetime_value || 0
        bValue = b.lifetime_value || 0
      } else if (sortField === 'last_activity') {
        aValue = new Date(a.last_activity || 0).getTime()
        bValue = new Date(b.last_activity || 0).getTime()
      } else {
        aValue = String(aValue || '').toLowerCase()
        bValue = String(bValue || '').toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [customers, searchTerm, sortField, sortOrder])

  const metricsMap = useCustomerSalesMetricsMap(processedCustomers.map(c => c.id))

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const allSelected = selectedCustomers.length === processedCustomers.length && processedCustomers.length > 0
  const someSelected = selectedCustomers.length > 0 && selectedCustomers.length < processedCustomers.length

  return (
    <div className="space-y-4">
      {/* Header con controles */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-muted-foreground">
            {processedCustomers.length} cliente{processedCustomers.length !== 1 ? 's' : ''}
            {selectedCustomers.length > 0 && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                ({selectedCustomers.length} seleccionado{selectedCustomers.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de vista */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={effectiveViewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="h-8 px-3"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>

          {/* Acciones de selección */}
          {selectedCustomers.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline" 
                size="sm" 
                onClick={onClearSelection}
                className="hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Limpiar ({selectedCustomers.length})
              </Button>
              
              {/* Selector de estado masivo */}
              {onBulkStatusChange && (
                <BulkStatusSelector
                  selectedCount={selectedCustomers.length}
                  onStatusChange={(status) => onBulkStatusChange(selectedCustomers, status)}
                />
              )}
              
              {canDelete && (
                <Button
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (bulkDeleting) return
                    onBulkDelete?.(selectedCustomers)
                  }}
                  disabled={!onBulkDelete || selectedCustomers.length === 0 || bulkDeleting}
                  className="hover:bg-red-600 dark:hover:bg-red-600/90"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {bulkDeleting ? 'Eliminando...' : 'Eliminar'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contenido según vista */}
      <AnimatePresence mode="wait">
        {effectiveViewMode === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TableView
              customers={processedCustomers}
              selectedCustomers={selectedCustomers}
              allSelected={allSelected}
              someSelected={someSelected}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              onSelectAll={allSelected ? onClearSelection : onSelectAll}
              onCustomerToggle={onCustomerToggle}
              onViewCustomer={onViewCustomer}
              onEditCustomer={onEditCustomer}
              onDeleteCustomer={onDeleteCustomer}
              onToggleCustomerStatus={onToggleCustomerStatus}
              metricsMap={metricsMap}
              creditSummaries={creditSummaries}
              compact={compact}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <GridView
              customers={processedCustomers}
              selectedCustomers={selectedCustomers}
              onCustomerToggle={onCustomerToggle}
              onViewCustomer={onViewCustomer}
              onEditCustomer={onEditCustomer}
              onDeleteCustomer={onDeleteCustomer}
              onToggleCustomerStatus={onToggleCustomerStatus}
              metricsMap={metricsMap}
              creditSummaries={creditSummaries}
              compact={compact}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function getEffectiveCreditSummary(customer: Customer, summary?: CustomerCreditSummary | null): CustomerCreditSummary | null {
  if (summary) return summary
  if (!customer.credit_limit && !customer.pending_amount && !customer.current_balance) return null

  const limit = customer.credit_limit || 0
  const pending = customer.pending_amount || customer.current_balance || 0
  const available = Math.max(0, limit - pending)
  const utilization = limit > 0 ? Math.min(100, Math.round((pending / limit) * 100)) : 0

  return {
    customer_id: customer.id,
    total_credits: 0,
    active_credits: pending > 0 ? 1 : 0,
    completed_credits: 0,
    defaulted_credits: 0,
    total_principal: limit,
    total_paid: 0,
    total_pending: pending,
    current_balance: pending,
    credit_limit: limit,
    available_credit: available,
    credit_utilization: utilization,
    store_balance: 0,
    store_reserved: 0,
    overdue_debt: 0,
    debts: [],
    payment_history: {
      on_time_payments: 0,
      late_payments: 0,
      missed_payments: 0,
      payment_score: 100
    },
    next_payment: null,
    risk_assessment: {
      risk_level: 'low',
      risk_score: 100,
      factors: []
    }
  }
}

function getFormattedWhatsAppUrl(customer: Customer): string | null {
  if (!customer.phone) return null
  let digits = customer.phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '595' + digits.slice(1)
  }
  const text = encodeURIComponent(`Hola ${customer.name || ''}, te contactamos de atención al cliente.`)
  return `https://wa.me/${digits}?text=${text}`
}

function handleCopy(e: React.MouseEvent, text: string, label: string) {
  e.stopPropagation()
  navigator.clipboard.writeText(text)
  toast.success(`${label} copiado`)
}

// Componente para vista de tabla
function TableView({
  customers,
  selectedCustomers,
  allSelected,
  someSelected,
  sortField,
  sortOrder,
  onSort,
  onSelectAll,
  onCustomerToggle,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onToggleCustomerStatus,
  metricsMap,
  creditSummaries = {},
  compact = false
}: {
  customers: Customer[]
  selectedCustomers: string[]
  allSelected: boolean
  someSelected: boolean
  sortField: SortField
  sortOrder: SortOrder
  onSort: (field: SortField) => void
  onSelectAll: () => void
  onCustomerToggle: (customerId: string) => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onToggleCustomerStatus?: (customer: Customer) => void
  metricsMap: Record<string, CustomerMetrics>
  creditSummaries?: Record<string, CustomerCreditSummary>
  compact?: boolean
}) {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="h-3.5 w-3.5 text-blue-500" /> : <SortDesc className="h-3.5 w-3.5 text-blue-500" />
  }

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-white/[0.02]">
              <TableRow className="border-b border-slate-200 dark:border-white/10 hover:bg-transparent">
                <TableHead className={cn("w-10 pl-4", compact ? "py-1.5" : "py-3")}>
                  <Checkbox
                    checked={allSelected || someSelected}
                    onCheckedChange={onSelectAll}
                    className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('name')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Cliente
                    {renderSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('email')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Contacto
                    {renderSortIcon('email')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('status')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Estado
                    {renderSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('lifetime_value')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Total Gastado
                    {renderSortIcon('lifetime_value')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('total_purchases')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Compras
                    {renderSortIcon('total_purchases')}
                  </div>
                </TableHead>
                <TableHead className={cn("font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "py-1.5 text-[10px]" : "py-3 text-[11px]")}>
                  Última Compra
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors", compact ? "py-1.5" : "py-3")}
                  onClick={() => onSort('last_activity')}
                >
                  <div className={cn("flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
                    Actividad
                    {renderSortIcon('last_activity')}
                  </div>
                </TableHead>
                <TableHead className={cn("font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "py-1.5 text-[10px]" : "py-3 text-[11px]")}>
                  Estado Deuda
                </TableHead>
                <TableHead className={cn("w-16 pr-4 text-right font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", compact ? "py-1.5 text-[10px]" : "py-3 text-[11px]")}>
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer, index) => {
                const whatsappUrl = getFormattedWhatsAppUrl(customer)

                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "group border-b border-slate-100 transition-colors cursor-pointer hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-white/[0.03]",
                      compact ? "h-11" : "h-14"
                    )}
                    onClick={() => onViewCustomer(customer)}
                  >
                    <TableCell className={cn("pl-4", compact ? "py-1.5" : "py-3")} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={() => onCustomerToggle(customer.id)}
                        className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className="flex items-center gap-2.5">
                        <Avatar className={cn("border border-slate-200 dark:border-white/10 shrink-0", compact ? "h-7 w-7" : "h-9 w-9")}>
                          <AvatarImage src={customer.avatar} />
                          <AvatarFallback className={cn("bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold", compact ? "text-[10px]" : "text-xs")}>
                            {(customer.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className={cn("font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5", compact ? "text-xs leading-tight" : "text-sm")}>
                            {customer.name}
                            {customer.segment === 'vip' && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                          </div>
                          <div className={cn("font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1", compact ? "text-[10px]" : "text-xs")}>
                            <span>{customer.customerCode || customer.ruc || 'S/C'}</span>
                            {(customer.customerCode || customer.ruc) && (
                              <button
                                type="button"
                                onClick={(e) => handleCopy(e, customer.customerCode || customer.ruc || '', 'Código/RUC')}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-foreground"
                                title="Copiar código"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className={compact ? "space-y-0.5" : "space-y-1"}>
                        {customer.email && (
                          <div 
                            onClick={(e) => handleCopy(e, customer.email!, 'Email')}
                            className={cn("flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-foreground cursor-pointer group/c", compact ? "text-[11px]" : "text-xs")}
                            title="Clic para copiar email"
                          >
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{customer.email}</span>
                            <Copy className="h-2.5 w-2.5 opacity-0 group-hover/c:opacity-100 text-muted-foreground transition-opacity" />
                          </div>
                        )}
                        {customer.phone && (
                          <div className={cn("flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-400", compact ? "text-[11px]" : "text-xs")}>
                            <div 
                              onClick={(e) => handleCopy(e, customer.phone!, 'Teléfono')}
                              className="flex items-center gap-1 hover:text-foreground cursor-pointer group/c"
                              title="Clic para copiar teléfono"
                            >
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{customer.phone}</span>
                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover/c:opacity-100 text-muted-foreground transition-opacity" />
                            </div>
                            {whatsappUrl && (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-semibold transition-colors"
                                title="Abrir chat en WhatsApp"
                              >
                                <MessageCircle className="h-3 w-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-start">
                        {onToggleCustomerStatus ? (
                          <StatusToggle
                            status={customer.status}
                            onToggle={() => onToggleCustomerStatus(customer)}
                            size="sm"
                          />
                        ) : (
                          <StatusBadge status={customer.status} size="sm" />
                        )}
                        {customer.segment && customer.segment !== 'regular' && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-semibold border uppercase tracking-wider",
                              compact ? "text-[9px] px-1 py-0" : "text-[10px]",
                              customer.segment === 'vip' 
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : customer.segment === 'wholesale'
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                  : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                            )}
                          >
                            {customer.segment}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className={cn("font-bold tabular-nums text-slate-900 dark:text-white", compact ? "text-xs" : "text-sm")}>
                        {formatters.currency((metricsMap[customer.id]?.total ?? (customer as unknown as { total_spent_this_year?: number }).total_spent_this_year ?? customer.lifetime_value) || 0)}
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className={cn("font-semibold tabular-nums text-slate-700 dark:text-slate-300", compact ? "text-xs" : "text-sm")}>
                        {/* purchaseCount, no count: la columna se llama "Compras"
                            y count incluye tambien las reparaciones. */}
                        {(metricsMap[customer.id]?.purchaseCount ?? customer.total_purchases ?? 0)}
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className="space-y-0.5">
                        <div className={cn("font-medium tabular-nums text-slate-800 dark:text-slate-200", compact ? "text-[11px]" : "text-xs")}>
                          {formatters.currency((metricsMap[customer.id]?.lastAmount ?? customer.last_purchase_amount ?? 0))}
                        </div>
                        {customer.city && (
                          <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
                            {customer.city}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")}>
                      <div className="space-y-0.5">
                        <div className={cn("font-medium text-slate-700 dark:text-slate-300", compact ? "text-[11px]" : "text-xs")}>
                          {formatters.date(customer.last_activity)}
                        </div>
                        <div className={cn("text-slate-400 dark:text-slate-500", compact ? "text-[10px]" : "text-[11px]")}>
                          {getRelativeTime(customer.last_activity)}
                        </div>
                      </div>
                    </TableCell>
                    {/* Columna deuda y crédito */}
                    <TableCell className={cn(compact ? "py-1.5" : "py-3")} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-start">
                        {customer.credit_limit > 0 && (
                          <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            <CreditCard className="h-3 w-3 text-emerald-600" />
                            <span>Límite: {formatters.currency(customer.credit_limit)}</span>
                          </div>
                        )}
                        <CustomerCreditBadge
                          creditSummary={getEffectiveCreditSummary(customer, creditSummaries[customer.id])}
                          variant="compact"
                          showTooltip
                        />
                      </div>
                    </TableCell>
                    <TableCell className={cn("pr-4 text-right", compact ? "py-1.5" : "py-3")} onClick={(e) => e.stopPropagation()}>
                      <CustomerActions
                        customer={customer}
                        onView={() => onViewCustomer(customer)}
                        onEdit={() => onEditCustomer(customer)}
                        onDelete={() => onDeleteCustomer(customer)}
                        onToggleStatus={onToggleCustomerStatus ? () => onToggleCustomerStatus(customer) : undefined}
                      />
                    </TableCell>
                  </motion.tr>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para vista de cuadrícula
function GridView({
  customers,
  selectedCustomers,
  onCustomerToggle,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onToggleCustomerStatus,
  metricsMap,
  creditSummaries = {},
  compact = false
}: {
  customers: Customer[]
  selectedCustomers: string[]
  onCustomerToggle: (customerId: string) => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onToggleCustomerStatus?: (customer: Customer) => void
  metricsMap: Record<string, CustomerMetrics>
  creditSummaries?: Record<string, CustomerCreditSummary>
  compact?: boolean
}) {
  return (
    <div className={cn(
      "grid",
      compact 
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5" 
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    )}>
      {customers.map((customer, index) => (
        <motion.div
          key={customer.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.02 }}
        >
          <CustomerCard
            customer={customer}
            selected={selectedCustomers.includes(customer.id)}
            onToggle={() => onCustomerToggle(customer.id)}
            onView={() => onViewCustomer(customer)}
            onEdit={() => onEditCustomer(customer)}
            onDelete={() => onDeleteCustomer(customer)}
            onToggleStatus={onToggleCustomerStatus ? () => onToggleCustomerStatus(customer) : undefined}
            metricsMap={metricsMap}
            creditSummary={creditSummaries[customer.id] ?? null}
            compact={compact}
          />
        </motion.div>
      ))}
    </div>
  )
}

// Componente de tarjeta de cliente mejorada (Vista en Cuadrícula)
function CustomerCard({
  customer,
  selected,
  onToggle,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  metricsMap,
  creditSummary,
  compact = false
}: {
  customer: Customer
  selected: boolean
  onToggle: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleStatus?: () => void
  metricsMap: Record<string, CustomerMetrics>
  creditSummary?: CustomerCreditSummary | null
  compact?: boolean
}) {
  const whatsappUrl = getFormattedWhatsAppUrl(customer)

  return (
    <Card className={cn(
      "group relative flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer",
      "border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]",
      "hover:border-blue-400 hover:shadow-md dark:hover:border-blue-500/40 dark:hover:shadow-black/40",
      selected && "ring-2 ring-blue-500 border-blue-300 dark:border-blue-500/50 shadow-md"
    )}>
      <CardContent className={cn("flex flex-col justify-between h-full", compact ? "p-3" : "p-4.5")}>
        <div>
          {/* Header con checkbox, badges superiores y acciones */}
          <div className={cn("flex items-center justify-between gap-1.5", compact ? "mb-2" : "mb-3")}>
            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                onClick={(e) => e.stopPropagation()}
                className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <span className="text-[10.5px] font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                {customer.customerCode || customer.ruc || 'S/C'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {customer.customer_type === 'premium' && (
                <Badge className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-400/20 dark:text-amber-300">
                  <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400 text-amber-400" />
                  Premium
                </Badge>
              )}
              <CustomerActions
                customer={customer}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleStatus={onToggleStatus}
              />
            </div>
          </div>

          {/* Avatar, Nombre y Segmento */}
          <div className={cn("flex items-start gap-2.5", compact ? "mb-2.5" : "mb-3.5")} onClick={onView}>
            <Avatar className={cn("border border-slate-200 dark:border-white/10 shrink-0 mt-0.5 shadow-sm", compact ? "h-8 w-8" : "h-11 w-11")}>
              <AvatarImage src={customer.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs">
                {(customer.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className={cn("font-bold text-slate-900 dark:text-white truncate flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors", compact ? "text-xs" : "text-base")}>
                {customer.name}
                {customer.segment === 'vip' && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {onToggleStatus ? (
                  <StatusToggle
                    status={customer.status}
                    onToggle={onToggleStatus}
                    size="sm"
                  />
                ) : (
                  <StatusBadge status={customer.status} size="sm" />
                )}
                {customer.segment && customer.segment !== 'regular' && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "font-semibold border uppercase tracking-wider",
                      compact ? "text-[9px] px-1 py-0" : "text-[10px]",
                      customer.segment === 'vip' 
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : customer.segment === 'wholesale'
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                          : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400"
                    )}
                  >
                    {customer.segment}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contacto directo y WhatsApp */}
          <div className={cn("rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5", compact ? "p-1.5 space-y-1 mb-2.5 text-[11px]" : "p-2.5 space-y-1.5 mb-3.5 text-xs")}>
            {customer.email && (
              <div 
                onClick={(e) => handleCopy(e, customer.email!, 'Email')}
                className="flex items-center justify-between text-slate-600 dark:text-slate-400 hover:text-foreground cursor-pointer group/c"
                title="Clic para copiar email"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <Copy className="h-2.5 w-2.5 opacity-0 group-hover/c:opacity-100 text-muted-foreground transition-opacity" />
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <div 
                  onClick={(e) => handleCopy(e, customer.phone!, 'Teléfono')}
                  className="flex items-center gap-1.5 font-mono hover:text-foreground cursor-pointer group/c"
                  title="Clic para copiar teléfono"
                >
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>{customer.phone}</span>
                  <Copy className="h-2.5 w-2.5 opacity-0 group-hover/c:opacity-100 text-muted-foreground transition-opacity" />
                </div>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 text-[10.5px] font-bold transition-all"
                    title="Escribir por WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Indicador de Deuda & Línea de Crédito */}
          <div className={compact ? "mb-2.5 space-y-1.5" : "mb-3.5 space-y-1.5"} onClick={(e) => e.stopPropagation()}>
            {customer.credit_limit > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Línea Autorizada</span>
                </div>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {formatters.currency(customer.credit_limit)}
                </span>
              </div>
            )}
            <CustomerCreditBadge
              creditSummary={getEffectiveCreditSummary(customer, creditSummary)}
              variant="compact"
              showTooltip
            />
          </div>

          {/* Métricas: el total gastado es el dato que se busca de un vistazo,
              asi que va solo y grande. El resto acompana en una fila menor. */}
          <div className={cn(
            "rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]",
            compact ? "p-2.5 mb-2.5" : "p-3 mb-3.5"
          )}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total gastado
            </div>
            <div className={cn(
              "font-bold tabular-nums text-slate-900 dark:text-white",
              compact ? "text-base" : "text-xl"
            )}>
              {formatters.currency((metricsMap[customer.id]?.total ?? (customer as unknown as { total_spent_this_year?: number }).total_spent_this_year ?? customer.lifetime_value) || 0)}
            </div>

            <div className={cn(
              "mt-2 grid grid-cols-3 gap-2 border-t border-slate-200/70 dark:border-white/10",
              compact ? "pt-2" : "pt-2.5"
            )}>
              <div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">Compras</div>
                <div className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  {metricsMap[customer.id]?.purchaseCount ?? customer.total_purchases ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">Reparaciones</div>
                <div className="text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                  {metricsMap[customer.id]?.repairCount ?? customer.total_repairs ?? 0}
                </div>
              </div>
              <div>
                {/* Antes decia "Ultima compra" y mostraba un importe: todo el
                    mundo lee esa etiqueta como una fecha. Ahora muestra la
                    fecha, con el importe como dato secundario. */}
                <div className="text-[10px] text-slate-400 dark:text-slate-500">Última</div>
                <div className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  {metricsMap[customer.id]?.lastDate
                    ? formatters.date(metricsMap[customer.id].lastDate as string)
                    : '—'}
                </div>
                {Boolean(metricsMap[customer.id]?.lastAmount) && (
                  <div className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                    {formatters.currency(metricsMap[customer.id].lastAmount)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Acción principal + metadata */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="w-full h-8 gap-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-white/5 dark:hover:bg-blue-600/20 dark:hover:text-blue-300 transition-all"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Ver Ficha Completa</span>
          </Button>

          <div className={cn("flex items-center justify-between text-slate-400 dark:text-slate-500", compact ? "text-[9.5px]" : "text-[10.5px]")}>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{getRelativeTime(customer.last_activity)}</span>
            </div>
            {customer.city && (
              <span className="font-semibold uppercase tracking-wider truncate max-w-[100px]">{customer.city}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de acciones del cliente
function CustomerActions({
  customer,
  onView,
  onEdit,
  onDelete,
  onToggleStatus
}: {
  customer: Customer
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleStatus?: () => void
}) {
  const router = useRouter()
  const { isAdmin, isManager } = useAuth()
  const canDelete = isAdmin || isManager

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end"
        className="w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <DropdownMenuItem 
          onClick={onView}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer font-medium"
        >
          <Eye className="h-4 w-4 text-primary" />
          Ver Detalle 360°
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => router.push(`/dashboard/pos?customerId=${customer.id}`)}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer"
        >
          <ShoppingBag className="h-4 w-4" />
          Nueva Venta (POS)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => router.push(`/dashboard/repairs?new=true&customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`)}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-600 dark:text-sky-400 font-medium cursor-pointer"
        >
          <Wrench className="h-4 w-4" />
          Nueva Reparación
        </DropdownMenuItem>
        {customer.phone && (
          <DropdownMenuItem 
            onClick={() => {
              const url = getFormattedWhatsAppUrl(customer)
              if (url) window.open(url, '_blank')
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar WhatsApp
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <Edit className="h-4 w-4" />
          Editar Cliente
        </DropdownMenuItem>
        
        {/* Separador */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
        
        {/* Acciones de estado */}
        {onToggleStatus && (
          <DropdownMenuItem 
            onClick={onToggleStatus}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          >
            {customer.status === 'active' ? (
              <>
                <PowerOff className="h-4 w-4 text-orange-500" />
                <span>Desactivar Cliente</span>
              </>
            ) : (
              <>
                <Power className="h-4 w-4 text-green-500" />
                <span>Activar Cliente</span>
              </>
            )}
          </DropdownMenuItem>
        )}
        
        {canDelete && (
          <DropdownMenuItem 
            onClick={onDelete} 
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Función helper para tiempo relativo
function getRelativeTime(dateString: string): string {
  if (!dateString) return 'Nunca'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) return 'Hoy'
  if (diffInDays === 1) return 'Ayer'
  if (diffInDays < 7) return `Hace ${diffInDays} días`
  if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`
  if (diffInDays < 365) return `Hace ${Math.floor(diffInDays / 30)} meses`
  return `Hace ${Math.floor(diffInDays / 365)} años`
}
