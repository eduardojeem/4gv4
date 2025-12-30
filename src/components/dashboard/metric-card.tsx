'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: ReactNode
  description?: string
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  progress?: {
    value: number
    max: number
    label?: string
    color?: 'default' | 'success' | 'warning' | 'destructive'
  }
  status?: 'success' | 'warning' | 'error' | 'neutral'
  className?: string
  onClick?: () => void
  loading?: boolean
  subtitle?: string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50',
    iconClassName: 'text-green-600 dark:text-green-400'
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/50',
    iconClassName: 'text-yellow-600 dark:text-yellow-400'
  },
  error: {
    icon: XCircle,
    className: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50',
    iconClassName: 'text-red-600 dark:text-red-400'
  },
  neutral: {
    icon: Minus,
    className: 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/50',
    iconClassName: 'text-gray-600 dark:text-gray-400'
  }
}

const progressColors = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  destructive: 'bg-red-500'
}

export function MetricCard({
  title,
  value,
  icon,
  description,
  trend,
  progress,
  status,
  className,
  onClick,
  loading = false,
  subtitle,
  badge
}: MetricCardProps) {
  const StatusIcon = status ? statusConfig[status].icon : null
  const isClickable = !!onClick

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`
      }
      return val.toLocaleString()
    }
    return val
  }

  const getTrendIcon = () => {
    if (!trend) return null
    
    if (trend.value > 0) {
      return <TrendingUp className="h-3 w-3" />
    } else if (trend.value < 0) {
      return <TrendingDown className="h-3 w-3" />
    } else {
      return <Minus className="h-3 w-3" />
    }
  }

  const getTrendColor = () => {
    if (!trend) return ''
    
    if (trend.isPositive === undefined) {
      // Auto-detect: positive values are good, negative are bad
      return trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-gray-500'
    } else {
      // Explicit positive/negative indication
      return trend.isPositive ? 'text-green-600' : 'text-red-600'
    }
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        status && statusConfig[status].className,
        isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
        loading && "animate-pulse",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {badge && (
            <Badge variant={badge.variant || 'secondary'} className="text-xs">
              {badge.text}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {status && StatusIcon && (
            <StatusIcon className={cn("h-4 w-4", statusConfig[status].iconClassName)} />
          )}
          <div className={cn(
            "p-2 rounded-md bg-muted/50",
            status && statusConfig[status].iconClassName
          )}>
            {icon}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Valor principal */}
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              ) : (
                formatValue(value)
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Tendencia */}
          {trend && !loading && (
            <div className={cn(
              "flex items-center space-x-1 text-xs",
              getTrendColor()
            )}>
              {getTrendIcon()}
              <span className="font-medium">
                {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground">
                {trend.label}
              </span>
            </div>
          )}

          {/* Barra de progreso */}
          {progress && !loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {progress.label || 'Progreso'}
                </span>
                <span className="font-medium">
                  {progress.value}/{progress.max}
                </span>
              </div>
              <Progress 
                value={(progress.value / progress.max) * 100} 
                className="h-2"
              />
            </div>
          )}

          {/* Descripción */}
          {description && !loading && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}

          {/* Estado de carga */}
          {loading && (
            <div className="space-y-2">
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente especializado para métricas de inventario
interface InventoryMetricCardProps extends Omit<MetricCardProps, 'progress' | 'status'> {
  current: number
  target?: number
  minimum?: number
  maximum?: number
  unit?: string
}

export function InventoryMetricCard({
  current,
  target,
  minimum,
  maximum,
  unit = '',
  ...props
}: InventoryMetricCardProps) {
  // Determinar estado basado en los valores
  const getStatus = (): MetricCardProps['status'] => {
    if (minimum !== undefined && current <= minimum) {
      return 'error'
    }
    if (minimum !== undefined && current <= minimum * 1.2) {
      return 'warning'
    }
    if (maximum !== undefined && current >= maximum) {
      return 'warning'
    }
    return 'success'
  }

  // Calcular progreso si hay objetivo
  const getProgress = (): MetricCardProps['progress'] | undefined => {
    if (target === undefined) return undefined

    return {
      value: current,
      max: target,
      label: `Objetivo: ${target}${unit}`,
      color: current >= target ? 'success' : current >= target * 0.8 ? 'warning' : 'destructive'
    }
  }

  // Generar descripción automática
  const getDescription = (): string => {
    const parts: string[] = []
    
    if (minimum !== undefined) {
      parts.push(`Mín: ${minimum}${unit}`)
    }
    if (maximum !== undefined) {
      parts.push(`Máx: ${maximum}${unit}`)
    }
    if (target !== undefined) {
      parts.push(`Objetivo: ${target}${unit}`)
    }
    
    return parts.join(' • ')
  }

  return (
    <MetricCard
      {...props}
      value={`${current}${unit}`}
      status={getStatus()}
      progress={getProgress()}
      description={props.description || getDescription()}
    />
  )
}

// Componente para métricas financieras
interface FinancialMetricCardProps extends Omit<MetricCardProps, 'value'> {
  amount: number
  currency?: string
  previousAmount?: number
  formatAsPercentage?: boolean
}

export function FinancialMetricCard({
  amount,
  currency = '€',
  previousAmount,
  formatAsPercentage = false,
  ...props
}: FinancialMetricCardProps) {
  const formatAmount = (value: number): string => {
    if (formatAsPercentage) {
      return `${value.toFixed(1)}%`
    }
    return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
  }

  const getTrend = (): MetricCardProps['trend'] | undefined => {
    if (previousAmount === undefined) return undefined

    const change = ((amount - previousAmount) / previousAmount) * 100
    
    return {
      value: Math.abs(change),
      label: 'vs período anterior',
      isPositive: change >= 0
    }
  }

  return (
    <MetricCard
      {...props}
      value={formatAmount(amount)}
      trend={getTrend()}
    />
  )
}