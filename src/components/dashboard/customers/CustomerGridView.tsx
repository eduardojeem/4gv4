"use client"

/**
 * CustomerGridView Component
 * 
 * Vista de cuadrícula para mostrar clientes en formato de tarjetas
 * con información visual atractiva y acciones rápidas
 */

import React, { useState } from 'react'
import { motion, AnimatePresence  } from '../../ui/motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Mail,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Star,
  CreditCard,
  ShoppingBag,
  Calendar,
  Building,
  User,
  TrendingUp,
  Award
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Customer } from '@/hooks/use-customer-state'
import { formatCurrency } from '@/lib/currency'

interface CustomerGridViewProps {
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
  className?: string
}

export function CustomerGridView({
  customers,
  selectedCustomers,
  onCustomerSelect,
  onCustomerToggle,
  onSelectAll,
  onClearSelection,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  loading = false,
  className
}: CustomerGridViewProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'inactive':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
      case 'suspended':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'premium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'empresa':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getCustomerTypeIcon = (type: string) => {
    switch (type) {
      case 'premium':
        return <Star className="h-4 w-4" />
      case 'empresa':
        return <Building className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No se encontraron clientes
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          No hay clientes que coincidan con los filtros actuales. Intenta ajustar los criterios de búsqueda.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* Selection Controls */}
        {selectedCustomers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedCustomers.length} cliente(s) seleccionado(s)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300"
            >
              Limpiar selección
            </Button>
          </motion.div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {customers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                onHoverStart={() => setHoveredCard(customer.id)}
                onHoverEnd={() => setHoveredCard(null)}
              >
                <Card 
                  className={cn(
                    "relative overflow-hidden transition-all duration-200 cursor-pointer group",
                    hoveredCard === customer.id && "shadow-lg scale-[1.02]",
                    selectedCustomers.includes(customer.id) && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                  onClick={() => onCustomerSelect(customer)}
                >
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 left-3 z-10">
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => onCustomerToggle(customer.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white dark:bg-gray-800 border-2"
                    />
                  </div>

                  {/* Actions Menu */}
                  <div className="absolute top-3 right-3 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewCustomer(customer)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditCustomer(customer)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDeleteCustomer(customer)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardHeader className="pb-3">
                    {/* Customer Header */}
                    <div className="flex items-center gap-3 pt-6">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={customer.avatar} alt={customer.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {customer.name}
                          </h3>
                          {customer.customer_type === 'premium' && (
                            <Star className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-xs", getStatusColor(customer.status))}>
                            {customer.status}
                          </Badge>
                          <Badge className={cn("text-xs flex items-center gap-1", getCustomerTypeColor(customer.customer_type))}>
                            {getCustomerTypeIcon(customer.customer_type)}
                            {customer.customer_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      {customer.email && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 truncate">
                              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{customer.email}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      
                      {customer.city && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                          <span>{customer.city}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <ShoppingBag className="h-3 w-3" />
                          <span>Compras</span>
                        </div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {customer.total_purchases}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <TrendingUp className="h-3 w-3" />
                          <span>Valor</span>
                        </div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {formatCurrency(customer.lifetime_value)}
                        </div>
                      </div>
                    </div>

                    {/* Credit Info */}
                    {customer.credit_limit > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Crédito Disponible
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          {formatCurrency(customer.credit_limit - customer.current_balance)}
                        </div>
                      </div>
                    )}

                    {/* Customer Code */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1 border-t border-gray-100 dark:border-gray-800">
                      {customer.customerCode}
                    </div>
                  </CardContent>

                  {/* Hover Overlay */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 transition-opacity pointer-events-none",
                    hoveredCard === customer.id && "opacity-100"
                  )} />
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  )
}