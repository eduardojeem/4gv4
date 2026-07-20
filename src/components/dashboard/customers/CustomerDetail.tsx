"use client"

/**
 * CustomerDetail Modernizado
 * 
 * Componente principal para la vista detallada del cliente.
 * Integra:
 * - CustomerDetailHeader: Encabezado con acciones y estado
 * - CustomerDetailMetrics: KPIs principales
 * - Sistema de pestañas reorganizado
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { CustomerCreditInfo } from './CustomerCreditInfo'
import {
  FileText,
  User,
  History,
  CreditCard,
  LayoutDashboard,
  Copy,
  PhoneCall,
  ExternalLink,
  Calendar,
  Clock,
  Activity,
  AlertCircle,
  MapPin,
  Tag,
  Plus,
  MessageSquare,
  Shield,
  ShieldCheck,
  CheckCircle,
  Building,
  Star,
  Edit,
  Wrench
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerData, useCustomerPurchases, prefetchCustomerPurchases } from '@/hooks/useCustomerData'
import { useCustomerRepairs } from '@/hooks/useCustomerRepairs'
import { useAuthorizedPersons, prefetchAuthorizedPersons } from '@/hooks/useAuthorizedPersons'
import { createClient } from '@/lib/supabase/client'
import { CustomerDetailHeader } from './CustomerDetailHeader'
import { CustomerDetailMetrics } from './CustomerDetailMetrics'
import { CustomerLinkAccount } from './CustomerLinkAccount'
import { WholesaleToggle } from './WholesaleToggle'
import { formatCurrency } from '@/lib/currency'

interface CustomerDetailProps {
  customer: Customer
  onBack: () => void
  onEdit: (customer: Customer) => void
  onViewHistory: (customer: Customer) => void
  compact?: boolean
}

function SalesHistoryList({
  customerId,
  limit,
  onShowAll,
}: {
  customerId: string
  limit?: number
  onShowAll?: () => void
}) {
  const { data: sales, isLoading: salesLoading } = useCustomerPurchases(customerId)
  const { repairs, loading: repairsLoading, fetchRepairs } = useCustomerRepairs()

  React.useEffect(() => {
    fetchRepairs(customerId)
  }, [customerId, fetchRepairs])

  const isLoading = salesLoading || repairsLoading

  const combinedActivities = React.useMemo(() => {
    const items: Array<{
      id: string
      type: 'sale' | 'repair'
      date: string
      title: string
      description: string
      amount: number
      status: string
    }> = []

    if (Array.isArray(sales)) {
      sales.forEach((sale: any) => {
        items.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          date: sale.created_at || sale.date || new Date().toISOString(),
          title: `Venta #${sale.id.toString().slice(-6)}`,
          description: `${sale.items?.length || 0} producto(s) - ${sale.paymentMethod || 'Pago'}`,
          amount: sale.total || 0,
          status: sale.payment_status === 'completed' || sale.payment_status === 'paid' ? 'paid' : 'pending'
        })
      })
    }

    if (Array.isArray(repairs)) {
      repairs.forEach((repair: any) => {
        items.push({
          id: `repair-${repair.id}`,
          type: 'repair',
          date: repair.created_at || new Date().toISOString(),
          title: `Reparación: ${repair.device_brand} ${repair.device_model}`,
          description: repair.problem_description || 'Sin descripción',
          amount: (repair.final_cost ?? repair.estimated_cost) || 0,
          status: repair.status || 'pending'
        })
      })
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [sales, repairs])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Cargando historial...</span>
        </div>
      </div>
    )
  }

  if (combinedActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <History className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Sin historial de actividad</h3>
        <p className="text-gray-500">Este cliente aún no tiene transacciones ni reparaciones registradas.</p>
      </div>
    )
  }

  const visibleActivities = typeof limit === 'number' ? combinedActivities.slice(0, limit) : combinedActivities
  const hiddenCount = combinedActivities.length - visibleActivities.length

  const getRepairStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'entregado': return 'Entregado'
      case 'listo': return 'Listo'
      case 'cancelado': return 'Cancelado'
      case 'reparacion': return 'En Reparación'
      case 'diagnostico': return 'En Diagnóstico'
      case 'pending': return 'Pendiente'
      default: return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const getRepairStatusBadgeStyles = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'entregado' || s === 'listo' || s === 'completed') {
      return 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
    } else if (s === 'cancelado' || s === 'cancelled') {
      return 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
    } else if (s === 'reparacion' || s === 'diagnostico' || s === 'in_progress') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
    } else {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {typeof limit === 'number' ? 'Actividades Recientes' : 'Todas las Actividades'}
        </h4>
        <Badge variant="secondary">{combinedActivities.length} total</Badge>
      </div>

      <div className="space-y-3">
        {visibleActivities.map((activity, index: number) => (
          <motion.div 
            key={activity.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/40 dark:to-gray-900/40 rounded-xl hover:shadow-sm transition-all duration-200 border border-gray-200/50 dark:border-gray-800/50 gap-4"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className={`p-2.5 rounded-xl text-white shadow-sm flex-shrink-0 bg-gradient-to-br ${
                activity.type === 'sale' 
                  ? 'from-blue-500 to-indigo-600' 
                  : 'from-orange-500 to-amber-600'
              }`}>
                {activity.type === 'sale' ? (
                  <CreditCard className="h-4.5 w-4.5" />
                ) : (
                  <Wrench className="h-4.5 w-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(activity.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 flex-shrink-0">
              <p className="font-bold tabular-nums text-base text-foreground">
                {formatCurrency(activity.amount)}
              </p>
              {activity.type === 'sale' ? (
                <Badge 
                  variant={activity.status === 'paid' ? 'default' : 'secondary'}
                  className={activity.status === 'paid' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-0 text-[10px] px-2 py-0.5' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 border-0 text-[10px] px-2 py-0.5'
                  }
                >
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  {activity.status === 'paid' ? 'Venta Pagada' : 'Pendiente'}
                </Badge>
              ) : (
                <Badge 
                  className={`${getRepairStatusBadgeStyles(activity.status)} border-0 text-[10px] px-2 py-0.5`}
                >
                  <CheckCircle className="h-2.5 w-2.5 mr-1" />
                  {getRepairStatusLabel(activity.status)}
                </Badge>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {hiddenCount > 0 && onShowAll && (
        <div className="text-center pt-4 border-t border-gray-200/50 dark:border-gray-800/50">
          <Button variant="outline" size="sm" onClick={onShowAll}>
            <History className="h-4 w-4 mr-2" />
            Ver historial completo ({hiddenCount} más)
          </Button>
        </div>
      )}
    </div>
  )
}

export function CustomerDetail({ customer, onBack, onEdit, onViewHistory, compact }: CustomerDetailProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const { data: freshData } = useCustomerData(customer.id)

  // Use fresh data if available, otherwise fallback to prop
  const currentCustomer = freshData ? { ...customer, ...freshData } : customer
  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>((currentCustomer as Customer & { profile_id?: string }).profile_id ?? null)
  const resolvedEmail = (freshData?.email ?? (customer as Customer & { email?: string }).email) as string | undefined

  React.useEffect(() => {
    const fetchProfileId = async () => {
      if (activeTab !== 'authorized') return
      if (resolvedProfileId) return
      if (!resolvedEmail) return
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', resolvedEmail)
          .limit(1)
          .maybeSingle()
        if (data?.id) setResolvedProfileId(data.id as string)
      } catch {}
    }
    fetchProfileId()
  }, [activeTab, resolvedProfileId, resolvedEmail])

  const { data: authorizedPersons, isLoading: authorizedLoading, error: authorizedError } = useAuthorizedPersons(
    resolvedProfileId,
    activeTab === 'authorized'
  )

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }



  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* 1. Header Section */}
      <CustomerDetailHeader
        customer={currentCustomer}
        onBack={onBack}
        onEdit={() => onEdit(currentCustomer)}
        onViewHistory={() => onViewHistory(currentCustomer)}
        compact={compact}
      />

      {/* 2. Key Metrics Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <CustomerDetailMetrics customer={currentCustomer} />
      </motion.div>

      {/* 2.5. Account Link Section */}
      <CustomerLinkAccount
        customerId={currentCustomer.id}
        customerName={currentCustomer.name}
        customerEmail={resolvedEmail}
        profileId={resolvedProfileId}
        onLinked={() => window.location.reload()}
      />

      {/* 3. Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-800">
          <TabsList className="h-12 bg-transparent p-0 gap-6">
            <TabsTrigger
              value="overview"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
              onMouseEnter={() => prefetchCustomerPurchases(currentCustomer.id)}
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
            <TabsTrigger
              value="credits"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Créditos y Pagos
            </TabsTrigger>
            <TabsTrigger
              value="authorized"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
              onMouseEnter={() => {
                const pid = resolvedProfileId || (currentCustomer as Customer & { profile_id?: string }).profile_id
                if (pid) prefetchAuthorizedPersons(pid as string)
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Autorizados
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-0 font-medium text-gray-500 hover:text-gray-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Notas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Personal Info & Summary */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-500">Nombre Completo</span>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="font-medium flex-1">{currentCustomer.name}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(currentCustomer.name)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-500">Email</span>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="font-medium flex-1">{currentCustomer.email || "No registrado"}</p>
                        {currentCustomer.email && (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(currentCustomer.email)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`mailto:${encodeURIComponent(currentCustomer.email)}`)}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-500">Teléfono</span>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="font-medium flex-1">{currentCustomer.phone || "No registrado"}</p>
                        {currentCustomer.phone && (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(currentCustomer.phone)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`tel:${encodeURIComponent(currentCustomer.phone)}`)}>
                              <PhoneCall className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://wa.me/${currentCustomer.phone?.replace(/[^\d]/g, '')}`)}>
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-500">Dirección</span>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="font-medium flex-1">{currentCustomer.address || currentCustomer.city || "No registrada"}</p>
                        {(currentCustomer.address || currentCustomer.city) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(currentCustomer.address || currentCustomer.city)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(currentCustomer.address || currentCustomer.city)}`, '_blank')}>
                              <MapPin className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Fecha de Registro</label>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <p className="font-semibold text-blue-900 dark:text-blue-100">{formatDate(currentCustomer.registration_date)}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <label className="text-sm font-medium text-green-700 dark:text-green-300">Última Actividad</label>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-4 w-4 text-green-500" />
                        <p className="font-semibold text-green-900 dark:text-green-100">{formatDate(currentCustomer.last_visit || currentCustomer.last_activity)}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <label className="text-sm font-medium text-purple-700 dark:text-purple-300">Estado</label>
                      <div className="flex items-center gap-2 mt-2">
                        <CheckCircle className="h-4 w-4 text-purple-500" />
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                          {currentCustomer.status === 'active' ? 'Activo' : currentCustomer.status || 'Activo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Preview */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-gray-600" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <SalesHistoryList
                    customerId={currentCustomer.id}
                    limit={5}
                    onShowAll={() => setActiveTab('history')}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Quick Stats & Notes Preview */}
            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-indigo-600" />
                    Segmentación y Perfil
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Cliente</label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300">
                        <Building className="h-3 w-3 mr-1" />
                        {currentCustomer.customer_type === 'premium' ? 'Premium' : 
                         currentCustomer.customer_type === 'empresa' ? 'Empresa' : 'Regular'}
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300">
                        <Star className="h-3 w-3 mr-1" />
                        {currentCustomer.segment === 'vip' ? 'VIP' : 
                         currentCustomer.segment === 'premium' ? 'Premium' : 'Regular'}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Puntuaciones</label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Crédito</span>
                        {currentCustomer.credit_score ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                                style={{ width: `${currentCustomer.credit_score * 10}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{currentCustomer.credit_score}/10</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Sin datos</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Satisfacción</span>
                        {currentCustomer.satisfaction_score ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full"
                                style={{ width: `${currentCustomer.satisfaction_score * 10}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{currentCustomer.satisfaction_score}/10</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Sin datos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Etiquetas</label>
                    <div className="flex flex-wrap gap-2">
                      {currentCustomer.tags && currentCustomer.tags.length > 0 ? (
                        currentCustomer.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="bg-gray-100 dark:bg-gray-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">Sin etiquetas</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => onEdit(currentCustomer)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Wholesale Access Toggle */}
              {(resolvedProfileId || currentCustomer.id) && (
                <WholesaleToggle
                  profileId={resolvedProfileId || currentCustomer.id}
                  customerName={currentCustomer.name}
                />
              )}

              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Nota Rápida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {currentCustomer.notes || "Sin notas adicionales."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/20"
                    onClick={() => onEdit(currentCustomer)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar nota
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab Content: Credits */}
        <TabsContent value="credits" className="space-y-6">
          <CustomerCreditInfo 
            customer={currentCustomer} 
            compact={compact}
            showActions={true}
          />
        </TabsContent>

        {/* Tab Content: History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesHistoryList customerId={currentCustomer.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Authorized Persons */}
        <TabsContent value="authorized">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-lg">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                Personas Autorizadas para Retiro
                <Badge variant="secondary" className="ml-2">{authorizedLoading ? '...' : (authorizedPersons?.length || 0)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {authorizedError && (
                <div className="mb-4 p-3 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No se pudieron cargar los autorizados. Reintentá en unos segundos.
                </div>
              )}
              {!authorizedError && !authorizedLoading && !resolvedProfileId && (
                <div className="mb-4 p-3 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Este cliente no tiene un perfil vinculado (falta email), por eso no se pueden mostrar autorizados.
                </div>
              )}
              {authorizedLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : authorizedPersons && authorizedPersons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authorizedPersons.map((person: { id: string; full_name: string; document_number: string; relationship?: string; phone?: string }) => (
                    <div key={person.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 group hover:shadow-md transition-all">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{person.full_name}</p>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            CI: {person.document_number}
                          </p>
                          {person.relationship && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{person.relationship}</p>
                          )}
                          {person.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <PhoneCall className="h-3 w-3" />
                              {person.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Shield className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Sin autorizados</h3>
                  <p className="text-gray-500">Este cliente aún no ha designado personas autorizadas para el retiro.</p>
                </div>
              )}
              
              <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                  <strong>Verificación importante:</strong> Al momento del retiro por parte de un tercero, es obligatorio solicitar el documento de identidad original y verificar que coincida con los datos aquí registrados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Notes */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notas y Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {currentCustomer.notes || "No hay notas registradas para este cliente."}
                  </p>
                </div>
                <Button className="w-full" onClick={() => onEdit(currentCustomer)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {currentCustomer.notes ? 'Editar nota' : 'Agregar nota'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
