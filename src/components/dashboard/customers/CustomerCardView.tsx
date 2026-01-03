"use client"

/**
 * CustomerCardView Component
 * 
 * Vista de tarjetas compactas para mostrar clientes
 * Diseño más denso que la vista de cuadrícula
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Star,
  StarOff,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  status: 'active' | 'inactive' | 'pending'
  avatar?: string
  totalOrders?: number
  totalSpent?: number
  lastOrder?: string
  isFavorite?: boolean
}

interface CustomerCardViewProps {
  customers: Customer[]
  selectedCustomers: string[]
  onSelectCustomer: (customerId: string) => void
  onSelectAll: () => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  onView: (customer: Customer) => void
  onToggleFavorite: (customer: Customer) => void
  loading?: boolean
}

export function CustomerCardView({
  customers,
  selectedCustomers,
  onSelectCustomer,
  onSelectAll,
  onEdit,
  onDelete,
  onView,
  onToggleFavorite,
  loading = false
}: CustomerCardViewProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header con selección masiva */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={selectedCustomers.length === customers.length && customers.length > 0}
              onCheckedChange={onSelectAll}
              aria-label="Seleccionar todos los clientes"
            />
            <span className="text-sm text-gray-600">
              {selectedCustomers.length > 0 
                ? `${selectedCustomers.length} seleccionado(s)`
                : `${customers.length} cliente(s)`
              }
            </span>
          </div>
        </div>

        {/* Grid de tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {customers.map((customer) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                onHoverStart={() => setHoveredCard(customer.id)}
                onHoverEnd={() => setHoveredCard(null)}
              >
                <Card 
                  className={`relative transition-all duration-200 hover:shadow-lg cursor-pointer ${
                    selectedCustomers.includes(customer.id) 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => onView(customer)}
                >
                  <CardContent className="p-4">
                    {/* Header con checkbox y favorito */}
                    <div className="flex items-start justify-between mb-3">
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={() => onSelectCustomer(customer.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Seleccionar ${customer.name}`}
                      />
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleFavorite(customer)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {customer.isFavorite ? (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(customer)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(customer)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(customer)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Información del cliente */}
                    <div className="flex items-center space-x-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={customer.avatar} alt={customer.name} />
                        <AvatarFallback>
                          {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{customer.name}</h3>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(customer.status)}`}
                        >
                          {customer.status === 'active' ? 'Activo' : 
                           customer.status === 'inactive' ? 'Inactivo' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>

                    {/* Información de contacto */}
                    <div className="space-y-2 mb-3">
                      {customer.email && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-2 text-xs text-gray-600">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{customer.email}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {customer.phone && (
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{customer.phone}</span>
                        </div>
                      )}
                      {customer.address && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-2 text-xs text-gray-600">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{customer.address}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{customer.address}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Estadísticas */}
                    {(customer.totalOrders || customer.totalSpent) && (
                      <div className="border-t pt-3 space-y-1">
                        {customer.totalOrders && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Pedidos:</span>
                            <span className="font-medium">{customer.totalOrders}</span>
                          </div>
                        )}
                        {customer.totalSpent && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Total gastado:</span>
                            <span className="font-medium">{formatCurrency(customer.totalSpent)}</span>
                          </div>
                        )}
                        {customer.lastOrder && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Último pedido:</span>
                            <span className="font-medium">{customer.lastOrder}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {customers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <Mail className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No hay clientes
            </h3>
            <p className="text-gray-500">
              No se encontraron clientes que coincidan con los filtros aplicados.
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}