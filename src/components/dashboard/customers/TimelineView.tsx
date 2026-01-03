"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Wrench,
  Filter,
  Search,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Customer } from '@/hooks/use-customer-state'
import { customerService } from '@/services/customer-service'
import { useCustomerRepairs } from '@/hooks/useCustomerRepairs'
import { toast } from 'sonner'

interface ActivityItem {
  id: string
  type: 'sale' | 'repair'
  date: string
  title: string
  description: string
  amount?: number
  status?: string
  customer: {
    id: string
    name: string
    email?: string
    phone?: string
  }
}

interface TimelineViewProps {
  customers: Customer[]
  onCustomerSelect: (customer: Customer) => void
  selectedCustomerId?: string
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  customers,
  onCustomerSelect,
  selectedCustomerId
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'repair'>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const { fetchPendingRepairs } = useCustomerRepairs()

  // Fetch activity data for a specific customer
  const fetchCustomerActivity = async (customerId: string) => {
    setLoading(true)
    try {
      const customer = customers.find(c => c.id === customerId)
      if (!customer) return

      setSelectedCustomer(customer)

      // Fetch sales data
      const salesResponse = await customerService.getCustomerSales(customerId)
      const salesData = salesResponse.success ? salesResponse.data || [] : []

      // Fetch repairs data
      const repairsData = await fetchPendingRepairs(customerId)

      // Combine and format activities
      const combinedActivities: ActivityItem[] = [
        // Sales activities
        ...salesData.map((sale: any) => ({
          id: `sale-${sale.id}`,
          type: 'sale' as const,
          date: sale.date || sale.created_at,
          title: `Venta ${sale.invoiceNumber || sale.id}`,
          description: `${sale.items?.length || 0} productos - ${sale.paymentMethod || 'Método no especificado'}`,
          amount: sale.total,
          status: sale.status || 'completada',
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          }
        })),
        // Repairs activities
        ...repairsData.map((repair: any) => ({
          id: `repair-${repair.id}`,
          type: 'repair' as const,
          date: repair.created_at,
          title: `Reparación ${repair.device_brand} ${repair.device_model}`,
          description: repair.problem_description,
          amount: repair.final_cost || repair.estimated_cost,
          status: repair.status,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          }
        }))
      ]

      // Sort by date (most recent first)
      combinedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setActivities(combinedActivities)
    } catch (error) {
      console.error('Error fetching customer activity:', error)
      toast.error('Error al cargar el historial de actividad')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  // Effect to load activity when selectedCustomerId changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerActivity(selectedCustomerId)
    } else {
      setActivities([])
      setSelectedCustomer(null)
    }
  }, [selectedCustomerId])

  // Filter activities based on search and type
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const matchesSearch = searchTerm === '' || 
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || activity.type === filterType
      
      return matchesSearch && matchesType
    })
  }, [activities, searchTerm, filterType])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4 text-white" />
      case 'repair':
        return <Wrench className="h-4 w-4 text-white" />
      default:
        return <User className="h-4 w-4 text-white" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'sale':
        return 'bg-green-500'
      case 'repair':
        return 'bg-blue-500'
      default:
        return 'bg-purple-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completada':
      case 'entregado':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pendiente':
      case 'recibido':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelada':
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'reparacion':
      case 'diagnostico':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/70">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historial de Actividad
          {selectedCustomer && (
            <Badge variant="secondary" className="ml-2">
              {selectedCustomer.name}
            </Badge>
          )}
        </CardTitle>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar en el historial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las actividades</SelectItem>
              <SelectItem value="sale">Solo ventas</SelectItem>
              <SelectItem value="repair">Solo reparaciones</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedCustomerId && fetchCustomerActivity(selectedCustomerId)}
            disabled={loading || !selectedCustomerId}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <AnimatePresence>
              {!selectedCustomerId ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Selecciona un cliente para ver su historial de actividad
                  </p>
                </motion.div>
              ) : loading ? (
                <div className="space-y-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="relative flex items-start gap-4">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredActivities.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {activities.length === 0 
                      ? 'No se encontró actividad para este cliente'
                      : 'No se encontraron actividades que coincidan con los filtros'
                    }
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {filteredActivities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex items-start gap-4"
                    >
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>

                      {/* Activity content */}
                      <div className="flex-1 min-w-0">
                        <div className="p-4 rounded-lg border transition-all hover:shadow-md bg-white dark:bg-slate-800">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {activity.title}
                                </h4>
                                <Badge className={getStatusColor(activity.status || '')}>
                                  {activity.status || 'Sin estado'}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">
                                {activity.description}
                              </p>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(activity.date)}</span>
                                </div>
                                {activity.amount && (
                                  <div className="flex items-center gap-1">
                                    <GSIcon className="h-3 w-3" />
                                    <span className="font-medium">{formatCurrency(activity.amount)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Badge variant={activity.type === 'sale' ? 'default' : 'secondary'}>
                              {activity.type === 'sale' ? 'Venta' : 'Reparación'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
