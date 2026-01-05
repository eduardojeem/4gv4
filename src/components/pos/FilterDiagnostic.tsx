'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Filter, AlertTriangle, Info, X } from 'lucide-react'
import { 
  detectActiveFilters, 
  calculateFilterStats, 
  generateFilterRecommendations,
  clearAllPOSFilters,
  type POSFilters 
} from '@/lib/pos-filter-utils'

interface FilterDiagnosticProps {
  totalProducts: number
  filteredProducts: number
  currentFilters: Partial<POSFilters>
  onClearFilters: () => void
  className?: string
}

export function FilterDiagnostic({
  totalProducts,
  filteredProducts,
  currentFilters,
  onClearFilters,
  className = ''
}: FilterDiagnosticProps) {
  const activeFilters = detectActiveFilters(currentFilters)
  const stats = calculateFilterStats(totalProducts, filteredProducts)
  const recommendations = generateFilterRecommendations(stats, activeFilters)
  
  const hasIssues = stats.visibilityPercentage < 80 || activeFilters.length > 2
  
  if (!hasIssues && activeFilters.length === 0) {
    return null // No mostrar si todo está bien
  }
  
  return (
    <Card className={`${className} border-l-4 ${hasIssues ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4" />
          Diagnóstico de Filtros
          {hasIssues && <AlertTriangle className="h-4 w-4 text-orange-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Estadísticas */}
        <div className="flex items-center justify-between text-sm">
          <span>Productos visibles:</span>
          <Badge variant={stats.visibilityPercentage < 50 ? 'destructive' : 'secondary'}>
            {stats.visible} de {stats.total} ({stats.visibilityPercentage}%)
          </Badge>
        </div>
        
        {/* Filtros activos */}
        {activeFilters.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Filtros activos:</p>
            <div className="flex flex-wrap gap-1">
              {activeFilters.map((filter, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {filter}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Recomendaciones */}
        {recommendations.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <ul className="list-disc list-inside space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Botón de limpieza */}
        {(activeFilters.length > 0 || hasIssues) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="w-full"
          >
            <X className="h-3 w-3 mr-2" />
            Limpiar todos los filtros
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
