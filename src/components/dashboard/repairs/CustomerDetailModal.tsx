'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CreditCard, 
  TrendingUp,
  Star,
  Clock,
  X
} from 'lucide-react'
import type { Customer } from '@/hooks/use-customer-state'

interface CustomerDetailModalProps {
  open: boolean
  onClose: () => void
  customer: Customer | null
}

export function CustomerDetailModal({ open, onClose, customer }: CustomerDetailModalProps) {
  if (!customer) return null

  const getCustomerInitials = (customer: Customer) => {
    const nameParts = (customer.name || '').trim().split(/\s+/)
    const firstInitial = nameParts[0]?.[0] || ''
    const lastInitial = nameParts[1]?.[0] || ''
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'CL'
  }

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'premium': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'empresa': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'No disponible'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg bg-primary/10 font-semibold">
                {getCustomerInitials(customer)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-lg font-semibold">{customer.name}</div>
              <div className="text-sm text-muted-foreground">
                Código: {customer.customerCode || 'No asignado'}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Información detallada del cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(customer.status)}>
              {customer.status === 'active' ? 'Activo' : 
               customer.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
            </Badge>
            <Badge variant="outline" className={getCustomerTypeColor(customer.customer_type)}>
              {customer.customer_type === 'premium' ? 'Premium' :
               customer.customer_type === 'empresa' ? 'Empresa' : 'Regular'}
            </Badge>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Información de Contacto</h4>
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Total Compras
                </div>
                <div className="text-sm font-medium">{customer.total_purchases || 0}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />
                  Total Reparaciones
                </div>
                <div className="text-sm font-medium">{customer.total_repairs || 0}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  Valor de Vida
                </div>
                <div className="text-sm font-medium">{formatCurrency(customer.lifetime_value || 0)}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Puntos Lealtad
                </div>
                <div className="text-sm font-medium">{customer.loyalty_points || 0}</div>
              </div>
            </div>
          </div>

          {/* Registration Date */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Información Adicional</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Registrado: {formatDate(customer.registration_date)}</span>
              </div>
              {customer.segment && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Segmento: {customer.segment}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Notas</h4>
              <div className="text-sm bg-muted/50 rounded-lg p-3">
                {customer.notes}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}