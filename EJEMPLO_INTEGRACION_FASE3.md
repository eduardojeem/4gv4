# 🔧 Ejemplo de Integración - Fase 3

## Integración Completa en page.tsx

Este documento muestra cómo integrar todas las funcionalidades de la Fase 3 en el componente principal del POS.

---

## 📦 Imports

```typescript
// Fase 3 - Modo Offline
import { useOfflineMode } from './hooks/useOfflineMode'
import { offlineManager } from './lib/offline-manager'

// Fase 3 - Analytics
import { usePOSAnalytics } from './hooks/usePOSAnalytics'
import { analyticsEngine } from './lib/analytics-engine'

// Fase 3 - Recomendaciones
import { useSmartSuggestions } from './hooks/useSmartSuggestions'
import { recommendationEngine } from './lib/recommendation-engine'

// Fase 3 - Historial
import { useSearchHistory } from './hooks/useSearchHistory'
import { searchHistory } from './lib/search-history'
```

---

## 🎯 Componente Principal

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useOfflineMode } from './hooks/useOfflineMode'
import { usePOSAnalytics } from './hooks/usePOSAnalytics'
import { useSmartSuggestions } from './hooks/useSmartSuggestions'
import { useSearchHistory } from './hooks/useSearchHistory'

export default function POSPage() {
  // ========================================================================
  // Fase 3 Hooks
  // ========================================================================

  // Modo Offline
  const offline = useOfflineMode()

  // Analytics
  const analytics = usePOSAnalytics()

  // Recomendaciones
  const suggestions = useSmartSuggestions(
    cart.map(item => item.product_id),
    selectedCustomer?.id
  )

  // Historial de búsquedas
  const history = useSearchHistory()

  // ========================================================================
  // Inicialización
  // ========================================================================

  useEffect(() => {
    // Inicializar modo offline
    const initOffline = async () => {
      try {
        await offline.initialize()
        console.log('✅ Modo offline inicializado')

        // Cache inicial de productos
        if (products.length > 0) {
          await offlineManager.cacheProducts(products)
          console.log(`✅ ${products.length} productos en cache`)
        }
      } catch (error) {
        console.error('❌ Error inicializando offline:', error)
      }
    }

    initOffline()
  }, [])

  useEffect(() => {
    // Inicializar metadata de productos para recomendaciones
    if (products.length > 0) {
      recommendationEngine.setProductsMetadata(
        products.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          popularity: 0 // Calcular basado en ventas
        }))
      )
      console.log('✅ Metadata de productos inicializada')
    }
  }, [products])

  // ========================================================================
  // Búsqueda con Historial
  // ========================================================================

  const handleSearch = (query: string) => {
    // Buscar productos
    const results = searchProducts(query)

    // Registrar búsqueda en historial
    history.addSearch(query, results.length)

    return results
  }

  const handleSearchInput = (input: string) => {
    // Obtener sugerencias mientras escribe
    history.getSuggestions(input)
  }

  // ========================================================================
  // Venta con Analytics y Recomendaciones
  // ========================================================================

  const handleCompleteSale = async (saleData: any) => {
    try {
      // 1. Procesar venta
      const sale = await processSale(saleData)

      // 2. Agregar a analytics
      analytics.addSale({
        id: sale.id,
        timestamp: new Date(),
        total: sale.total,
        subtotal: sale.subtotal,
        tax: sale.tax,
        items: sale.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost || 0,
          discount: item.discount || 0,
          category: item.category || 'General'
        })),
        payment_method: sale.payment_method,
        customer_id: sale.customer_id,
        cashier_id: user.id
      })

      // 3. Registrar para recomendaciones
      suggestions.recordPurchase(
        sale.items.map(item => item.product_id),
        sale.customer_id,
        sale.total
      )

      // 4. Si está offline, agregar a cola
      if (!offline.isOnline) {
        await offlineManager.addPendingSale({
          items: sale.items,
          total: sale.total,
          subtotal: sale.subtotal,
          tax: sale.tax,
          payment_method: sale.payment_method,
          customer_id: sale.customer_id,
          created_at: new Date()
        })
      }

      console.log('✅ Venta completada:', sale.id)

      // Limpiar carrito
      clearCart()

      // Mostrar éxito
      toast.success('Venta completada exitosamente')

    } catch (error) {
      console.error('❌ Error en venta:', error)
      toast.error('Error al procesar venta')
    }
  }

  // ========================================================================
  // Agregar Producto al Carrito
  // ========================================================================

  const handleAddToCart = (product: Product) => {
    // Agregar al carrito
    addToCart(product)

    // Registrar producto visto
    history.addRecentProduct(product.id, product.name)

    // Anunciar para accesibilidad
    announce(`${product.name} agregado al carrito`)
  }

  // ========================================================================
  // Sincronización Manual
  // ========================================================================

  const handleManualSync = async () => {
    try {
      const result = await offline.syncNow()

      if (result.success) {
        toast.success(`${result.synced} ventas sincronizadas`)
      } else {
        toast.error(`Error: ${result.failed} ventas fallaron`)
      }
    } catch (error) {
      console.error('Error en sincronización:', error)
      toast.error('Error al sincronizar')
    }
  }

  // ========================================================================
  // UI Components
  // ========================================================================

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-80 border-r">
        {/* Indicador de Estado Offline */}
        <OfflineIndicator
          isOnline={offline.isOnline}
          pendingSales={offline.stats?.pendingSales || 0}
          onSync={handleManualSync}
        />

        {/* Dashboard de Analytics */}
        <AnalyticsDashboard
          todayMetrics={analytics.todayMetrics}
          topProducts={analytics.topProducts}
          alerts={analytics.unacknowledgedAlerts}
        />

        {/* Búsquedas Frecuentes */}
        <FrequentSearches
          searches={history.frequentSearches}
          onSelect={(query) => handleSearch(query)}
        />

        {/* Productos Recientes */}
        <RecentProducts
          products={history.recentProducts}
          onSelect={(productId) => {
            const product = products.find(p => p.id === productId)
            if (product) handleAddToCart(product)
          }}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Products Grid */}
        <div className="flex-1 p-4">
          {/* Search con Sugerencias */}
          <SearchBar
            onSearch={handleSearch}
            onInput={handleSearchInput}
            suggestions={history.suggestions}
          />

          {/* Products */}
          <ProductsGrid
            products={filteredProducts}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Cart Sidebar */}
        <aside className="w-96 border-l p-4">
          {/* Cart Items */}
          <CartItems items={cart} />

          {/* Recomendaciones */}
          {suggestions.recommendations.length > 0 && (
            <RecommendationsPanel
              recommendations={suggestions.recommendations}
              onAddToCart={(productId) => {
                const product = products.find(p => p.id === productId)
                if (product) handleAddToCart(product)
              }}
            />
          )}

          {/* Checkout Button */}
          <Button
            onClick={handleCompleteSale}
            disabled={cart.length === 0}
          >
            Completar Venta
          </Button>
        </aside>
      </main>
    </div>
  )
}
```

---

## 🎨 Componentes UI

### OfflineIndicator

```typescript
interface OfflineIndicatorProps {
  isOnline: boolean
  pendingSales: number
  onSync: () => void
}

function OfflineIndicator({ isOnline, pendingSales, onSync }: OfflineIndicatorProps) {
  return (
    <div className={cn(
      "p-4 border-b",
      isOnline ? "bg-green-50" : "bg-yellow-50"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">En línea</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">Sin conexión</span>
            </>
          )}
        </div>

        {pendingSales > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSync}
            disabled={!isOnline}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sincronizar ({pendingSales})
          </Button>
        )}
      </div>
    </div>
  )
}
```

### AnalyticsDashboard

```typescript
interface AnalyticsDashboardProps {
  todayMetrics: SalesMetrics | null
  topProducts: ProductMetrics[]
  alerts: Alert[]
}

function AnalyticsDashboard({ todayMetrics, topProducts, alerts }: AnalyticsDashboardProps) {
  if (!todayMetrics) return null

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold">Métricas de Hoy</h3>

      {/* Revenue */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ventas</span>
          <span className="text-sm font-medium">
            {formatCurrency(todayMetrics.totalRevenue)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {getTrendIcon(todayMetrics.revenueChange)}
          <span className={cn(
            todayMetrics.revenueChange >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {formatPercentage(todayMetrics.revenueChange)}
          </span>
        </div>
      </div>

      {/* Profit */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ganancia</span>
          <span className="text-sm font-medium">
            {formatCurrency(todayMetrics.totalProfit)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Margen: {todayMetrics.profitMargin.toFixed(1)}%
        </div>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Top Productos</h4>
          {topProducts.slice(0, 3).map(product => (
            <div key={product.product_id} className="flex items-center justify-between text-xs">
              <span className="truncate">{product.product_name}</span>
              <span className="font-medium">{product.quantity_sold}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-yellow-600">Alertas</h4>
          {alerts.slice(0, 3).map(alert => (
            <div key={alert.id} className="text-xs p-2 bg-yellow-50 rounded">
              <div className="font-medium">{alert.title}</div>
              <div className="text-muted-foreground">{alert.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### RecommendationsPanel

```typescript
interface RecommendationsPanelProps {
  recommendations: ProductRecommendation[]
  onAddToCart: (productId: string) => void
}

function RecommendationsPanel({ recommendations, onAddToCart }: RecommendationsPanelProps) {
  return (
    <div className="mt-4 p-4 border rounded-lg bg-blue-50">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Sugerencias
      </h3>

      <div className="space-y-2">
        {recommendations.map(rec => (
          <div
            key={rec.product_id}
            className="flex items-center justify-between p-2 bg-white rounded"
          >
            <div className="flex-1">
              <div className="text-sm font-medium">{rec.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {getReasonText(rec.reason)}
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAddToCart(rec.product_id)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function getReasonText(reason: RecommendationReason): string {
  const reasons = {
    frequently_bought_together: 'Comprados juntos',
    similar_category: 'Categoría similar',
    trending: 'Tendencia',
    customer_history: 'Historial del cliente',
    upsell: 'Mejor opción',
    cross_sell: 'Complemento'
  }
  return reasons[reason] || reason
}
```

### FrequentSearches

```typescript
interface FrequentSearchesProps {
  searches: FrequentSearch[]
  onSelect: (query: string) => void
}

function FrequentSearches({ searches, onSelect }: FrequentSearchesProps) {
  if (searches.length === 0) return null

  return (
    <div className="p-4 border-t">
      <h3 className="text-sm font-semibold mb-2">Búsquedas Frecuentes</h3>
      <div className="flex flex-wrap gap-2">
        {searches.slice(0, 5).map(search => (
          <Button
            key={search.query}
            size="sm"
            variant="outline"
            onClick={() => onSelect(search.query)}
          >
            {search.query}
            <span className="ml-1 text-xs text-muted-foreground">
              ({search.count})
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
```

### RecentProducts

```typescript
interface RecentProductsProps {
  products: RecentProduct[]
  onSelect: (productId: string) => void
}

function RecentProducts({ products, onSelect }: RecentProductsProps) {
  if (products.length === 0) return null

  return (
    <div className="p-4 border-t">
      <h3 className="text-sm font-semibold mb-2">Vistos Recientemente</h3>
      <div className="space-y-1">
        {products.slice(0, 5).map(product => (
          <button
            key={product.product_id}
            onClick={() => onSelect(product.product_id)}
            className="w-full text-left text-sm p-2 hover:bg-gray-50 rounded"
          >
            {product.product_name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

## 🔄 Flujo Completo de Venta

```typescript
async function completeSaleFlow() {
  // 1. Validar carrito
  if (cart.length === 0) {
    toast.error('El carrito está vacío')
    return
  }

  // 2. Calcular totales
  const subtotal = calculateSubtotal(cart)
  const tax = calculateTax(subtotal)
  const total = subtotal + tax

  // 3. Procesar venta
  const saleData = {
    items: cart,
    subtotal,
    tax,
    total,
    payment_method: selectedPaymentMethod,
    customer_id: selectedCustomer?.id,
    cashier_id: user.id
  }

  try {
    // 4. Guardar en base de datos (o cola si offline)
    let saleId: string

    if (offline.isOnline) {
      // Online: guardar directamente
      const { data, error } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single()

      if (error) throw error
      saleId = data.id
    } else {
      // Offline: agregar a cola
      saleId = await offlineManager.addPendingSale(saleData)
      toast.info('Venta guardada para sincronizar')
    }

    // 5. Agregar a analytics
    analytics.addSale({
      id: saleId,
      timestamp: new Date(),
      ...saleData,
      items: cart.map(item => ({
        ...item,
        cost: item.cost || 0,
        category: item.category || 'General'
      }))
    })

    // 6. Registrar para recomendaciones
    suggestions.recordPurchase(
      cart.map(item => item.product_id),
      selectedCustomer?.id,
      total
    )

    // 7. Actualizar inventario
    await updateInventory(cart)

    // 8. Limpiar carrito
    clearCart()

    // 9. Imprimir ticket
    if (shouldPrintTicket) {
      await printTicket(saleId)
    }

    // 10. Mostrar éxito
    toast.success('Venta completada exitosamente')

    // 11. Refresh stats
    await offline.refreshStats()
    analytics.refreshMetrics()

  } catch (error) {
    console.error('Error en venta:', error)
    toast.error('Error al procesar venta')
  }
}
```

---

## 📊 Monitoreo y Debugging

```typescript
// Agregar en useEffect para debugging
useEffect(() => {
  // Log de estado offline
  console.log('Offline Status:', {
    isOnline: offline.isOnline,
    pendingSales: offline.stats?.pendingSales,
    cachedProducts: offline.stats?.cachedProducts,
    storageUsed: formatStorageSize(offline.stats?.storageUsed || 0)
  })

  // Log de analytics
  console.log('Analytics:', {
    todayRevenue: analytics.todayMetrics?.totalRevenue,
    todayProfit: analytics.todayMetrics?.totalProfit,
    topProduct: analytics.topProducts[0]?.product_name,
    alerts: analytics.unacknowledgedAlerts.length
  })

  // Log de recomendaciones
  console.log('Recommendations:', {
    count: suggestions.recommendations.length,
    stats: suggestions.stats
  })

  // Log de historial
  console.log('Search History:', {
    recentSearches: history.recentSearches.length,
    frequentSearches: history.frequentSearches.length,
    recentProducts: history.recentProducts.length,
    stats: history.stats
  })
}, [offline, analytics, suggestions, history])
```

---

## 🎯 Checklist de Integración

- [ ] Importar todos los hooks de Fase 3
- [ ] Inicializar modo offline en mount
- [ ] Cache inicial de productos
- [ ] Inicializar metadata para recomendaciones
- [ ] Integrar búsqueda con historial
- [ ] Agregar analytics en flujo de venta
- [ ] Registrar compras para recomendaciones
- [ ] Manejar ventas offline
- [ ] Crear componentes UI
- [ ] Agregar indicador de estado
- [ ] Mostrar recomendaciones
- [ ] Mostrar búsquedas frecuentes
- [ ] Agregar sincronización manual
- [ ] Testing completo

---

*Documentación generada: Enero 2026*
*Versión: 3.0.0*
*Estado: Fase 3 - Ejemplo de Integración*

