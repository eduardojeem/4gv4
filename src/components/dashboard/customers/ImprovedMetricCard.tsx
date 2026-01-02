"use client"

/**
 * ImprovedMetricCard
 * 
 * Tarjeta de métrica mejorada con:
 * - Números más grandes y prominentes
 * - Iconos más descriptivos y coloridos
 * - Animaciones suaves
 * - Hover states claros
 * - Información adicional en tooltip
 * - Gráfico de tendencia (sparkline)
 */

import React from 'react'
import { motion  } from '../../ui/motion'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImprovedMetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  gradient: string
  description?: string
  trend?: number[] // Array of values for sparkline
  onClick?: () => void
  compact?: boolean
}

export function ImprovedMetricCard({
  title,
  value,
  icon,
  change,
  changeType = "neutral",
  gradient,
  description,
  trend,
  onClick,
  compact = false
}: ImprovedMetricCardProps) {
  const isClickable = !!onClick

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileHover={isClickable ? { 
          y: -8, 
          scale: 1.02,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        } : undefined}
        whileTap={isClickable ? { scale: 0.98 } : undefined}
        transition={{ 
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
        className="h-full"
      >
        <Card 
          className={cn(
            "border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 h-full",
            isClickable && "cursor-pointer group"
          )}
          onClick={onClick}
        >
          <CardContent className={cn(
            "relative overflow-hidden",
            compact ? "p-4" : "p-6"
          )}>
            {/* Background Gradient */}
            <div className={cn(
              "absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl",
              `bg-gradient-to-br ${gradient}`
            )} />

            <div className="relative flex items-start justify-between">
              {/* Left Side: Title and Value */}
              <div className="flex-1 space-y-2">
                {/* Title with Info Icon */}
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {title}
                  </p>
                  {description && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Value - Large and Prominent */}
                <motion.p 
                  className={cn(
                    "font-bold text-gray-900 dark:text-white tabular-nums",
                    compact ? "text-2xl" : "text-3xl lg:text-4xl"
                  )}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {value}
                </motion.p>

                {/* Change Indicator */}
                {change && (
                  <motion.div 
                    className="flex items-center gap-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {changeType === "positive" && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    {changeType === "negative" && (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    {changeType === "neutral" && (
                      <Minus className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={cn(
                      "text-sm font-semibold",
                      changeType === "positive" && "text-green-600 dark:text-green-400",
                      changeType === "negative" && "text-red-600 dark:text-red-400",
                      changeType === "neutral" && "text-gray-500 dark:text-gray-400"
                    )}>
                      {change}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      vs mes anterior
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Right Side: Icon */}
              <motion.div 
                className={cn(
                  "p-3 rounded-xl shadow-lg",
                  `bg-gradient-to-br ${gradient}`,
                  isClickable && "group-hover:scale-110 transition-transform duration-200"
                )}
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className={cn(
                  "text-white",
                  compact ? "h-6 w-6" : "h-7 w-7 lg:h-8 lg:w-8"
                )}>
                  {icon}
                </div>
              </motion.div>
            </div>

            {/* Sparkline Trend (if provided) */}
            {trend && trend.length > 0 && (
              <div className="mt-4 h-12 flex items-end gap-1">
                {trend.map((value, index) => {
                  const maxValue = Math.max(...trend)
                  const height = (value / maxValue) * 100
                  return (
                    <motion.div
                      key={index}
                      className={cn(
                        "flex-1 rounded-t",
                        `bg-gradient-to-t ${gradient} opacity-30`
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                    />
                  )
                })}
              </div>
            )}

            {/* Click Indicator */}
            {isClickable && (
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span>Click para filtrar</span>
                  <TrendingUp className="h-3 w-3" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}
