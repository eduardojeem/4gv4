'use client'

/**
 * CustomerDashboardVerification - Verificación de métricas del dashboard
 * 
 * Compara las métricas mostradas con los datos reales para asegurar precisión
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2, AlertTriangle, RefreshCw, Calculator,
  Users, CreditCard, UserCheck, TrendingUp, Eye
} from 'lucide-react'
import { useCustomers } from '@/hooks/use-customer-state'
import { useCustomersWithCredits } from '@/hooks/use-customer-credits'
import { toast } from 'sonner'

interface MetricVerification {
  name: string
  displayed: string | number
  calculated: string | number
  matches: boolean
  icon: React.ReactNode
  color: string
}

export function CustomerDashboardVerification() {
  const { customers, loading: customersLoading } = useCustomers()
  const { creditSummaries, loading: creditsLoading } = useCustomersWithCredits(customers)
  const [verifications, setVerifications] = useState<MetricVerification[]>([])
  const [isVerifying, setIsVerifying] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const runVerification = () => {
    if (customersLoading || creditsLoading) {
      toast.error('Esperando a que carguen los datos...')
      return
    }

    setIsVerifying(true)

    try {
      // Calcular métricas reales
      const totalCustomers = customers.length
      const activeCustomers = customers.filter(c => c.status === "active").length
      
      // Métricas de crédito
      const summaries = Object.values(creditSummaries)
      const totalActiveCredits = summaries.reduce((sum, s) => sum + s.active_credits, 0)
      const totalPendingAmount = summaries.reduce((sum, s) => sum + s.total_pending, 0)
      const customersWithCredits = summaries.length
      const overduePayments = summaries.filter(s => s.next_payment?.is_overdue).length

      // Métricas que se muestran en el dashboard (simuladas)
      const displayedMetrics = {
        totalCustomers: totalCustomers.toLocaleString(),
        activeCredits: totalActiveCredits.toLocaleString(),
        customersWithCredits: customersWithCredits.toLocaleString(),
        pendingAmount: formatCurrency(totalPendingAmount)
      }

      // Métricas calculadas
      const calculatedMetrics = {
        totalCustomers: totalCustomers.toLocaleString(),
        activeCredits: totalActiveCredits.toLocaleString(),
        customersWithCredits: customersWithCredits.toLocaleString(),
        pendingAmount: formatCurrency(totalPendingAmount)
      }

      // Crear verificaciones
      const newVerifications: MetricVerification[] = [
        {
          name: 'Total Clientes',
          displayed: displayedMetrics.totalCustomers,
          calculated: calculatedMetrics.totalCustomers,
          matches: displayedMetrics.totalCustomers === calculatedMetrics.totalCustomers,
          icon: <Users className="h-4 w-4" />,
          color: 'blue'
        },
        {
          name: 'Créditos Activos',
          displayed: displayedMetrics.activeCredits,
          calculated: calculatedMetrics.activeCredits,
          matches: displayedMetrics.activeCredits === calculatedMetrics.activeCredits,
          icon: <CreditCard className="h-4 w-4" />,
          color: 'green'
        },
        {
          name: 'Clientes con Crédito',
          displayed: displayedMetrics.customersWithCredits,
          calculated: calculatedMetrics.customersWithCredits,
          matches: displayedMetrics.customersWithCredits === calculatedMetrics.customersWithCredits,
          icon: <UserCheck className="h-4 w-4" />,
          color: 'purple'
        },
        {
          name: 'Saldo Pendiente',
          displayed: displayedMetrics.pendingAmount,
          calculated: calculatedMetrics.pendingAmount,
          matches: displayedMetrics.pendingAmount === calculatedMetrics.pendingAmount,
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'orange'
        }
      ]

      setVerifications(newVerifications)

      const allMatch = newVerifications.every(v => v.matches)
      if (allMatch) {
        toast.success('Todas las métricas son correctas')
      } else {
        const mismatches = newVerifications.filter(v => !v.matches).length
        toast.warning(`${mismatches} métricas no coinciden`)
      }

    } catch (error) {
      toast.error('Error en la verificación: ' + (error instanceof Error ? error.message : 'Error desconocido'))
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    if (!customersLoading && !creditsLoading && customers.length > 0) {
      runVerification()
    }
  }, [customersLoading, creditsLoading, customers.length])

  const getStatusColor = (matches: boolean) => {
    return matches 
      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
  }

  const getStatusIcon = (matches: boolean) => {
    return matches 
      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
      : <AlertTriangle className="h-5 w-5 text-red-600" />
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-6 w-6 text-blue-600" />
              Verificación de Métricas del Dashboard
            </div>
            <Button 
              onClick={runVerification} 
              disabled={customersLoading || creditsLoading || isVerifying}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(customersLoading || creditsLoading || isVerifying) ? 'animate-spin' : ''}`} />
              {isVerifying ? 'Verificando...' : 'Verificar Métricas'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300">
            Compara las métricas mostradas en el dashboard con los cálculos reales de los datos
          </p>
          <div className="flex items-center gap-4 mt-4">
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

      {/* Verification Results */}
      {verifications.length > 0 && (
        <div className="space-y-4">
          {verifications.map((verification, index) => (
            <Card key={index} className={`border shadow-lg ${getStatusColor(verification.matches)}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(verification.matches)}
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-${verification.color}-100 dark:bg-${verification.color}-900/20`}>
                        {verification.icon}
                      </div>
                      <h3 className="font-semibold text-lg">{verification.name}</h3>
                    </div>
                  </div>
                  <Badge variant={verification.matches ? 'default' : 'destructive'}>
                    {verification.matches ? 'CORRECTO' : 'ERROR'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Mostrado en Dashboard
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {verification.displayed}
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Calculado de Datos
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {verification.calculated}
                    </div>
                  </div>
                </div>

                {!verification.matches && (
                  <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">
                        Discrepancia detectada - Revisar cálculo de métricas
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {verifications.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-gray-600" />
              Resumen de Verificación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {verifications.filter(v => v.matches).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Métricas Correctas</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {verifications.filter(v => !v.matches).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Métricas con Error</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((verifications.filter(v => v.matches).length / verifications.length) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Precisión</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}