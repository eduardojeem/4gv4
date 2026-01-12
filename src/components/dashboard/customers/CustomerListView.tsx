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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Grid3X3,
  List,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Mail,
  Phone,
  MapPin,
  Eye,
  History,
  Star,
  Award,
  ShoppingBag,
  Calendar,
  CreditCard,
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  TrendingUp,
  Activity,
  Clock,
  Power,
  PowerOff
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerSalesMetricsMap, CustomerMetrics } from '@/hooks/use-customer-metrics'
import { StatusBadge, StatusToggle, BulkStatusSelector } from '@/components/ui/StatusBadge'
import { formatters } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface CustomerListViewProps {
  customers: Customer[]
  selectedCustomers: string[]
  onCustomerSelect: (customer: Customer) => void
  onCustomerToggle: (customerId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onToggleCustomerStatus?: (customer: Customer) => void
  onBulkStatusChange?: (customerIds: string[], status: 'active' | 'inactive' | 'suspended') => void
  loading?: boolean
}

type ViewMode = 'table' | 'grid'
type SortField = 'name' | 'email' | 'phone' | 'status' | 'lifetime_value' | 'last_activity'
type SortOrder = 'asc' | 'desc'

export function CustomerListView({
  customers,
  selectedCustomers,
  onCustomerSelect,
  onCustomerToggle,
  onSelectAll,
  onClearSelection,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onToggleCustomerStatus,
  onBulkStatusChange,
  loading = false
}: CustomerListViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Filtrar y ordenar clientes
  const processedCustomers = useMemo(() => {
    let filtered = customers

    // Aplicar búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(search) ||
        customer.email.toLowerCase().includes(search) ||
        customer.phone.includes(search)
      )
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

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
              <span className="ml-2 text-blue-600">
                ({selectedCustomers.length} seleccionado{selectedCustomers.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de vista */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
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
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
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
              
              <Button 
                variant="destructive" 
                size="sm"
                className="hover:bg-red-600 dark:hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Contenido según vista */}
      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
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
              loading={loading}
              metricsMap={metricsMap}
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
              loading={loading}
              metricsMap={metricsMap}
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
  loading,
  metricsMap
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
  loading: boolean
  metricsMap: Record<string, CustomerMetrics>
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <TableHead className="w-12 bg-gray-50 dark:bg-gray-800/50">
                <Checkbox
                  checked={allSelected || someSelected}
                  onCheckedChange={onSelectAll}
                  className="border-gray-300 dark:border-gray-600"
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Cliente
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('email')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Contacto
                  <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('status')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Estado
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('lifetime_value')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Valor
                  <SortIcon field="lifetime_value" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('total_purchases')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Compras
                </div>
              </TableHead>
              <TableHead className="bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                Última compra
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors bg-gray-50 dark:bg-gray-800/50"
                onClick={() => onSort('last_activity')}
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  Última Actividad
                  <SortIcon field="last_activity" />
                </div>
              </TableHead>
              <TableHead className="w-20 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <motion.tr
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-800"
                onClick={() => onViewCustomer(customer)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCustomers.includes(customer.id)}
                    onCheckedChange={() => onCustomerToggle(customer.id)}
                    className="border-gray-300 dark:border-gray-600"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 ring-2 ring-gray-100 dark:ring-gray-700">
                      <AvatarImage src={customer.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-medium">
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {customer.customerCode}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Mail className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                      {customer.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Phone className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                      {customer.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    {onToggleCustomerStatus ? (
                      <StatusToggle
                        status={customer.status}
                        onToggle={() => onToggleCustomerStatus(customer)}
                        size="sm"
                      />
                    ) : (
                      <StatusBadge status={customer.status} size="sm" />
                    )}
                    {customer.segment && (
                      <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                        {customer.segment}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
              <div className="space-y-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                      {formatters.currency((metricsMap[customer.id]?.total ?? (customer as any).total_spent_this_year ?? customer.lifetime_value) || 0)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                      {(metricsMap[customer.id]?.count ?? customer.total_purchases ?? 0)} compras
                </div>
              </div>
                </TableCell>
                <TableCell>
                <div className="space-y-1">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                      {formatters.currency((metricsMap[customer.id]?.lastAmount ?? customer.last_purchase_amount ?? 0))}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {customer.city || ''}
                  </div>
                </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {formatters.date(customer.last_activity)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {getRelativeTime(customer.last_activity)}
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <CustomerActions
                    customer={customer}
                    onView={() => onViewCustomer(customer)}
                    onEdit={() => onEditCustomer(customer)}
                    onDelete={() => onDeleteCustomer(customer)}
                    onToggleStatus={onToggleCustomerStatus ? () => onToggleCustomerStatus(customer) : undefined}
                  />
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
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
  loading,
  metricsMap
}: {
  customers: Customer[]
  selectedCustomers: string[]
  onCustomerToggle: (customerId: string) => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onToggleCustomerStatus?: (customer: Customer) => void
  loading: boolean
  metricsMap: Record<string, CustomerMetrics>
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
          />
        </motion.div>
      ))}
    </div>
  )
}

// Componente de tarjeta de cliente mejorada
function CustomerCard({
  customer,
  selected,
  onToggle,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  metricsMap
}: {
  customer: Customer
  selected: boolean
  onToggle: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleStatus?: () => void
  metricsMap: Record<string, CustomerMetrics>
}) {
  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-200 cursor-pointer",
      "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
      "hover:border-gray-300 dark:hover:border-gray-600",
      selected && "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg border-blue-200 dark:border-blue-600"
    )}>
      <CardContent className="p-4">
        {/* Header con checkbox y acciones */}
        <div className="flex items-start justify-between mb-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="border-gray-300 dark:border-gray-600"
          />
          <CustomerActions
            customer={customer}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
          />
        </div>

        {/* Avatar y nombre */}
        <div className="flex items-center gap-3 mb-4" onClick={onView}>
          <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-700">
            <AvatarImage src={customer.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
              {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-gray-900 dark:text-gray-100">{customer.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{customer.customerCode}</p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Mail className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <span className="truncate">{customer.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Phone className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            <span>{customer.phone}</span>
          </div>
          {customer.city && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <MapPin className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              <span className="truncate">{customer.city}</span>
            </div>
          )}
        </div>

        {/* Estados y badges */}
        <div className="flex flex-wrap gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
          {onToggleStatus ? (
            <StatusToggle
              status={customer.status}
              onToggle={onToggleStatus}
              size="sm"
            />
          ) : (
            <StatusBadge status={customer.status} size="sm" />
          )}
          {customer.segment && (
            <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              {customer.segment}
            </Badge>
          )}
          {customer.customer_type === 'premium' && (
            <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 border-0 text-white">
              <Star className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Valor Total</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
              {formatters.currency((metricsMap[customer.id]?.total ?? (customer as any).total_spent_this_year ?? customer.lifetime_value) || 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Compras</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{(metricsMap[customer.id]?.count ?? customer.total_purchases ?? 0)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Última compra</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{formatters.currency((metricsMap[customer.id]?.lastAmount ?? customer.last_purchase_amount ?? 0))}</div>
            </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Puntos</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{(customer as any).loyalty_points ?? 0}</div>
          </div>
        </div>

        {/* Última actividad */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            <span>Última actividad: {getRelativeTime(customer.last_activity)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="h-3 w-3" />
            <span>{customer.city || ''}</span>
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
        className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <DropdownMenuItem 
          onClick={onView}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <Eye className="h-4 w-4" />
          Ver Detalle
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <Edit className="h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
          <History className="h-4 w-4" />
          Historial
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
          <MessageCircle className="h-4 w-4" />
          Contactar
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
        
        <DropdownMenuItem 
          onClick={onDelete} 
          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
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
