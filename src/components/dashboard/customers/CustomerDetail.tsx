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
import { motion  } from '../../ui/motion'
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
  MapPin,
  Tag,
  Plus,
  MessageSquare,
  Shield,
  TrendingUp,
  CheckCircle,
  Building,
  Star,
  Edit
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerData, useCustomerPurchases } from '@/hooks/useCustomerData'
import { CustomerDetailHeader } from './CustomerDetailHeader'
import { CustomerDetailMetrics } from './CustomerDetailMetrics'

interface CustomerDetailProps {
  customer: Customer
  onBack: () => void
  onEdit: (customer: Customer) => void
  onViewHistory: (customer: Customer) => void
  compact?: boolean
}

function SalesHistoryList({ customerId }: { customerId: string }) {
  const { data: sales, isLoading } = useCustomerPurchases(customerId)

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

  if (!sales || sales.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <History className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Sin historial de ventas</h3>
        <p className="text-gray-500 mb-4">Este cliente aún no tiene transacciones registradas.</p>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Registrar primera venta
        </Button>
      </div>
    )
  }

  const recentSales = sales.slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white">Últimas Transacciones</h4>
        <Badge variant="secondary">{sales.length} total</Badge>
      </div>
      
      <div className="space-y-3">
        {recentSales.map((sale: any, index: number) => (
          <motion.div 
            key={sale.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full text-white shadow-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Venta #{sale.id.toString().slice(-6)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    {new Date(sale.created_at || sale.date || new Date()).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                ${sale.total?.toLocaleString() || '0'}
              </p>
              <Badge 
                variant={sale.payment_status === 'completed' || sale.payment_status === 'paid' ? 'default' : 'secondary'}
                className={sale.payment_status === 'completed' || sale.payment_status === 'paid' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                }
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {sale.payment_status === 'completed' || sale.payment_status === 'paid' ? 'Completado' : 'Pendiente'}
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      {sales.length > 5 && (
        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Ver historial completo ({sales.length - 5} más)
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Aquí podrías agregar un toast de confirmación
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
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`mailto:${currentCustomer.email}`)}>
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
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`tel:${currentCustomer.phone}`)}>
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
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://maps.google.com/?q=${currentCustomer.address || currentCustomer.city}`, '_blank')}>
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
                  <SalesHistoryList customerId={currentCustomer.id} />
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
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                              style={{ width: `${(currentCustomer.credit_score || 0) * 10}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{currentCustomer.credit_score || 0}/10</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Satisfacción</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full"
                              style={{ width: `${(currentCustomer.satisfaction_score || 0) * 10}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{currentCustomer.satisfaction_score || 0}/10</span>
                        </div>
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
                      <Button variant="outline" size="sm" className="h-6 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferencias de Contacto</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs font-medium">Email</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-medium">SMS</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                        <span className="text-xs font-medium">Llamada</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                  <Button variant="ghost" size="sm" className="mt-3 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/20">
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
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Nueva Nota
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


