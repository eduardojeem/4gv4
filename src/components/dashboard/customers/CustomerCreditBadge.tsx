"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertCircle,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { CustomerCreditSummary } from '@/hooks/use-customer-credits'

interface CustomerCreditBadgeProps {
  creditSummary: CustomerCreditSummary | null
  variant?: 'default' | 'compact' | 'detailed'
  showTooltip?: boolean
}

export function CustomerCreditBadge({ 
  creditSummary, 
  variant = 'default',
  showTooltip = true 
}: CustomerCreditBadgeProps) {
  if (!creditSummary) {
    return (
      <Badge variant="outline" className="gap-1 text-gray-500">
        <CreditCard className="h-3 w-3" />
        Sin Créditos
      </Badge>
    )
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="h-3 w-3" />
      case 'medium': return <Info className="h-3 w-3" />
      case 'high': return <AlertTriangle className="h-3 w-3" />
      case 'critical': return <AlertCircle className="h-3 w-3" />
      default: return <Shield className="h-3 w-3" />
    }
  }

  const getPaymentStatusIcon = () => {
    if (creditSummary.next_payment?.is_overdue) {
      return <AlertTriangle className="h-3 w-3 text-red-500" />
    }
    if (creditSummary.next_payment && creditSummary.next_payment.days_until_due <= 3) {
      return <Clock className="h-3 w-3 text-yellow-500" />
    }
    return <CheckCircle className="h-3 w-3 text-green-500" />
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600'
    if (utilization >= 75) return 'text-orange-600'
    if (utilization >= 50) return 'text-yellow-600'
    return 'text-green-600'
  }

  const tooltipContent = (
    <div className="space-y-2 text-xs">
      <div className="font-semibold border-b pb-1">Resumen Crediticio</div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-gray-400">Créditos Activos:</div>
          <div className="font-medium">{creditSummary.active_credits}</div>
        </div>
        <div>
          <div className="text-gray-400">Total Créditos:</div>
          <div className="font-medium">{creditSummary.total_credits}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-gray-400">Saldo Pendiente:</div>
          <div className="font-medium">{formatCurrency(creditSummary.total_pending)}</div>
        </div>
        <div>
          <div className="text-gray-400">Límite:</div>
          <div className="font-medium">{formatCurrency(creditSummary.credit_limit)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-gray-400">Utilización:</div>
          <div className={cn("font-medium", getUtilizationColor(creditSummary.credit_utilization))}>
            {creditSummary.credit_utilization}%
          </div>
        </div>
        <div>
          <div className="text-gray-400">Score Pago:</div>
          <div className="font-medium">{creditSummary.payment_history.payment_score}/100</div>
        </div>
      </div>

      {creditSummary.next_payment && (
        <div className="border-t pt-2">
          <div className="text-gray-400">Próximo Pago:</div>
          <div className="font-medium">{formatCurrency(creditSummary.next_payment.amount)}</div>
          <div className="text-gray-400">
            {creditSummary.next_payment.is_overdue 
              ? `Vencido hace ${Math.abs(creditSummary.next_payment.days_until_due)} días`
              : `Vence en ${creditSummary.next_payment.days_until_due} días`
            }
          </div>
        </div>
      )}

      <div className="border-t pt-2">
        <div className="flex items-center gap-1">
          {getRiskIcon(creditSummary.risk_assessment.risk_level)}
          <span className="font-medium">
            Riesgo: {creditSummary.risk_assessment.risk_level === 'low' ? 'Bajo' :
                     creditSummary.risk_assessment.risk_level === 'medium' ? 'Medio' :
                     creditSummary.risk_assessment.risk_level === 'high' ? 'Alto' : 'Crítico'}
          </span>
        </div>
      </div>
    </div>
  )

  if (variant === 'compact') {
    const badge = (
      <div className="flex items-center gap-1">
        <Badge 
          className={cn("gap-1 text-xs", getRiskColor(creditSummary.risk_assessment.risk_level))}
        >
          {getRiskIcon(creditSummary.risk_assessment.risk_level)}
          {creditSummary.active_credits}
        </Badge>
        {creditSummary.next_payment?.is_overdue && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Vencido
          </Badge>
        )}
      </div>
    )

    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : badge
  }

  if (variant === 'detailed') {
    const content = (
      <div className="flex items-center gap-2">
        <Badge className={cn("gap-1", getRiskColor(creditSummary.risk_assessment.risk_level))}>
          <CreditCard className="h-3 w-3" />
          {creditSummary.active_credits} Activos
        </Badge>
        
        <Badge variant="outline" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          {formatCurrency(creditSummary.total_pending)}
        </Badge>

        <Badge 
          variant="outline" 
          className={cn("gap-1", getUtilizationColor(creditSummary.credit_utilization))}
        >
          {creditSummary.credit_utilization}% Util.
        </Badge>

        {creditSummary.next_payment && (
          <Badge 
            variant={creditSummary.next_payment.is_overdue ? "destructive" : "secondary"}
            className="gap-1"
          >
            {getPaymentStatusIcon()}
            {creditSummary.next_payment.is_overdue ? 'Vencido' : 'Próximo'}
          </Badge>
        )}
      </div>
    )

    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : content
  }

  // Variant default
  const badge = (
    <div className="flex items-center gap-1">
      <Badge className={cn("gap-1", getRiskColor(creditSummary.risk_assessment.risk_level))}>
        <CreditCard className="h-3 w-3" />
        {creditSummary.active_credits} Créditos
      </Badge>
      
      {creditSummary.credit_utilization > 80 && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <TrendingUp className="h-3 w-3" />
          {creditSummary.credit_utilization}%
        </Badge>
      )}

      {creditSummary.next_payment?.is_overdue && (
        <Badge variant="destructive" className="gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Vencido
        </Badge>
      )}
    </div>
  )

  return showTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : badge
}

// Componente para mostrar métricas de crédito en formato de estadística
export function CustomerCreditStats({ creditSummary }: { creditSummary: CustomerCreditSummary | null }) {
  if (!creditSummary) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <div className="text-center p-2 bg-blue-50 rounded-lg">
        <div className="font-semibold text-blue-600">{creditSummary.active_credits}</div>
        <div className="text-gray-600">Activos</div>
      </div>
      
      <div className="text-center p-2 bg-green-50 rounded-lg">
        <div className="font-semibold text-green-600">{creditSummary.payment_history.payment_score}</div>
        <div className="text-gray-600">Score</div>
      </div>
      
      <div className="text-center p-2 bg-orange-50 rounded-lg">
        <div className="font-semibold text-orange-600">{creditSummary.credit_utilization}%</div>
        <div className="text-gray-600">Utilización</div>
      </div>
      
      <div className="text-center p-2 bg-purple-50 rounded-lg">
        <div className="font-semibold text-purple-600">
          {formatCurrency(creditSummary.total_pending).replace('Gs ', '')}
        </div>
        <div className="text-gray-600">Pendiente</div>
      </div>
    </div>
  )
}