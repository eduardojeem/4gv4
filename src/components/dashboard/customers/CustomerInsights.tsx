"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Star,
  Calendar,
  Target,
  Activity,
  Heart,
  Award,
  Clock,
  BarChart3,
  PieChart,
  LineChart
} from "lucide-react"
import { GSIcon } from '@/components/ui/standardized-components'

interface CustomerInsightsProps {
  customer: {
    id: number
    name: string
    email: string
    customer_type: string
    lifetime_value: number
    total_purchases: number
    satisfaction_score: number
    avg_order_value: number
    purchase_frequency: string
    last_activity?: string
    avatar?: string
    loyalty_points?: number
    credit_score?: number
  }
}

export function CustomerInsights({ customer }: CustomerInsightsProps) {
  const getGrowthIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getGrowthColor = (trend: string) => {
    switch (trend) {
      case "up": return "text-green-600 bg-green-50 dark:bg-green-900/20"
      case "down": return "text-red-600 bg-red-50 dark:bg-red-900/20"
      default: return "text-gray-600 bg-gray-50 dark:bg-gray-900/20"
    }
  }

  const getLoyaltyLevel = (purchases: number) => {
    if (purchases >= 20) return { level: 'Diamante', color: 'text-purple-600' }
    if (purchases >= 10) return { level: 'Oro', color: 'text-yellow-600' }
    if (purchases >= 5) return { level: 'Plata', color: 'text-gray-600' }
    return { level: 'Bronce', color: 'text-orange-600' }
  }

  const getRiskLevel = (score: number) => {
    if (score >= 4.5) return { level: 'Bajo', color: 'text-green-600' }
    if (score >= 3.5) return { level: 'Medio', color: 'text-yellow-600' }
    return { level: 'Alto', color: 'text-red-600' }
  }

  const loyaltyInfo = getLoyaltyLevel(customer.total_purchases)
  const riskInfo = getRiskLevel(customer.satisfaction_score)

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Valor de Vida</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    ${customer.lifetime_value.toLocaleString()}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs ${getGrowthColor("up")}`}>
                    {getGrowthIcon("up")}
                    <span className="font-medium">
                      +12%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <GSIcon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Valor Promedio</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      ${customer.avg_order_value.toLocaleString()}
                    </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                    {customer.total_purchases} compras
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Lealtad</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {customer.loyalty_points || 0}
                    </p>
                  <Badge className={`text-xs mt-1 ${loyaltyInfo.color} bg-transparent border-0`}>
                      {loyaltyInfo.level}
                    </Badge>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Heart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Satisfacción</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                      {customer.satisfaction_score}
                    </p>
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < customer.satisfaction_score
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <Award className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement & Risk Analysis */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-blue-600" />
                Análisis de Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nivel de Engagement
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {customer.credit_score || 75}%
                  </span>
                </div>
                <Progress value={customer.credit_score || 75} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Riesgo de Abandono
                  </span>
                  <Badge className={`text-xs ${riskInfo.color} bg-transparent border-0`}>
                    {riskInfo.level}
                  </Badge>
                </div>
                <Progress value={customer.satisfaction_score * 20} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Frecuencia de Compra
                  </span>
                  <span className="text-sm font-bold text-green-600">
                    {customer.purchase_frequency}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  Última actividad: {customer.last_activity || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Purchase Trends */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Tendencias de Compra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Este Mes</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      ${customer.avg_order_value.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Promedio</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">
                      ${customer.avg_order_value.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Máximo</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      ${(customer.avg_order_value * 1.5).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Simple spending trend visualization */}
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tendencia de Compras
                  </p>
                  <div className="flex items-end gap-1 h-20">
                    {Array.from({ length: 6 }, (_, index) => {
                      const baseAmount = customer.avg_order_value
                      const variation = (Math.random() - 0.5) * 0.4
                      const amount = baseAmount * (1 + variation)
                      const height = ((amount / baseAmount) * 50) + 25
                      return (
                        <div
                          key={index}
                          className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm relative group"
                          style={{ height: `${height}%` }}
                        >
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            ${Math.round(amount).toLocaleString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Preferred Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-purple-600" />
              Categorías Preferidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {['Electrónicos', 'Ropa', 'Hogar', 'Deportes'].map((category, index) => (
                <Badge
                  key={category}
                  variant="secondary"
                  className={`
                    ${index === 0 ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : ''}
                    ${index === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                    ${index === 2 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                    ${index > 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' : ''}
                  `}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
