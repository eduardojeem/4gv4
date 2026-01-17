# Ejemplo de Integración de Mejoras en POS

## Cómo Refactorizar page.tsx

### Paso 1: Importar los nuevos hooks

```typescript
// En src/app/dashboard/pos/page.tsx

// Hooks personalizados
import { usePOSFilters } from './hooks/usePOSFilters'
import { usePOSUI } from './hooks/usePOSUI'
import { useSaleProcessor } from './hooks/useSaleProcessor'
import { usePOSErrorHandler } from './lib/error-handler'

// Validaciones
import { validateSale, validateSaleBusinessRules } from './lib/validation'

// Componentes nuevos
import { ProductFilters } from './components/ProductFilters'
```

### Paso 2: Reemplazar estados con hooks

**ANTES:**
```typescript
export default function POSPage() {
  // 30+ estados individuales
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showFeatured, setShowFeatured] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 1000000 })
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(24)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // ... más estados
  
  // Lógica de filtrado manual
  const filteredProducts = useMemo(() => {
    // 50+ líneas de lógica de filtrado
  }, [/* muchas dependencias */])
  
  // Lógica de paginación manual
  const paginatedProducts = useMemo(() => {
    // Lógica de paginación
  }, [filteredProducts, currentPage, itemsPerPage])
}
```

**DESPUÉS:**
```typescript
export default function POSPage() {
  // Hooks consolidados
  const filters = usePOSFilters(inventoryProducts)
  const ui = usePOSUI()
  const { handleError } = usePOSErrorHandler()
  const { processSale } = useSaleProcessor({
    onSuccess: handleSaleSuccess,
    onError: handleSaleError
  })
  
  // Productos ya filtrados y paginados
  const products = filters.paginatedProducts
  
  // Estados de UI consolidados
  const { state: uiState, actions: uiActions } = ui
  const { state: filterState, actions: filterActions } = filters
}
```

### Paso 3: Usar el componente ProductFilters

**ANTES:**
```typescript
// 100+ líneas de JSX para filtros
<div className="space-y-4">
  <div className="relative">
    <Search className="..." />
    <Input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      // ...
    />
  </div>
  
  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
    {/* ... */}
  </Select>
  
  {/* Muchos más controles */}
</div>
```

**DESPUÉS:**
```typescript
// Una sola línea
<ProductFilters
  state={filters.state}
  actions={filters.actions}
  categories={filters.categories}
  priceRangeLimits={filters.priceRangeLimits}
  totalResults={filters.filteredProducts.length}
/>
```

### Paso 4: Procesar ventas con validación

**ANTES:**
```typescript
const processSale = useCallback(async () => {
  setPaymentStatus('processing')
  setPaymentError('')
  
  try {
    // Validaciones manuales dispersas
    if (!isRegisterOpen) {
      toast.error('La caja debe estar abierta')
      return
    }
    
    if (cart.length === 0) {
      toast.error('El carrito está vacío')
      return
    }
    
    // Más validaciones...
    
    // Lógica de persistencia
    const supabase = createSupabaseClient()
    // 100+ líneas de lógica de venta
    
    setPaymentStatus('success')
    toast.success('Venta exitosa')
  } catch (error) {
    setPaymentStatus('failed')
    // Manejo de error manual
    const msg = error?.message || 'Error desconocido'
    setPaymentError(msg)
    toast.error(msg)
  }
}, [/* muchas dependencias */])
```

**DESPUÉS:**
```typescript
const handleSale = useCallback(async () => {
  try {
    // Validación automática incluida
    await processSale(
      cart,
      cartCalculations.total,
      cartCalculations.tax,
      cartCalculations.subtotal,
      selectedRepairIds,
      markRepairDelivered,
      finalCostFromSale
    )
    
    // Éxito manejado automáticamente
    clearCart()
    setIsCheckoutOpen(false)
  } catch (error) {
    // Error manejado automáticamente con mensajes user-friendly
  }
}, [processSale, cart, cartCalculations, selectedRepairIds])
```

### Paso 5: Gestión de UI simplificada

**ANTES:**
```typescript
// Múltiples funciones para modales
const openRegisterDialog = () => setIsOpenRegisterDialogOpen(true)
const closeRegisterDialog = () => {
  setIsOpenRegisterDialogOpen(false)
  setOpeningAmount('0')
  setOpeningNote('')
}

const openMovementDialog = (type: 'in' | 'out') => {
  setMovementType(type)
  setIsMovementDialogOpen(true)
}

const closeMovementDialog = () => {
  setIsMovementDialogOpen(false)
  setMovementAmount('')
  setMovementNote('')
}

// Más funciones...
```

**DESPUÉS:**
```typescript
// Todo en el hook
<Button onClick={uiActions.openRegisterDialog}>
  Abrir Caja
</Button>

<Button onClick={() => uiActions.openMovementDialog('in')}>
  Entrada de Efectivo
</Button>

<Dialog open={uiState.isRegisterManagerOpen} onOpenChange={uiActions.closeRegisterManager}>
  {/* Contenido */}
</Dialog>
```

## Ejemplo Completo de Refactorización

```typescript
'use client'

import React, { useCallback } from 'react'
import { usePOSFilters } from './hooks/usePOSFilters'
import { usePOSUI } from './hooks/usePOSUI'
import { useSaleProcessor } from './hooks/useSaleProcessor'
import { usePOSErrorHandler } from './lib/error-handler'
import { useOptimizedCart } from './hooks/useOptimizedCart'
import { usePOSProducts } from '@/hooks/usePOSProducts'
import { useCashRegisterContext } from './contexts/CashRegisterContext'
import { useCheckout } from './contexts/CheckoutContext'
import { usePOSCustomer } from './contexts/POSCustomerContext'

import { POSHeader } from './components/POSHeader'
import { POSCart } from './components/POSCart'
import { ProductFilters } from './components/ProductFilters'
import { CheckoutModal } from './components/CheckoutModal'
import { ProductCard } from './components/ProductCard'

export default function POSPage() {
  // ============================================
  // HOOKS CONSOLIDADOS
  // ============================================
  
  // Productos del inventario
  const { products: inventoryProducts, loading: productsLoading } = usePOSProducts()
  
  // Filtros y búsqueda
  const filters = usePOSFilters(inventoryProducts)
  
  // Estado de UI
  const ui = usePOSUI()
  
  // Carrito optimizado
  const cart = useOptimizedCart(inventoryProducts, {
    taxRate: 0.19,
    pricesIncludeTax: true
  })
  
  // Contextos
  const cashRegister = useCashRegisterContext()
  const checkout = useCheckout()
  const customer = usePOSCustomer()
  
  // Manejo de errores
  const { handleError } = usePOSErrorHandler()
  
  // Procesamiento de ventas
  const { processSale } = useSaleProcessor({
    onSuccess: (saleId) => {
      cart.clearCart()
      checkout.setIsCheckoutOpen(false)
      checkout.resetCheckoutState()
    },
    onError: (error) => {
      // Error ya manejado por el hook
    }
  })
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleAddToCart = useCallback((product: Product) => {
    cart.addToCart(product)
  }, [cart])
  
  const handleCheckout = useCallback(() => {
    if (cart.cartItemCount === 0) {
      handleError(new Error('El carrito está vacío'), 'validation')
      return
    }
    checkout.setIsCheckoutOpen(true)
  }, [cart.cartItemCount, checkout, handleError])
  
  const handleProcessSale = useCallback(async () => {
    await processSale(
      cart.cart,
      cart.cartTotal,
      cart.cartTax,
      cart.cartSubtotal,
      [], // repairIds
      false, // markRepairDelivered
      false // finalCostFromSale
    )
  }, [processSale, cart])
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <POSHeader
        registers={cashRegister.registers}
        activeRegisterId={cashRegister.activeRegisterId}
        onRegisterChange={cashRegister.setActiveRegisterId}
        onOpenRegisterManager={ui.actions.openRegisterManager}
        onOpenMovements={() => ui.actions.openMovementDialog('out')}
        onOpenRegister={ui.actions.openRegisterDialog}
        isRegisterOpen={cashRegister.getCurrentRegister.isOpen}
        isFullscreen={ui.state.isFullscreen}
        onToggleFullscreen={ui.actions.toggleFullscreen}
        onOpenCart={ui.actions.toggleCartDialog}
        cartItemCount={cart.cartItemCount}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de filtros */}
        <aside className={`w-80 border-r p-4 overflow-y-auto ${ui.state.sidebarCollapsed ? 'hidden' : ''}`}>
          <ProductFilters
            state={filters.state}
            actions={filters.actions}
            categories={filters.categories}
            priceRangeLimits={filters.priceRangeLimits}
            totalResults={filters.filteredProducts.length}
          />
        </aside>
        
        {/* Grid de productos */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className={`grid gap-4 ${
            filters.state.viewMode === 'grid' 
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {filters.paginatedProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                viewMode={filters.state.viewMode}
              />
            ))}
          </div>
          
          {/* Paginación */}
          <div className="mt-4 flex justify-center gap-2">
            <Button
              disabled={filters.state.currentPage === 1}
              onClick={() => filters.actions.setCurrentPage(filters.state.currentPage - 1)}
            >
              Anterior
            </Button>
            <span className="flex items-center px-4">
              Página {filters.state.currentPage} de {filters.totalPages}
            </span>
            <Button
              disabled={filters.state.currentPage === filters.totalPages}
              onClick={() => filters.actions.setCurrentPage(filters.state.currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </main>
        
        {/* Carrito */}
        <aside className="w-96 border-l">
          <POSCart
            items={cart.cart}
            onUpdateQuantity={cart.updateQuantity}
            onRemoveItem={cart.removeFromCart}
            onCheckout={handleCheckout}
            onClearCart={cart.clearCart}
            isWholesale={cart.isWholesale}
            onToggleWholesale={cart.setIsWholesale}
            discount={cart.discount}
            onUpdateDiscount={cart.setDiscount}
            subtotalApplied={cart.subtotalApplied}
            subtotalNonWholesale={cart.subtotalNonWholesale}
            generalDiscountAmount={cart.generalDiscountAmount}
            wholesaleDiscountAmount={cart.wholesaleDiscountAmount}
            totalSavings={cart.totalSavings}
            cartTax={cart.cartTax}
            cartTotal={cart.cartTotal}
            cartItemCount={cart.cartItemCount}
          />
        </aside>
      </div>
      
      {/* Modal de Checkout */}
      <CheckoutModal
        selectedRepairIds={[]}
        setSelectedRepairIds={() => {}}
        customerRepairs={[]}
        markRepairDelivered={false}
        setMarkRepairDelivered={() => {}}
        finalCostFromSale={false}
        setFinalCostFromSale={() => {}}
        selectedRepairs={[]}
        supabaseStatusToLabel={{}}
        cart={cart.cart}
        cartCalculations={{
          subtotal: cart.cartSubtotal,
          subtotalAfterAllDiscounts: cart.subtotalApplied,
          generalDiscount: cart.discount,
          wholesaleDiscount: cart.wholesaleDiscountAmount,
          wholesaleDiscountRate: 10,
          tax: cart.cartTax,
          total: cart.cartTotal,
          change: 0,
          remaining: 0
        }}
        isWholesale={cart.isWholesale}
        WHOLESALE_DISCOUNT_RATE={10}
        processSale={handleProcessSale}
        processMixedPayment={handleProcessSale}
        formatCurrency={(amount) => `$${amount.toFixed(2)}`}
        isRegisterOpen={cashRegister.getCurrentRegister.isOpen}
        onOpenRegister={ui.actions.openRegisterDialog}
        onCancel={() => checkout.setIsCheckoutOpen(false)}
      />
    </div>
  )
}
```

## Beneficios de la Refactorización

### Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| Líneas de código | ~2726 | ~1800 |
| Estados locales | 30+ | ~10 |
| Lógica de filtrado | En componente | En hook |
| Validaciones | Dispersas | Centralizadas |
| Manejo de errores | Manual | Automático |
| Testabilidad | Difícil | Fácil |
| Reutilización | Baja | Alta |

### Ventajas Específicas

1. **Mantenibilidad**: Código más limpio y organizado
2. **Testabilidad**: Hooks pueden testearse independientemente
3. **Reutilización**: Lógica compartible entre componentes
4. **Performance**: Memoización optimizada
5. **Type Safety**: Validación con Zod
6. **UX**: Mensajes de error consistentes y amigables
7. **Debugging**: Logging estructurado
8. **Escalabilidad**: Fácil agregar nuevas funcionalidades

## Próximos Pasos

1. Migrar gradualmente el código existente
2. Agregar tests para los hooks
3. Documentar con JSDoc
4. Crear más componentes reutilizables
5. Implementar modo offline
