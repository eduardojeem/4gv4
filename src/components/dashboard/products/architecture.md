# Arquitectura de Componentes de Productos

## 🏗️ Principios de Diseño

### **Separación de Responsabilidades**
Cada componente tiene una responsabilidad única y bien definida:

- **Presentación**: Componentes UI puros
- **Lógica**: Custom hooks
- **Datos**: Servicios y utilidades
- **Estado**: Context providers

### **Composición sobre Herencia**
```tsx
// ✅ Bueno: Composición
<ProductDashboard>
  <ProductFilters />
  <ProductList />
  <ProductStats />
</ProductDashboard>

// ❌ Malo: Herencia
class ProductDashboard extends BaseDashboard {
  // ...
}
```

### **Props Interface Segregation**
```tsx
// ✅ Bueno: Interfaces específicas
interface ProductCardProps {
  product: Product
  onEdit?: (product: Product) => void
  compact?: boolean
}

interface ProductListProps {
  products: Product[]
  loading?: boolean
  onProductSelect?: (product: Product) => void
}

// ❌ Malo: Interface monolítica
interface ProductComponentProps {
  product?: Product
  products?: Product[]
  loading?: boolean
  compact?: boolean
  onEdit?: (product: Product) => void
  onProductSelect?: (product: Product) => void
  // ... muchos props opcionales
}
```

## 📦 Patrón de Barril (Barrel Exports)

### **Estructura de Index Files**
```tsx
// src/components/dashboard/products/index.ts
export { ProductCard } from './core/ProductCard'
export { ProductList } from './core/ProductList'
export { ProductFilters } from './filters/ProductFilters'
export { ProductStats } from './stats/ProductStats'
export type { ProductCardProps, ProductListProps } from './types'
```

### **Beneficios**
- Imports limpios: `import { ProductCard, ProductList } from '@/components/dashboard/products'`
- Tree-shaking automático
- Fácil refactorización
- Documentación centralizada

## 🔄 Patrón de Compound Components

### **Implementación**
```tsx
// ProductList.tsx
interface ProductListComposition {
  Header: typeof ProductListHeader
  Filters: typeof ProductListFilters
  Content: typeof ProductListContent
  Item: typeof ProductListItem
  Pagination: typeof ProductListPagination
}

const ProductList: React.FC<ProductListProps> & ProductListComposition = ({
  children,
  ...props
}) => {
  return (
    <div className="product-list">
      {children}
    </div>
  )
}

ProductList.Header = ProductListHeader
ProductList.Filters = ProductListFilters
ProductList.Content = ProductListContent
ProductList.Item = ProductListItem
ProductList.Pagination = ProductListPagination

export { ProductList }
```

### **Uso**
```tsx
<ProductList products={products}>
  <ProductList.Header title="Mis Productos" />
  <ProductList.Filters />
  <ProductList.Content>
    {products.map(product => (
      <ProductList.Item key={product.id} product={product} />
    ))}
  </ProductList.Content>
  <ProductList.Pagination />
</ProductList>
```

## 🎣 Patrón de Custom Hooks

### **Composición de Hooks**
```tsx
// useProductManagement.ts
export function useProductManagement() {
  const filters = useProductFilters()
  const actions = useProductActions()
  const stats = useProductStats()

  // Lógica de composición
  const filteredProducts = useMemo(() => {
    return applyFilters(products, filters)
  }, [products, filters])

  return {
    // Estado compuesto
    products: filteredProducts,
    loading: filters.loading || actions.loading,

    // Acciones compuestas
    ...filters,
    ...actions,
    ...stats,

    // Acciones específicas del dominio
    exportProducts: () => exportToCSV(filteredProducts),
    bulkUpdate: (updates) => actions.bulkUpdate(filteredProducts, updates)
  }
}
```

### **Ventajas**
- Reutilización de lógica
- Composición flexible
- Testabilidad mejorada
- Separación de responsabilidades

## 🏭 Patrón de Factory Functions

### **Para Componentes Dinámicos**
```tsx
// componentFactory.ts
export function createProductCard(variant: 'default' | 'compact' | 'detailed') {
  switch (variant) {
    case 'compact':
      return ProductCardCompact
    case 'detailed':
      return ProductCardDetailed
    default:
      return ProductCardDefault
  }
}

// Uso
const ProductCard = createProductCard(displayMode)
```

## 📋 Patrón de Render Props

### **Para Lógica Compartida**
```tsx
// ProductDataProvider.tsx
interface ProductDataProviderProps {
  children: (data: ProductData) => React.ReactNode
  productId?: string
}

export function ProductDataProvider({ children, productId }: ProductDataProviderProps) {
  const { product, loading, error } = useProduct(productId)

  if (loading) return <ProductSkeleton />
  if (error) return <ErrorMessage error={error} />

  return <>{children({ product, loading, error })}</>
}

// Uso
<ProductDataProvider productId={id}>
  {({ product }) => (
    <ProductCard product={product} />
  )}
</ProductDataProvider>
```

## 🏗️ Arquitectura de Estado

### **Patrón de Estado Local vs Global**

```tsx
// ✅ Estado local para UI
function ProductFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  // ...
}

// ✅ Estado global para datos
function useProducts() {
  const { products, loading } = useProductStore()
  // ...
}
```

### **Context Pattern para Estado Compartido**
```tsx
// ProductContext.tsx
const ProductContext = createContext<ProductContextValue | null>(null)

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const value = useProductManagement()

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProductContext() {
  const context = useContext(ProductContext)
  if (!context) {
    throw new Error('useProductContext must be used within ProductProvider')
  }
  return context
}
```

## 🧩 Patrón de Higher-Order Components (HOC)

### **Para Funcionalidades Transversales**
```tsx
// withErrorBoundary.tsx
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error }>
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Uso
const ProductCardWithErrorBoundary = withErrorBoundary(ProductCard)
```

## 📊 Optimización de Performance

### **Patrón de Memoización**
```tsx
// ✅ Memoización inteligente
const ProductCard = memo(function ProductCard({
  product,
  onEdit,
  compact = false
}: ProductCardProps) {
  // Solo re-renderiza si cambian las props críticas
  return (
    <div className={cn('product-card', compact && 'compact')}>
      {/* ... */}
    </div>
  )
})

// ✅ Callbacks memoizados
const handleEdit = useCallback((product: Product) => {
  // Lógica de edición
}, []) // Sin dependencias si no cambian
```

### **Lazy Loading Pattern**
```tsx
// ✅ Lazy loading de componentes pesados
const ProductModal = lazy(() => import('./forms/ProductModal'))
const ProductStats = lazy(() => import('./stats/ProductStats'))

// ✅ Suspense boundaries
<Suspense fallback={<ProductModalSkeleton />}>
  <ProductModal product={selectedProduct} />
</Suspense>
```

## 🧪 Patrón de Testing

### **Component Testing**
```tsx
// ProductCard.test.tsx
describe('ProductCard', () => {
  const mockProduct: Product = {
    id: '1',
    name: 'Test Product',
    sku: 'TEST001',
    // ...
  }

  it('renders product information', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('TEST001')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn()
    render(<ProductCard product={mockProduct} onEdit={mockOnEdit} />)

    fireEvent.click(screen.getByRole('button', { name: /editar/i }))

    expect(mockOnEdit).toHaveBeenCalledWith(mockProduct)
  })
})
```

### **Hook Testing**
```tsx
// useProductFilters.test.ts
describe('useProductFilters', () => {
  it('filters products by search term', () => {
    const { result } = renderHook(() => useProductFilters())

    act(() => {
      result.current.setSearchTerm('test')
    })

    expect(result.current.searchTerm).toBe('test')
  })
})
```

## 🚀 Estrategia de Migración

### **Fase 1: Análisis y Planificación**
1. Auditar componentes existentes
2. Identificar dependencias y responsabilidades
3. Crear mapa de migración

### **Fase 2: Creación de Estructura**
1. Crear nueva estructura de carpetas
2. Implementar archivos de índice
3. Configurar barrel exports

### **Fase 3: Migración Incremental**
1. Migrar componentes hoja (sin dependencias)
2. Actualizar imports progresivamente
3. Mantener compatibilidad hacia atrás

### **Fase 4: Optimización**
1. Implementar patrones de optimización
2. Mejorar tipos TypeScript
3. Agregar documentación completa

### **Fase 5: Limpieza**
1. Remover código legacy
2. Actualizar documentación
3. Training del equipo

## 📈 Métricas de Éxito

- **Mantenibilidad**: Tiempo de desarrollo de nuevas features < 30% del tiempo actual
- **Reutilización**: > 80% de componentes reutilizados en múltiples contextos
- **Performance**: Puntaje Lighthouse > 90
- **Calidad**: Cobertura de tests > 85%
- **Developer Experience**: Tiempo de onboarding < 2 días