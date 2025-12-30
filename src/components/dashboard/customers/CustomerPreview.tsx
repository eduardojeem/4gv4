"use client"

/**
 * CustomerPreview Component
 * 
 * Vista previa rápida del cliente que se muestra en las sugerencias de búsqueda
 * Incluye información básica y acciones rápidas
 */

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  CreditCard,
  Star,
  Eye,
  Edit,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Customer } from "@/hooks/use-customer-state"
import { formatCurrency } from "@/lib/currency"

interface CustomerPreviewProps {
  customer: Customer
  onViewDetails: (customer: Customer) => void
  onEdit?: (customer: Customer) => void
  onContact?: (customer: Customer) => void
  className?: string
}

export function CustomerPreview({
  customer,
  onViewDetails,
  onEdit,
  onContact,
  className
}: CustomerPreviewProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("w-full max-w-md", className)}
    >
      <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
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
              
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-xs", getStatusColor(customer.status))}>
                  {customer.status}
                </Badge>
                <Badge className={cn("text-xs", getCustomerTypeColor(customer.customer_type))}>
                  {customer.customer_type}
                </Badge>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {customer.customerCode}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 mb-4">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300 truncate">
                  {customer.email}
                </span>
              </div>
            )}
            
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">
                  {customer.phone}
                </span>
              </div>
            )}
            
            {customer.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">
                  {customer.city}
                </span>
              </div>
            )}
            
            {customer.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300 truncate">
                  {customer.company}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Valor Total</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {formatCurrency(customer.lifetime_value)}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Compras</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {customer.total_purchases}
              </div>
            </div>
          </div>

          {/* Credit Info */}
          {customer.credit_limit > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Crédito Disponible
                </span>
              </div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {formatCurrency(customer.credit_limit - customer.current_balance)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => onViewDetails(customer)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0"
              size="sm"
            >
              <Eye className="h-4 w-4 mr-1" />
              Ver Detalles
            </Button>
            
            {onEdit && (
              <Button
                onClick={() => onEdit(customer)}
                variant="outline"
                size="sm"
                className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            {onContact && (
              <Button
                onClick={() => onContact(customer)}
                variant="outline"
                size="sm"
                className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}