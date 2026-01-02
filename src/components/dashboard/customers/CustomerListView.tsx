"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence  } from '../../ui/motion'
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
  Clock
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { StatusBadge } from '@/components/ui/StatusBadge'
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
              <Button variant="outline" size="sm" onClick={onClearSelection}>
                Limpiar ({selectedCustomers.length})
              </Button>
              <Button variant="destructive" size="sm">
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
              loading={loading}
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
              loading={loading}
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
  loading
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
  loading: boolean
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected || someSelected}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center gap-2">
                  Cliente
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort('email')}
              >
                <div className="flex items-center gap-2">
                  Contacto
                  <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort('status')}
              >
                <div className="flex items-center gap-2">
                  Estado
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort('lifetime_value')}
              >
                <div className="flex items-center gap-2">
                  Valor
                  <SortIcon field="lifetime_value" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort('last_activity')}
              >
                <div className="flex items-center gap-2">
                  Última Actividad
                  <SortIcon field="last_activity" />
                </div>
              </TableHead>
              <TableHead className="w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <motion.tr
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onViewCustomer(customer)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCustomers.includes(customer.id)}
                    onCheckedChange={() => onCustomerToggle(customer.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={customer.avatar} />
                      <AvatarFallback>
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {customer.customerCode}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3" />
                      {customer.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <StatusBadge status={customer.status} size="sm" />
                    {customer.segment && (
                      <Badge variant="outline" className="text-xs">
                        {customer.segment}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {formatters.currency(customer.lifetime_value || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {customer.total_purchases || 0} compras
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      {formatters.date(customer.last_activity)}
                    </div>
                    <div className="text-xs text-muted-foreground">
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
  loading
}: {
  customers: Customer[]
  selectedCustomers: string[]
  onCustomerToggle: (customerId: string) => void
  onViewCustomer: (customer: Customer) => void
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  loading: boolean
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
  onDelete
}: {
  customer: Customer
  selected: boolean
  onToggle: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-200 cursor-pointer",
      selected && "ring-2 ring-blue-500 shadow-lg"
    )}>
      <CardContent className="p-4">
        {/* Header con checkbox y acciones */}
        <div className="flex items-start justify-between mb-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
          <CustomerActions
            customer={customer}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Avatar y nombre */}
        <div className="flex items-center gap-3 mb-4" onClick={onView}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={customer.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{customer.name}</h3>
            <p className="text-sm text-muted-foreground">{customer.customerCode}</p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{customer.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{customer.phone}</span>
          </div>
          {customer.city && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{customer.city}</span>
            </div>
          )}
        </div>

        {/* Estados y badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <StatusBadge status={customer.status} size="sm" />
          {customer.segment && (
            <Badge variant="outline" className="text-xs">
              {customer.segment}
            </Badge>
          )}
          {customer.customer_type === 'premium' && (
            <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500">
              <Star className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Valor Total</div>
            <div className="font-semibold">
              {formatters.currency(customer.lifetime_value || 0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Compras</div>
            <div className="font-semibold">{customer.total_purchases || 0}</div>
          </div>
        </div>

        {/* Última actividad */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Última actividad: {getRelativeTime(customer.last_activity)}</span>
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
  onDelete
}: {
  customer: Customer
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" />
          Ver Detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem>
          <History className="h-4 w-4 mr-2" />
          Historial
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MessageCircle className="h-4 w-4 mr-2" />
          Contactar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
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