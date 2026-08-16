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
  Wrench
} from 'lucide-react'
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
  onBulkStatusChange
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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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
  creditSummaries = {}
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
                <TableHead className="w-10 pl-4 py-3">
                  <Checkbox
                    checked={allSelected || someSelected}
                    onCheckedChange={onSelectAll}
                    className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('name')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cliente
                    {renderSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('email')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Contacto
                    {renderSortIcon('email')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('status')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estado
                    {renderSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('lifetime_value')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Gastado
                    {renderSortIcon('lifetime_value')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('total_purchases')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Compras
                    {renderSortIcon('total_purchases')}
                  </div>
                </TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Última Compra
                </TableHead>
                <TableHead
                  className="cursor-pointer py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => onSort('last_activity')}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actividad
                    {renderSortIcon('last_activity')}
                  </div>
                </TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estado Deuda
                </TableHead>
                <TableHead className="w-16 pr-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer, index) => {
                const phoneClean = customer.phone?.replace(/\D/g, '') || ''
                const whatsappUrl = phoneClean ? `https://wa.me/${phoneClean}` : null

                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group border-b border-slate-100 transition-colors cursor-pointer hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-white/[0.03]"
                    onClick={() => onViewCustomer(customer)}
                  >
                    <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={() => onCustomerToggle(customer.id)}
                        className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-200 dark:border-white/10 shrink-0">
                          <AvatarImage src={customer.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                            {(customer.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {customer.name}
                            {customer.segment === 'vip' && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                          </div>
                          <div className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {customer.customerCode}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{customer.phone}</span>
                            {whatsappUrl && (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="ml-1 inline-flex items-center text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
                                title="Escribir por WhatsApp"
                              >
                                <MessageCircle className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1.5 items-start">
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
                          <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            {customer.segment}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="font-bold tabular-nums text-slate-900 dark:text-white text-sm">
                        {formatters.currency((metricsMap[customer.id]?.total ?? (customer as unknown as { total_spent_this_year?: number }).total_spent_this_year ?? customer.lifetime_value) || 0)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-300 text-sm">
                        {(metricsMap[customer.id]?.count ?? customer.total_purchases ?? 0)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <div className="font-medium text-xs tabular-nums text-slate-800 dark:text-slate-200">
                          {formatters.currency((metricsMap[customer.id]?.lastAmount ?? customer.last_purchase_amount ?? 0))}
                        </div>
                        {customer.city && (
                          <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
                            {customer.city}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {formatters.date(customer.last_activity)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {getRelativeTime(customer.last_activity)}
                        </div>
                      </div>
                    </TableCell>
                    {/* Columna deuda */}
                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                      <CustomerCreditBadge
                        creditSummary={creditSummaries[customer.id] ?? null}
                        variant="compact"
                        showTooltip
                      />
                    </TableCell>
                    <TableCell className="pr-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
  creditSummaries = {}
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
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((customer, index) => (
        <motion.div
          key={customer.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
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
  creditSummary
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
}) {
  const phoneClean = customer.phone?.replace(/\D/g, '') || ''
  const whatsappUrl = phoneClean ? `https://wa.me/${phoneClean}` : null

  return (
    <Card className={cn(
      "group relative flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer",
      "border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d1117]",
      "hover:border-slate-300 hover:shadow-md dark:hover:border-white/20 dark:hover:shadow-black/40",
      selected && "ring-2 ring-blue-500 border-blue-300 dark:border-blue-500/50 shadow-md"
    )}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div>
          {/* Header con checkbox, badges superiores y acciones */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                onClick={(e) => e.stopPropagation()}
                className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {customer.customerCode}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {customer.customer_type === 'premium' && (
                <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-400/20 dark:text-amber-300">
                  <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
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
          <div className="flex items-start gap-3 mb-4" onClick={onView}>
            <Avatar className="h-11 w-11 border border-slate-200 dark:border-white/10 shrink-0 mt-0.5">
              <AvatarImage src={customer.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                {(customer.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1 text-base">
                {customer.name}
                {customer.segment === 'vip' && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400">
                    {customer.segment}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contacto directo */}
          <div className="space-y-1.5 mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-xs">
            {customer.email && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2 font-mono">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{customer.phone}</span>
                </div>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                    title="Escribir por WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Indicador de Deuda */}
          <div className="mb-4" onClick={(e) => e.stopPropagation()}>
            <CustomerCreditBadge
              creditSummary={creditSummary ?? null}
              variant="compact"
              showTooltip
            />
          </div>

          {/* Métricas destacadas */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Total Gastado</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white text-sm">
                {formatters.currency((metricsMap[customer.id]?.total ?? (customer as unknown as { total_spent_this_year?: number }).total_spent_this_year ?? customer.lifetime_value) || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Compras</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white text-sm">
                {(metricsMap[customer.id]?.count ?? customer.total_purchases ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Última compra</div>
              <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-300 text-xs">
                {formatters.currency((metricsMap[customer.id]?.lastAmount ?? customer.last_purchase_amount ?? 0))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Puntos</div>
              <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-300 text-xs">
                {(customer as unknown as { loyalty_points?: number }).loyalty_points ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Última actividad y Ciudad */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{getRelativeTime(customer.last_activity)}</span>
          </div>
          {customer.city && (
            <div className="flex items-center gap-1 font-semibold uppercase tracking-wider">
              <MapPin className="h-3 w-3" />
              <span>{customer.city}</span>
            </div>
          )}
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
