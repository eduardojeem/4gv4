"use client"

import React, { useState } from 'react'
import { motion  } from '../../ui/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Target,
  Shield,
  AlertCircle,
  Info,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  Eye,
  ExternalLink,
  Download,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCustomerCredits, CustomerCreditSummary } from '@/hooks/use-customer-credits'
import { Customer } from '@/hooks/use-customer-state'

interface CustomerCreditInfoProps {
  customer: Customer
  compact?: boolean
  showActions?: boolean
}

export function CustomerCreditInfo({ customer, compact = false, showActions = true }: CustomerCreditInfoProps) {
  const { loading, creditSummary, credits, installments, payments, refresh } = useCustomerCredits(customer.id)
  const [activeTab, setActiveTab] = useState('resumen')

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!creditSummary) {
    return (
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Sin Historial Crediticio
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
            Este cliente no tiene créditos registrados en el sistema
          </p>
          {showActions && (
            <Button variant="outline" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Crear Primer Crédito
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100 border-green-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200'
      case 'critical': return 'text-red-600 bg-red-100 border-red-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="h-4 w-4" />
      case 'medium': return <Info className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <AlertCircle className="h-4 w-4" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  const getPaymentScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header con métricas principales */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Información Crediticia
              </CardTitle>
              {showActions && (
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={refresh}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Actualizar información</TooltipContent>
                  </Tooltip>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Ver Detalle
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {creditSummary.active_credits}
                </div>
                <div className="text-sm text-gray-600">Créditos Activos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(creditSummary.total_paid)}
                </div>
                <div className="text-sm text-gray-600">Total Pagado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(creditSummary.total_pending)}
                </div>
                <div className="text-sm text-gray-600">Saldo Pendiente</div>
              </div>
              <div className="text-center">
                <div className={cn("text-2xl font-bold", getPaymentScoreColor(creditSummary.payment_history.payment_score))}>
                  {creditSummary.payment_history.payment_score}
                </div>
                <div className="text-sm text-gray-600">Score de Pago</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs con información detallada */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="creditos">Créditos</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="riesgo">Riesgo</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Utilización de Crédito */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Utilización de Crédito
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Límite de Crédito</span>
                      <span className="font-medium">{formatCurrency(creditSummary.credit_limit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Utilizado</span>
                      <span className="font-medium">{formatCurrency(creditSummary.current_balance)}</span>
                    </div>
                    <Progress 
                      value={creditSummary.credit_utilization} 
                      className="h-2"
                    />
                    <div className="text-center">
                      <Badge variant={creditSummary.credit_utilization > 80 ? "destructive" : creditSummary.credit_utilization > 60 ? "secondary" : "default"}>
                        {creditSummary.credit_utilization}% Utilizado
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Próximo Pago */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Próximo Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {creditSummary.next_payment ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Monto</span>
                        <span className="font-semibold">{formatCurrency(creditSummary.next_payment.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fecha de Vencimiento</span>
                        <span className="font-medium">
                          {new Date(creditSummary.next_payment.due_date).toLocaleDateString('es-PY')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Estado</span>
                        {creditSummary.next_payment.is_overdue ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Vencido
                          </Badge>
                        ) : creditSummary.next_payment.days_until_due <= 3 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Próximo a Vencer
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Al Día
                          </Badge>
                        )}
                      </div>
                      <div className="text-center text-sm text-gray-600">
                        {creditSummary.next_payment.is_overdue 
                          ? `Vencido hace ${Math.abs(creditSummary.next_payment.days_until_due)} días`
                          : `Vence en ${creditSummary.next_payment.days_until_due} días`
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No hay pagos pendientes</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Historial de Pagos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Historial de Pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {creditSummary.payment_history.on_time_payments}
                    </div>
                    <div className="text-sm text-gray-600">A Tiempo</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {creditSummary.payment_history.late_payments}
                    </div>
                    <div className="text-sm text-gray-600">Tardíos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {creditSummary.payment_history.missed_payments}
                    </div>
                    <div className="text-sm text-gray-600">Perdidos</div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="text-center">
                  <div className={cn("text-3xl font-bold", getPaymentScoreColor(creditSummary.payment_history.payment_score))}>
                    {creditSummary.payment_history.payment_score}/100
                  </div>
                  <div className="text-sm text-gray-600">Puntuación de Pago</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creditos" className="space-y-4">
            <div className="space-y-3">
              {credits.map((credit) => (
                <motion.div
                  key={credit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">Crédito #{credit.id.slice(-6)}</h4>
                            <Badge variant={credit.status === 'active' ? 'default' : credit.status === 'completed' ? 'secondary' : 'destructive'}>
                              {credit.status === 'active' ? 'Activo' : credit.status === 'completed' ? 'Completado' : 'En Mora'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Principal:</span>
                              <div className="font-medium">{formatCurrency(credit.principal)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Tasa:</span>
                              <div className="font-medium">{credit.interest_rate}%</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Plazo:</span>
                              <div className="font-medium">{credit.term_months} meses</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Inicio:</span>
                              <div className="font-medium">{new Date(credit.start_date).toLocaleDateString('es-PY')}</div>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Ver Detalle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pagos" className="space-y-4">
            <div className="space-y-3">
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <div className="font-semibold">{formatCurrency(payment.amount)}</div>
                              <div className="text-sm text-gray-600">
                                {new Date(payment.created_at).toLocaleDateString('es-PY')} • 
                                {payment.payment_method === 'cash' ? ' Efectivo' : 
                                 payment.payment_method === 'card' ? ' Tarjeta' : 
                                 payment.payment_method === 'transfer' ? ' Transferencia' : ' N/A'}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">
                            Crédito #{payment.credit_id.slice(-6)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600">No hay pagos registrados</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="riesgo" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Evaluación de Riesgo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Nivel de Riesgo</span>
                    <Badge className={cn("gap-2", getRiskColor(creditSummary.risk_assessment.risk_level))}>
                      {getRiskIcon(creditSummary.risk_assessment.risk_level)}
                      {creditSummary.risk_assessment.risk_level === 'low' ? 'Bajo' :
                       creditSummary.risk_assessment.risk_level === 'medium' ? 'Medio' :
                       creditSummary.risk_assessment.risk_level === 'high' ? 'Alto' : 'Crítico'}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Puntuación de Riesgo</span>
                      <span className="font-medium">{creditSummary.risk_assessment.risk_score}/100</span>
                    </div>
                    <Progress 
                      value={creditSummary.risk_assessment.risk_score} 
                      className="h-2"
                    />
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Factores de Riesgo</h4>
                    <div className="space-y-2">
                      {creditSummary.risk_assessment.factors.map((factor, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}