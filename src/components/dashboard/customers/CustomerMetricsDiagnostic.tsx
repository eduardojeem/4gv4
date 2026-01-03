'use client'

/**
 * CustomerMetricsDiagnostic - Diagnóstico de métricas del dashboard de clientes
 * 
 * Verifica que los datos de las métricas se estén calculando correctamente
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Users, CreditCard, UserCheck, TrendingUp,
  CheckCircle2, AlertTriangle, RefreshCw, 
  Database, Calculator, Eye
} from 'lucide-react'
import { useCustomers } from '@/hooks/use-customer-state'
import { useCustomersWithCredits } from '@/hooks/use-customer-credits'
import { toast } from 'sonner'

export function CustomerMetricsDiagnostic() {
  const { customers, loading: customersLoading } = useCustomers()
  const { creditSummaries, loading: creditsLoading } = useCustomersWithCredits(customers)
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null)

  const runDiagnostic = () => {
    if (customersLoading || creditsLoading) {
      toast.error('Esperando a que carguen los datos...')
      return
    }

    // Calcular métricas manualmente para verificar
    const totalCustomers = customers.length
    const activeCustomers = customers.filter(c => c.status === "active").length
    const inactiveCustomers = customers.filter(c => c.status === "inactive").length
    const suspendedCustomers = customers.filter(c => c.status === "suspended").length

    // Métricas de crédito
    const summaries = Object.values(creditSummaries)
    const totalActiveCredits = summaries.reduce((sum, s) => sum + s.active_credits, 0)
    const totalPendingAmount = summaries.reduce((sum, s) => sum + s.total_pending, 0)
    const customersWithCredits = summaries.length
    const overduePayments = summaries.filter(s => s.next_payment?.is_overdue).length

    // Análisis detallado
    const customersWithoutCredits = totalCustomers - customersWithCredits
    const averageCreditPerCustomer = customersWithCredits > 0 ? totalActiveCredits / customersWithCredits : 0
    const averagePendingPerCustomer = customersWithCredits > 0 ? totalPendingAmount / customersWithCredits : 0

    // Verificar consistencia de datos
    const issues = []
    if (totalCustomers === 0) issues.push('No hay clientes cargados')
    if (customersWithCredits > totalCustomers) issues.push('Más clientes con crédito que total de clientes')
    if (totalActiveCredits < 0) issues.push('Créditos activos negativos')
    if (totalPendingAmount < 0) issues.push('Saldo pendiente negativo')

    const results = {
      timestamp: new Date().toISOString(),
      customerMetrics: {
        total: totalCustomers,
        active: activeCustomers,
        inactive: inactiveCustomers,
        suspended: suspendedCustomers,
        statusDistribution: {
          active: totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0,
          inactive: totalCustomers > 0 ? Math.round((inactiveCustomers / totalCustomers) * 100) : 0,
          suspended: totalCustomers > 0 ? Math.round((suspendedCustomers / totalCustomers) * 100) : 0
        }
      },
      creditMetrics: {
        totalActiveCredits,
        totalPendingAmount,
        customersWithCredits,
        customersWithoutCredits,
        overduePayments,
        averageCreditPerCustomer: Math.round(averageCreditPerCustomer * 100) / 100,
        averagePendingPerCustomer: Math.round(averagePendingPerCustomer),
        creditPenetration: totalCustomers > 0 ? Math.round((customersWithCredits / totalCustomers) * 100) : 0
      },
      dataQuality: {
        customersLoaded: totalCustomers > 0,
        creditsLoaded: Object.keys(creditSummaries).length > 0,
        dataConsistent: issues.length === 0,
        issues: issues
      },
      rawData: {
        customersCount: customers.length,
        creditSummariesCount: Object.keys(creditSummaries).length,
        sampleCustomer: customers[0] || null,
        sampleCreditSummary: summaries[0] || null
      }
    }

    setDiagnosticResults(results)
    
    if (issues.length === 0) {
      toast.success('Diagnóstico completado - Datos consistentes')
    } else {
      toast.warning(`Diagnóstico completado - ${issues.length} problemas encontrados`)
    }
  }

  useEffect(() => {
    if (!customersLoading && !creditsLoading && customers.length > 0) {
      runDiagnostic()
    }
  }, [customersLoading, creditsLoading, customers.length])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Diagnóstico de Métricas de Clientes
            </div>
            <Button 
              onClick={runDiagnostic} 
              disabled={customersLoading || creditsLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(customersLoading || creditsLoading) ? 'animate-spin' : ''}`} />
              Actualizar Diagnóstico
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${customersLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-sm">Clientes: {customersLoading ? 'Cargando...' : `${customers.length} cargados`}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${creditsLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-sm">Créditos: {creditsLoading ? 'Cargando...' : `${Object.keys(creditSummaries).length} resúmenes`}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {diagnosticResults && (
        <>
          {/* Data Quality Status */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Estado de Calidad de Datos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium">Clientes Cargados</span>
                  <Badge variant={diagnosticResults.dataQuality.customersLoaded ? 'default' : 'destructive'}>
                    {diagnosticResults.dataQuality.customersLoaded ? 'SÍ' : 'NO'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium">Créditos Cargados</span>
                  <Badge variant={diagnosticResults.dataQuality.creditsLoaded ? 'default' : 'destructive'}>
                    {diagnosticResults.dataQuality.creditsLoaded ? 'SÍ' : 'NO'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium">Datos Consistentes</span>
                  <Badge variant={diagnosticResults.dataQuality.dataConsistent ? 'default' : 'destructive'}>
                    {diagnosticResults.dataQuality.dataConsistent ? 'SÍ' : 'NO'}
                  </Badge>
                </div>
              </div>

              {diagnosticResults.dataQuality.issues.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800 dark:text-red-300">Problemas Detectados:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {diagnosticResults.dataQuality.issues.map((issue: string, index: number) => (
                      <li key={index} className="text-sm text-red-700 dark:text-red-300">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Métricas de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{diagnosticResults.customerMetrics.total}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Clientes</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{diagnosticResults.customerMetrics.active}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Activos</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{diagnosticResults.customerMetrics.inactive}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Inactivos</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{diagnosticResults.customerMetrics.suspended}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Suspendidos</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Distribución por Estado</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Activos</span>
                      <span className="text-sm font-medium">{diagnosticResults.customerMetrics.statusDistribution.active}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Inactivos</span>
                      <span className="text-sm font-medium">{diagnosticResults.customerMetrics.statusDistribution.inactive}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Suspendidos</span>
                      <span className="text-sm font-medium">{diagnosticResults.customerMetrics.statusDistribution.suspended}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  Métricas de Créditos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{diagnosticResults.creditMetrics.totalActiveCredits}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Créditos Activos</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{diagnosticResults.creditMetrics.customersWithCredits}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Clientes con Crédito</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-xl font-bold text-orange-600">{formatCurrency(diagnosticResults.creditMetrics.totalPendingAmount)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Saldo Pendiente</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{diagnosticResults.creditMetrics.overduePayments}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Pagos Vencidos</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Penetración de Crédito</span>
                    <span className="text-sm font-medium">{diagnosticResults.creditMetrics.creditPenetration}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Promedio Créditos/Cliente</span>
                    <span className="text-sm font-medium">{diagnosticResults.creditMetrics.averageCreditPerCustomer}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Promedio Saldo/Cliente</span>
                    <span className="text-sm font-medium">{formatCurrency(diagnosticResults.creditMetrics.averagePendingPerCustomer)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Raw Data Preview */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-gray-600" />
                Vista de Datos Raw
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Muestra de Cliente</h4>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(diagnosticResults.rawData.sampleCustomer, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Muestra de Resumen de Crédito</h4>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(diagnosticResults.rawData.sampleCreditSummary, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-500">
            Diagnóstico ejecutado: {new Date(diagnosticResults.timestamp).toLocaleString('es-ES')}
          </div>
        </>
      )}
    </div>
  )
}