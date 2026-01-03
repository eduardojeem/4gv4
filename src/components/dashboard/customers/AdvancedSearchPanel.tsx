"use client"

/**
 * AdvancedSearchPanel
 * 
 * Panel de búsqueda avanzada que muestra:
 * - Patrones detectados en la búsqueda
 * - Sugerencias inteligentes
 * - Filtros rápidos contextuales
 * - Historial de búsquedas
 * - Métricas de rendimiento
 */

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  Search, 
  TrendingUp, 
  Clock, 
  Target,
  Zap,
  Mail,
  Phone,
  Hash,
  MapPin,
  Building,
  User,
  Filter,
  BarChart3,
  Lightbulb
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Customer } from '@/hooks/use-customer-state'
import searchService from '@/services/search-service'

interface AdvancedSearchPanelProps {
  query: string
  customers: Customer[]
  totalResults: number
  searchTime: number
  onQuickFilter: (filter: string) => void
  onSuggestionSelect: (suggestion: string) => void
  className?: string
}

export function AdvancedSearchPanel({
  query,
  customers,
  totalResults,
  searchTime,
  onQuickFilter,
  onSuggestionSelect,
  className
}: AdvancedSearchPanelProps) {
  const [showDetails, setShowDetails] = useState(false)

  // Detect search patterns
  const searchPatterns = useMemo(() => {
    if (!query) return null

    const patterns = {
      isEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query),
      isPhone: /^[\d\s\-\+\(\)]+$/.test(query) && query.replace(/\D/g, '').length >= 8,
      isRUC: /^\d{12}$/.test(query.replace(/\D/g, '')),
      isCode: /^CLI-/.test(query.toUpperCase()),
      hasNumbers: /\d/.test(query),
      hasSpecialChars: /[^\w\s]/.test(query),
      length: query.length
    }

    return patterns
  }, [query])

  // Generate contextual suggestions
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return []
    return searchService.generateSuggestions(customers, query)
  }, [query, customers])

  // Generate smart filters based on search context
  const contextualFilters = useMemo(() => {
    if (!searchPatterns) return []

    const filters = []

    if (searchPatterns.isEmail) {
      filters.push({
        label: "Buscar por email",
        icon: <Mail className="h-4 w-4" />,
        filter: `email:${query}`,
        description: "Búsqueda exacta por email"
      })
    }

    if (searchPatterns.isPhone) {
      filters.push({
        label: "Buscar por teléfono",
        icon: <Phone className="h-4 w-4" />,
        filter: `phone:${query}`,
        description: "Búsqueda exacta por teléfono"
      })
    }

    if (searchPatterns.isCode) {
      filters.push({
        label: "Buscar por código",
        icon: <Hash className="h-4 w-4" />,
        filter: `code:${query}`,
        description: "Búsqueda exacta por código de cliente"
      })
    }

    if (searchPatterns.hasNumbers && !searchPatterns.isPhone && !searchPatterns.isRUC) {
      filters.push({
        label: "Buscar en RUC",
        icon: <Hash className="h-4 w-4" />,
        filter: `ruc:${query}`,
        description: "Buscar en números de RUC"
      })
    }

    return filters
  }, [searchPatterns, query])

  // Search performance analysis
  const performanceAnalysis = useMemo(() => {
    const analysis = {
      speed: searchTime < 100 ? 'excellent' : searchTime < 300 ? 'good' : 'slow',
      accuracy: totalResults === 0 ? 'no_results' : 
                totalResults <= 10 ? 'precise' : 
                totalResults <= 50 ? 'good' : 'broad',
      efficiency: (totalResults / customers.length) * 100
    }

    return analysis
  }, [searchTime, totalResults, customers.length])

  if (!query) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Search Analysis Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Análisis de Búsqueda
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 dark:text-blue-400"
            >
              {showDetails ? 'Ocultar' : 'Detalles'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalResults}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Resultados
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {searchTime}ms
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Tiempo
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {performanceAnalysis.efficiency.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Cobertura
              </div>
            </div>
          </div>

          {/* Performance Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant="secondary" 
              className={cn(
                performanceAnalysis.speed === 'excellent' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                performanceAnalysis.speed === 'good' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              )}
            >
              <Zap className="h-3 w-3 mr-1" />
              {performanceAnalysis.speed === 'excellent' ? 'Muy Rápido' :
               performanceAnalysis.speed === 'good' ? 'Rápido' : 'Lento'}
            </Badge>
            
            <Badge 
              variant="secondary"
              className={cn(
                performanceAnalysis.accuracy === 'precise' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                performanceAnalysis.accuracy === 'good' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                performanceAnalysis.accuracy === 'broad' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              )}
            >
              <Target className="h-3 w-3 mr-1" />
              {performanceAnalysis.accuracy === 'precise' ? 'Preciso' :
               performanceAnalysis.accuracy === 'good' ? 'Bueno' :
               performanceAnalysis.accuracy === 'broad' ? 'Amplio' : 'Sin resultados'}
            </Badge>
          </div>

          {/* Detected Patterns */}
          {searchPatterns && showDetails && (
            <div className="space-y-3">
              <Separator />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Patrones Detectados
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {searchPatterns.isEmail && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Mail className="h-4 w-4" />
                      <span>Formato de email</span>
                    </div>
                  )}
                  {searchPatterns.isPhone && (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Phone className="h-4 w-4" />
                      <span>Número de teléfono</span>
                    </div>
                  )}
                  {searchPatterns.isRUC && (
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                      <Hash className="h-4 w-4" />
                      <span>Número de RUC</span>
                    </div>
                  )}
                  {searchPatterns.isCode && (
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <Hash className="h-4 w-4" />
                      <span>Código de cliente</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contextual Filters */}
      {contextualFilters.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {contextualFilters.map((filter, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickFilter(filter.filter)}
                  className="flex items-center gap-2 justify-start h-auto p-3"
                >
                  {filter.icon}
                  <div className="text-left">
                    <div className="font-medium text-sm">{filter.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {filter.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4" />
              Sugerencias Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.slice(0, 5).map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => onSuggestionSelect(suggestion.value)}
                  className="w-full flex items-center gap-3 justify-start h-auto p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-lg">{suggestion.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{suggestion.value}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {suggestion.type}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {suggestion.count} coincidencia{suggestion.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}