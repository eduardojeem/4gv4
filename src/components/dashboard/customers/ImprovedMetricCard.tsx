"use client"

/**
 * ImprovedMetricCard
 * 
 * Tarjeta de métrica con diseño limpio y moderno:
 * - Números prominentes con tipografía clara
 * - Iconos con fondo sutil de color
 * - Indicador de cambio compacto
 * - Hover suave sin animaciones excesivas
 * - Soporte dark mode con buen contraste
 */

import React from 'react'
import { motion } from 'framer-motion'
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
  trend?: number[]
  onClick?: () => void
  compact?: boolean
}

// Map gradient strings to accent color classes for the new design
function getAccentClasses(gradient: string) {
  if (gradient.includes('blue') || gradient.includes('cyan')) {
    return {
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      iconText: 'text-blue-600 dark:text-blue-400',
      border: 'border-l-blue-500',
    }
  }
  if (gradient.includes('green') || gradient.includes('emerald')) {
    return {
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-l-emerald-500',
    }
  }
  if (gradient.includes('purple') || gradient.includes('violet')) {
    return {
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconText: 'text-violet-600 dark:text-violet-400',
      border: 'border-l-violet-500',
    }
  }
  if (gradient.includes('red') || gradient.includes('orange')) {
    return {
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconText: 'text-amber-600 dark:text-amber-400',
      border: 'border-l-amber-500',
    }
  }
  return {
    iconBg: 'bg-gray-50 dark:bg-gray-800',
    iconText: 'text-gray-600 dark:text-gray-400',
    border: 'border-l-gray-400',
  }
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
  const accent = getAccentClasses(gradient)

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-full"
      >
        <Card 
          className={cn(
            "border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 h-full",
            "bg-white dark:bg-slate-900",
            "border-l-4",
            accent.border,
            isClickable && "cursor-pointer group hover:border-l-[5px]"
          )}
          onClick={onClick}
        >
          <CardContent className={cn(compact ? "p-4" : "p-5")}>
            <div className="flex items-start justify-between gap-3">
              {/* Left Side: Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Title */}
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    "font-medium text-gray-500 dark:text-gray-400 truncate",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {title}
                  </p>
                  {description && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="max-w-xs text-sm">{description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Value */}
                <p className={cn(
                  "font-bold text-gray-900 dark:text-gray-50 tabular-nums tracking-tight",
                  compact ? "text-xl" : "text-2xl lg:text-3xl"
                )}>
                  {value}
                </p>

                {/* Change Indicator */}
                {change && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold",
                      changeType === "positive" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                      changeType === "negative" && "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
                      changeType === "neutral" && "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
                      {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
                      {changeType === "neutral" && <Minus className="h-3 w-3" />}
                      {change}
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      vs anterior
                    </span>
                  </div>
                )}
              </div>

              {/* Right Side: Icon */}
              <div className={cn(
                "flex-shrink-0 rounded-xl flex items-center justify-center",
                accent.iconBg,
                compact ? "p-2.5" : "p-3"
              )}>
                <div className={cn(accent.iconText, compact ? "[&>svg]:h-5 [&>svg]:w-5" : "[&>svg]:h-6 [&>svg]:w-6")}>
                  {icon}
                </div>
              </div>
            </div>

            {/* Sparkline Trend (if provided) */}
            {trend && trend.length > 0 && (
              <div className="mt-3 h-8 flex items-end gap-[2px]">
                {trend.map((val, index) => {
                  const maxValue = Math.max(...trend)
                  const height = maxValue > 0 ? (val / maxValue) * 100 : 0
                  return (
                    <motion.div
                      key={index}
                      className={cn(
                        "flex-1 rounded-sm",
                        accent.iconBg
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 4)}%` }}
                      transition={{ delay: 0.2 + index * 0.03, duration: 0.4 }}
                    />
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}
