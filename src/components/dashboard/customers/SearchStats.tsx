"use client"

/**
 * SearchStats Component
 * 
 * Displays search statistics and insights:
 * - Search results count
 * - Search performance metrics
 * - Popular search terms
 * - Search suggestions
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Search, 
  TrendingUp, 
  Clock, 
  Target,
  Zap,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchStatsProps {
  totalResults: number
  searchTime?: number
  query: string
  totalCustomers: number
  className?: string
}

export function SearchStats({
  totalResults,
  searchTime = 0,
  query,
  totalCustomers,
  className
}: SearchStatsProps) {
  const searchAccuracy = totalCustomers > 0 ? (totalResults / totalCustomers) * 100 : 0
  const isGoodResult = totalResults > 0 && totalResults <= 50
  const isTooManyResults = totalResults > 100
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400", className)}
    >
      {/* Results Count */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <span>
          <strong className="text-gray-900 dark:text-gray-100">{totalResults.toLocaleString()}</strong>
          {totalResults === 1 ? ' resultado' : ' resultados'}
        </span>
        {query && (
          <span>
            para <strong className="text-blue-600 dark:text-blue-400">"{query}"</strong>
          </span>
        )}
      </div>

      {/* Search Time */}
      {searchTime > 0 && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{searchTime}ms</span>
        </div>
      )}

      {/* Search Quality Indicators */}
      <div className="flex items-center gap-2">
        {isGoodResult && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <Target className="h-3 w-3 mr-1" />
            Preciso
          </Badge>
        )}
        
        {isTooManyResults && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <TrendingUp className="h-3 w-3 mr-1" />
            Refinar búsqueda
          </Badge>
        )}
        
        {totalResults === 0 && query && (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Sin coincidencias
          </Badge>
        )}
      </div>

      {/* Performance Indicator */}
      {searchTime > 0 && (
        <div className="flex items-center gap-1">
          {searchTime < 100 ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <Zap className="h-3 w-3 mr-1" />
              Rápido
            </Badge>
          ) : searchTime < 500 ? (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
              Normal
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              Lento
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  )
}

interface SearchInsightsProps {
  query: string
  totalResults: number
  suggestions?: string[]
  className?: string
}

export function SearchInsights({
  query,
  totalResults,
  suggestions = [],
  className
}: SearchInsightsProps) {
  if (!query || totalResults > 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mt-4", className)}
    >
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Search className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                No se encontraron resultados
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                Intenta con estos consejos para mejorar tu búsqueda:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Verifica la ortografía</li>
                <li>• Usa términos más generales</li>
                <li>• Prueba con sinónimos</li>
                <li>• Busca por código de cliente o email</li>
              </ul>
              
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Sugerencias:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 3).map((suggestion, index) => (
                      <Badge 
                        key={index}
                        variant="outline" 
                        className="cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}