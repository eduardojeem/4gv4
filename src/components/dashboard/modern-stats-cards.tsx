'use client'

import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { useEffect, memo } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// Hook para animación de contador
const useAnimatedCounter = (value: number, duration: number = 1) => {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, { duration })
    return controls.stop
  }, [count, value, duration])

  return rounded
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<any>
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  color?: "blue" | "green" | "amber" | "red" | "purple" | "indigo"
  delay?: number
}

const colorVariants = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-100",
    gradient: "from-blue-500 to-blue-600"
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    border: "border-green-100",
    gradient: "from-green-500 to-green-600"
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-100",
    gradient: "from-amber-500 to-amber-600"
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-100",
    gradient: "from-red-500 to-red-600"
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-100",
    gradient: "from-purple-500 to-purple-600"
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    border: "border-indigo-100",
    gradient: "from-indigo-500 to-indigo-600"
  }
}

export const ModernStatsCard = memo(({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue, 
  color = "blue",
  delay = 0
}: StatsCardProps) => {
  const colors = colorVariants[color]
  
  // Detectar si el valor es numérico para animación
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
  const isNumeric = !isNaN(numericValue)
  const animatedValue = useAnimatedCounter(isNumeric ? numericValue : 0, 1.2)

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
      case "down":
        return <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
      default:
        return <Minus className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green-600"
      case "down":
        return "text-red-600"
      default:
        return "text-gray-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ 
        y: -4, 
        scale: 1.02,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        duration: 0.4, 
        delay,
        type: "spring",
        stiffness: 100
      }}
    >
      <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 bg-white overflow-hidden group">
        <CardContent className="p-4 sm:p-6 relative">
          {/* Background gradient effect */}
          <div className={`absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${colors.gradient} opacity-5 rounded-full transform translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 group-hover:scale-110 transition-transform duration-300`} />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 tracking-wide uppercase truncate">
                  {title}
                </p>
                <motion.p 
                  className="text-2xl sm:text-3xl font-bold text-gray-900"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: delay + 0.2, duration: 0.3 }}
                >
                  {isNumeric ? (
                    <motion.span>{animatedValue}</motion.span>
                  ) : (
                    value
                  )}
                </motion.p>
              </div>
              
              {subtitle && (
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed truncate">
                  {subtitle}
                </p>
              )}
              
              {trend && trendValue && (
                <motion.div 
                  className="flex items-center gap-1 sm:gap-1.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: delay + 0.4, duration: 0.3 }}
                >
                  {getTrendIcon()}
                  <span className={`text-xs sm:text-sm font-medium ${getTrendColor()}`}>
                    {trendValue}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:inline">vs mes anterior</span>
                </motion.div>
              )}
            </div>
            
            <motion.div 
              className={`p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.border} border flex-shrink-0 ml-3`}
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: delay + 0.1, duration: 0.3 }}
              whileHover={{ rotate: 5, scale: 1.05 }}
            >
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${colors.text}`} />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})

// Componente de tarjeta de estadística compacta
export const CompactStatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = "blue",
  delay = 0 
}: Omit<StatsCardProps, 'subtitle' | 'trend' | 'trendValue'>) => {
  const colors = colorVariants[color]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                {title}
              </p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
                {value}
              </p>
            </div>
            <div className={`p-1.5 sm:p-2 rounded-lg ${colors.bg} flex-shrink-0 ml-2`}>
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Componente de tarjeta con progreso
export const ProgressStatsCard = ({ 
  title, 
  value, 
  maxValue, 
  icon: Icon, 
  color = "blue",
  delay = 0 
}: StatsCardProps & { maxValue: number }) => {
  const colors = colorVariants[color]
  const percentage = Math.min((Number(value) / maxValue) * 100, 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                {title}
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {value}
              </p>
            </div>
            <div className={`p-1.5 sm:p-2 rounded-lg ${colors.bg} flex-shrink-0 ml-3`}>
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-500">Progreso</span>
              <span className="font-medium text-gray-700">{percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <motion.div 
                className={`bg-gradient-to-r ${colors.gradient} h-1.5 sm:h-2 rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, delay: delay + 0.2 }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}