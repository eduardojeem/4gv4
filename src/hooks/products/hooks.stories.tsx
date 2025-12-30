import type { Meta, StoryObj } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { useState } from 'react'
import { 
  useProductManagement,
  useProductFiltering,
  useProductAnalytics,
  useProductOperations,
  useProductSearch
} from './index'

// Componente de demostración para useProductManagement
const ProductManagementDemo = () => {
  const {
    products,
    loading,
    error,
    totalCount,
    selectedProducts,
    sortConfig,
    pagination,
    selectProduct,
    selectAllProducts,
    clearSelection,
    setSortConfig,
    setPagination,
    refreshProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkDelete,
    bulkUpdate
  } = useProductManagement()

  return (
    <div className="space-y-6 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">useProductManagement Demo</h3>
      
      {/* Estado */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted p-3 rounded">
          <p className="text-sm font-medium">Productos</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-sm font-medium">Seleccionados</p>
          <p className="text-2xl font-bold">{selectedProducts.length}</p>
        </div>
        <div className="bg-muted p-3 rounded">
          <p className="text-sm font-medium">Total</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={refreshProducts}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <button 
          onClick={selectAllProducts}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm"
        >
          Seleccionar Todos
        </button>
        <button 
          onClick={clearSelection}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Limpiar Selección
        </button>
        <button 
          onClick={() => bulkDelete(selectedProducts)}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          disabled={selectedProducts.length === 0}
        >
          Eliminar Seleccionados
        </button>
      </div>

      {/* Estado de carga/error */}
      {loading && <p className="text-blue-600">Cargando productos...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {/* Lista de productos */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {products.map(product => (
          <div 
            key={product.id}
            className={`p-3 border rounded cursor-pointer ${
              selectedProducts.includes(product.id) ? 'bg-blue-50 border-blue-300' : ''
            }`}
            onClick={() => selectProduct(product.id)}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{product.sku}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">${product.sale_price}</p>
                <p className="text-sm text-muted-foreground">Stock: {product.stock_quantity}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente de demostración para useProductFiltering
const ProductFilteringDemo = () => {
  const {
    filters,
    activePreset,
    availableCategories,
    availableSuppliers,
    priceRange,
    stockRange,
    marginRange,
    updateFilters,
    setPreset,
    clearFilters,
    exportFilters,
    importFilters
  } = useProductFiltering()

  return (
    <div className="space-y-6 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">useProductFiltering Demo</h3>
      
      {/* Búsqueda */}
      <div>
        <label className="block text-sm font-medium mb-2">Búsqueda</label>
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => updateFilters({ search: e.target.value })}
          placeholder="Buscar productos..."
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Presets */}
      <div>
        <label className="block text-sm font-medium mb-2">Filtros Rápidos</label>
        <div className="flex flex-wrap gap-2">
          {['all', 'low_stock', 'out_of_stock', 'best_sellers', 'new_products', 'high_margin'].map(preset => (
            <button
              key={preset}
              onClick={() => setPreset(preset as any)}
              className={`px-3 py-1 rounded text-sm ${
                activePreset === preset 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {preset.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Rangos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Rango de Precio</label>
          <div className="space-y-2">
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={filters.priceRange?.min || priceRange.min}
              onChange={(e) => updateFilters({
                priceRange: { ...filters.priceRange, min: Number(e.target.value) }
              })}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              ${filters.priceRange?.min || priceRange.min} - ${filters.priceRange?.max || priceRange.max}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Rango de Stock</label>
          <div className="space-y-2">
            <input
              type="range"
              min={stockRange.min}
              max={stockRange.max}
              value={filters.stockRange?.min || stockRange.min}
              onChange={(e) => updateFilters({
                stockRange: { ...filters.stockRange, min: Number(e.target.value) }
              })}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              {filters.stockRange?.min || stockRange.min} - {filters.stockRange?.max || stockRange.max}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Rango de Margen</label>
          <div className="space-y-2">
            <input
              type="range"
              min={marginRange.min}
              max={marginRange.max}
              value={filters.marginRange?.min || marginRange.min}
              onChange={(e) => updateFilters({
                marginRange: { ...filters.marginRange, min: Number(e.target.value) }
              })}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              {filters.marginRange?.min || marginRange.min}% - {filters.marginRange?.max || marginRange.max}%
            </p>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex gap-2">
        <button 
          onClick={clearFilters}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Limpiar Filtros
        </button>
        <button 
          onClick={exportFilters}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Exportar Configuración
        </button>
      </div>

      {/* Estado actual */}
      <div className="bg-muted p-3 rounded">
        <p className="text-sm font-medium mb-2">Filtros Activos:</p>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(filters, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// Componente de demostración para useProductAnalytics
const ProductAnalyticsDemo = () => {
  const {
    dashboardStats,
    trends,
    categoryAnalysis,
    supplierAnalysis,
    inventoryAlerts,
    loading,
    error,
    timeRange,
    setTimeRange,
    refreshAnalytics,
    exportAnalytics
  } = useProductAnalytics()

  return (
    <div className="space-y-6 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">useProductAnalytics Demo</h3>
      
      {/* Controles */}
      <div className="flex gap-2">
        {['7d', '30d', '90d', '1y'].map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range as any)}
            className={`px-3 py-1 rounded text-sm ${
              timeRange === range 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {range}
          </button>
        ))}
        <button 
          onClick={refreshAnalytics}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <button 
          onClick={exportAnalytics}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Exportar
        </button>
      </div>

      {/* Métricas principales */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted p-3 rounded">
            <p className="text-sm font-medium">Total Productos</p>
            <p className="text-2xl font-bold">{dashboardStats.totalProducts}</p>
          </div>
          <div className="bg-muted p-3 rounded">
            <p className="text-sm font-medium">Valor Inventario</p>
            <p className="text-2xl font-bold">${dashboardStats.totalValue?.toLocaleString()}</p>
          </div>
          <div className="bg-muted p-3 rounded">
            <p className="text-sm font-medium">Stock Bajo</p>
            <p className="text-2xl font-bold text-yellow-600">{dashboardStats.lowStockCount}</p>
          </div>
          <div className="bg-muted p-3 rounded">
            <p className="text-sm font-medium">Agotados</p>
            <p className="text-2xl font-bold text-red-600">{dashboardStats.outOfStockCount}</p>
          </div>
        </div>
      )}

      {/* Alertas */}
      {inventoryAlerts.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Alertas de Inventario</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {inventoryAlerts.map((alert, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <span className="text-yellow-600">⚠️</span>
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado */}
      {loading && <p className="text-blue-600">Cargando análisis...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
    </div>
  )
}

const meta: Meta = {
  title: 'Products/Hooks/Compound Hooks',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Hooks Compuestos de Productos

Esta colección de stories demuestra el uso de los hooks compuestos para la gestión de productos. Estos hooks combinan múltiples funcionalidades relacionadas en una sola interfaz cohesiva.

## Hooks disponibles:

### useProductManagement
Gestión completa de productos incluyendo CRUD, selección, ordenamiento y paginación.

### useProductFiltering  
Filtrado avanzado con búsqueda, presets, rangos y persistencia de estado.

### useProductAnalytics
Análisis y métricas de productos con tendencias, categorías y alertas.

### useProductOperations
Operaciones masivas como importación, exportación y sincronización.

### useProductSearch
Búsqueda avanzada con múltiples algoritmos y sugerencias.

## Beneficios de los hooks compuestos:
- **Reutilización**: Lógica compartida entre componentes
- **Consistencia**: Comportamiento uniforme en toda la aplicación  
- **Mantenibilidad**: Centralización de la lógica de negocio
- **Testabilidad**: Fácil testing de la lógica aislada
- **Performance**: Optimizaciones centralizadas
        `
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const ProductManagement: Story = {
  render: () => <ProductManagementDemo />,
  parameters: {
    docs: {
      description: {
        story: `
### useProductManagement

Este hook proporciona gestión completa de productos incluyendo:

- **CRUD Operations**: Crear, leer, actualizar y eliminar productos
- **Selección múltiple**: Seleccionar productos individuales o todos
- **Ordenamiento**: Ordenar por diferentes campos
- **Paginación**: Navegación por páginas de productos
- **Operaciones masivas**: Acciones en lote sobre productos seleccionados
- **Estado de carga**: Manejo de estados de loading y error

**Funciones principales:**
- \`selectProduct(id)\`: Seleccionar/deseleccionar producto
- \`selectAllProducts()\`: Seleccionar todos los productos
- \`clearSelection()\`: Limpiar selección
- \`setSortConfig()\`: Configurar ordenamiento
- \`refreshProducts()\`: Actualizar lista de productos
- \`bulkDelete()\`: Eliminar productos en lote
        `
      }
    }
  }
}

export const ProductFiltering: Story = {
  render: () => <ProductFilteringDemo />,
  parameters: {
    docs: {
      description: {
        story: `
### useProductFiltering

Este hook maneja el filtrado avanzado de productos:

- **Búsqueda con debounce**: Búsqueda optimizada en tiempo real
- **Filtros preestablecidos**: Filtros rápidos predefinidos
- **Rangos dinámicos**: Filtros por precio, stock y margen
- **Filtros por categoría/proveedor**: Selección múltiple
- **Persistencia**: Los filtros se mantienen durante la sesión
- **Exportación/Importación**: Guardar y cargar configuraciones

**Presets disponibles:**
- \`all\`: Todos los productos
- \`low_stock\`: Productos con stock bajo
- \`out_of_stock\`: Productos agotados
- \`best_sellers\`: Productos más vendidos
- \`new_products\`: Productos nuevos
- \`high_margin\`: Productos con alto margen
        `
      }
    }
  }
}

export const ProductAnalytics: Story = {
  render: () => <ProductAnalyticsDemo />,
  parameters: {
    docs: {
      description: {
        story: `
### useProductAnalytics

Este hook proporciona análisis completo de productos:

- **Métricas del dashboard**: KPIs principales del inventario
- **Análisis de tendencias**: Evolución temporal de métricas
- **Análisis por categoría**: Distribución y rendimiento por categoría
- **Análisis por proveedor**: Rendimiento por proveedor
- **Alertas de inventario**: Notificaciones importantes
- **Rangos de tiempo**: Análisis por diferentes períodos
- **Exportación**: Descarga de reportes analíticos

**Métricas incluidas:**
- Total de productos activos
- Valor total del inventario
- Productos con stock bajo
- Productos agotados
- Margen promedio
- Rotación de inventario
        `
      }
    }
  }
}

export const AllHooksTogether: Story = {
  render: () => (
    <div className="space-y-8">
      <ProductManagementDemo />
      <ProductFilteringDemo />
      <ProductAnalyticsDemo />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Integración de Hooks Compuestos

Esta story muestra cómo los diferentes hooks compuestos pueden trabajar juntos en una aplicación real:

1. **useProductManagement** maneja la lista principal de productos
2. **useProductFiltering** proporciona capacidades de filtrado
3. **useProductAnalytics** ofrece insights y métricas

Los hooks están diseñados para ser independientes pero complementarios, permitiendo que los componentes usen solo las funcionalidades que necesitan.

**Patrón de uso típico:**
\`\`\`tsx
function ProductDashboard() {
  const management = useProductManagement()
  const filtering = useProductFiltering()
  const analytics = useProductAnalytics()
  
  // Los hooks se pueden usar independientemente
  // o en combinación según las necesidades
}
\`\`\`
        `
      }
    }
  }
}