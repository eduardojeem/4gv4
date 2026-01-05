/**
 * Script para optimizar el sistema de filtrado POS
 * Elimina limitaciones y mejora la experiencia del usuario
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 OPTIMIZANDO SISTEMA DE FILTRADO POS\n')

// 1. Aumentar límite de Smart Search de 20 a 100
console.log('1️⃣ Aumentando límite de Smart Search...')
const smartSearchPath = path.join(__dirname, '../src/app/dashboard/pos/hooks/useSmartSearch.ts')

if (fs.existsSync(smartSearchPath)) {
  let smartSearchContent = fs.readFileSync(smartSearchPath, 'utf8')
  
  // Cambiar maxResults de 20 a 100
  smartSearchContent = smartSearchContent.replace(
    'maxResults = 20',
    'maxResults = 100'
  )
  
  fs.writeFileSync(smartSearchPath, smartSearchContent)
  console.log('   ✅ Smart Search: maxResults cambiado de 20 a 100')
} else {
  console.log('   ⚠️  Archivo useSmartSearch.ts no encontrado')
}

// 2. Aumentar límite de precio por defecto
console.log('\n2️⃣ Optimizando rango de precios por defecto...')
const posPagePath = path.join(__dirname, '../src/app/dashboard/pos/page.tsx')

if (fs.existsSync(posPagePath)) {
  let posContent = fs.readFileSync(posPagePath, 'utf8')
  
  // Cambiar rango de precios por defecto de 10000 a 1000000
  posContent = posContent.replace(
    'const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 10000 })',
    'const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 1000000 })'
  )
  
  fs.writeFileSync(posPagePath, posContent)
  console.log('   ✅ Rango de precios: máximo cambiado de 10,000 a 1,000,000')
} else {
  console.log('   ⚠️  Archivo page.tsx no encontrado')
}

// 3. Aumentar límite de productos cargados en usePOSProducts
console.log('\n3️⃣ Aumentando límite de productos cargados...')
const usePOSProductsPath = path.join(__dirname, '../src/hooks/usePOSProducts.ts')

if (fs.existsSync(usePOSProductsPath)) {
  let posProductsContent = fs.readFileSync(usePOSProductsPath, 'utf8')
  
  // Cambiar límite de 1000 a 5000
  posProductsContent = posProductsContent.replace(
    '.limit(1000)',
    '.limit(5000)'
  )
  
  fs.writeFileSync(usePOSProductsPath, posProductsContent)
  console.log('   ✅ Límite de carga: cambiado de 1,000 a 5,000 productos')
} else {
  console.log('   ⚠️  Archivo usePOSProducts.ts no encontrado')
}

// 4. Crear función de limpieza de filtros mejorada
console.log('\n4️⃣ Creando utilidad de limpieza de filtros...')
const clearFiltersUtilPath = path.join(__dirname, '../src/lib/pos-filter-utils.ts')

const clearFiltersUtilContent = `/**
 * Utilidades para gestión de filtros POS
 */

export interface POSFilters {
  searchTerm: string
  selectedCategory: string
  showFeatured: boolean
  stockFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  priceRange: { min: number; max: number }
  sortBy: 'name' | 'price' | 'stock' | 'category'
  sortOrder: 'asc' | 'desc'
  itemsPerPage: number
  currentPage: number
}

export const DEFAULT_POS_FILTERS: POSFilters = {
  searchTerm: '',
  selectedCategory: 'all',
  showFeatured: false,
  stockFilter: 'all',
  priceRange: { min: 0, max: 1000000 }, // Rango amplio por defecto
  sortBy: 'name',
  sortOrder: 'asc',
  itemsPerPage: 48, // Más productos por página
  currentPage: 1
}

/**
 * Limpia todos los filtros y restaura valores por defecto
 */
export function clearAllPOSFilters(): POSFilters {
  // Limpiar localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('pos.prefs')
    localStorage.removeItem('pos.cart')
  }
  
  return { ...DEFAULT_POS_FILTERS }
}

/**
 * Detecta si hay filtros activos que puedan estar limitando resultados
 */
export function detectActiveFilters(filters: Partial<POSFilters>): string[] {
  const activeFilters: string[] = []
  
  if (filters.searchTerm && filters.searchTerm.trim() !== '') {
    activeFilters.push(\`Búsqueda: "\${filters.searchTerm}"\`)
  }
  
  if (filters.selectedCategory && filters.selectedCategory !== 'all') {
    activeFilters.push(\`Categoría: \${filters.selectedCategory}\`)
  }
  
  if (filters.showFeatured) {
    activeFilters.push('Solo productos destacados')
  }
  
  if (filters.stockFilter && filters.stockFilter !== 'all') {
    const stockLabels = {
      'in_stock': 'Solo en stock',
      'low_stock': 'Solo stock bajo',
      'out_of_stock': 'Solo sin stock'
    }
    activeFilters.push(\`Stock: \${stockLabels[filters.stockFilter]}\`)
  }
  
  if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000000)) {
    activeFilters.push(\`Precio: \${filters.priceRange.min} - \${filters.priceRange.max}\`)
  }
  
  return activeFilters
}

/**
 * Calcula estadísticas de filtrado
 */
export function calculateFilterStats(totalProducts: number, filteredProducts: number) {
  const filteredCount = filteredProducts
  const hiddenCount = totalProducts - filteredProducts
  const visibilityPercentage = totalProducts > 0 ? Math.round((filteredProducts / totalProducts) * 100) : 0
  
  return {
    total: totalProducts,
    visible: filteredCount,
    hidden: hiddenCount,
    visibilityPercentage
  }
}

/**
 * Genera recomendaciones para mejorar la visibilidad de productos
 */
export function generateFilterRecommendations(
  stats: ReturnType<typeof calculateFilterStats>,
  activeFilters: string[]
): string[] {
  const recommendations: string[] = []
  
  if (stats.visibilityPercentage < 50) {
    recommendations.push('Considera limpiar algunos filtros para ver más productos')
  }
  
  if (activeFilters.length > 2) {
    recommendations.push('Tienes muchos filtros activos, prueba reducirlos')
  }
  
  if (stats.hidden > 20) {
    recommendations.push(\`\${stats.hidden} productos están ocultos por los filtros actuales\`)
  }
  
  if (activeFilters.some(f => f.includes('Precio'))) {
    recommendations.push('Verifica que el rango de precios no sea muy restrictivo')
  }
  
  return recommendations
}
`

fs.writeFileSync(clearFiltersUtilPath, clearFiltersUtilContent)
console.log('   ✅ Utilidad de filtros creada en src/lib/pos-filter-utils.ts')

// 5. Crear componente de diagnóstico de filtros
console.log('\n5️⃣ Creando componente de diagnóstico...')
const filterDiagnosticPath = path.join(__dirname, '../src/components/pos/FilterDiagnostic.tsx')

const filterDiagnosticContent = `'use client'

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
    <Card className={\`\${className} border-l-4 \${hasIssues ? 'border-l-orange-500' : 'border-l-blue-500'}\`}>
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
`

fs.writeFileSync(filterDiagnosticPath, filterDiagnosticContent)
console.log('   ✅ Componente de diagnóstico creado en src/components/pos/FilterDiagnostic.tsx')

console.log('\n✅ OPTIMIZACIÓN COMPLETADA')
console.log('\n📋 CAMBIOS REALIZADOS:')
console.log('   • Smart Search: límite aumentado de 20 a 100 productos')
console.log('   • Rango de precios: máximo aumentado de 10,000 a 1,000,000')
console.log('   • Carga de productos: límite aumentado de 1,000 a 5,000')
console.log('   • Utilidades de filtros: nueva librería para gestión')
console.log('   • Componente de diagnóstico: para detectar problemas de filtrado')

console.log('\n🚀 PRÓXIMOS PASOS:')
console.log('   1. Reiniciar el servidor de desarrollo')
console.log('   2. Limpiar localStorage en el navegador')
console.log('   3. Probar el POS con los nuevos límites')
console.log('   4. Integrar el componente FilterDiagnostic si es necesario')

console.log('\n💡 PARA LIMPIAR FILTROS MANUALMENTE:')
console.log('   • En DevTools Console: localStorage.clear()')
console.log('   • O usar el botón "Limpiar filtros" en la interfaz')