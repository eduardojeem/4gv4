# Arquitectura de Componentes de Productos

## 📁 Estructura de Carpetas

```
src/components/dashboard/products/
├── core/                    # Componentes núcleo
│   ├── ProductCard.tsx     # Tarjeta individual de producto
│   ├── ProductList.tsx     # Lista de productos
│   ├── ProductTable.tsx    # Tabla de productos
│   └── ProductGrid.tsx     # Grid de productos
├── forms/                  # Formularios y modales
│   ├── ProductForm.tsx     # Formulario de producto
│   ├── ProductModal.tsx    # Modal de edición/creación
│   ├── BulkActions.tsx     # Acciones en lote
│   └── QuickEdit.tsx       # Edición rápida
├── filters/                # Sistema de filtros
│   ├── ProductFilters.tsx  # Filtros principales
│   ├── AdvancedFilters.tsx # Filtros avanzados
│   ├── SearchBar.tsx       # Barra de búsqueda
│   └── FilterChips.tsx     # Chips de filtros activos
├── stats/                  # Estadísticas y métricas
│   ├── ProductStats.tsx    # Estadísticas generales
│   ├── MetricCards.tsx     # Tarjetas de métricas
│   ├── Charts.tsx          # Gráficos
│   └── KPIIndicators.tsx   # Indicadores KPI
├── alerts/                 # Sistema de alertas
│   ├── AlertPanel.tsx      # Panel de alertas
│   ├── StockAlerts.tsx     # Alertas de stock
│   ├── NotificationCenter.tsx # Centro de notificaciones
│   └── AlertBadge.tsx      # Badge de alertas
├── shared/                 # Componentes compartidos
│   ├── ProductSkeleton.tsx # Skeleton loading
│   ├── EmptyState.tsx      # Estado vacío
│   ├── ErrorBoundary.tsx   # Manejo de errores
│   └── LoadingSpinner.tsx  # Spinner de carga
├── hooks/                  # Hooks personalizados
│   ├── useProductFilters.ts
│   ├── useProductActions.ts
│   ├── useProductStats.ts
│   └── useProductAlerts.ts
├── utils/                  # Utilidades
│   ├── formatters.ts       # Formateadores
│   ├── validators.ts       # Validadores
│   ├── constants.ts        # Constantes
│   └── helpers.ts          # Funciones helper
├── types/                  # Tipos TypeScript
│   ├── index.ts           # Re-export de tipos
│   ├── product.types.ts   # Tipos de producto
│   └── ui.types.ts        # Tipos de UI
└── index.ts               # Punto de entrada principal
```

## 🏗️ Arquitectura por Capas

### 1. **Capa de Presentación** (UI Components)
- Componentes puramente visuales
- Props tipadas estrictamente
- Sin lógica de negocio
- Reutilizables y testeables

### 2. **Capa de Lógica** (Custom Hooks)
- Manejo de estado y efectos
- Llamadas a API
- Lógica de negocio
- Composición de hooks

### 3. **Capa de Servicios** (Services)
- Comunicación con APIs
- Manejo de datos externos
- Cache y optimizaciones
- Error handling

### 4. **Capa de Utilidades** (Utils)
- Funciones puras
- Formateadores
- Validadores
- Constantes

## 📋 Patrones de Diseño Implementados

### **Compound Components Pattern**
```tsx
<ProductList>
  <ProductList.Header />
  <ProductList.Filters />
  <ProductList.Content>
    <ProductList.Item />
  </ProductList.Content>
  <ProductList.Pagination />
</ProductList>
```

### **Render Props Pattern**
```tsx
<ProductProvider>
  {({ products, loading, error }) => (
    <ProductList
      products={products}
      loading={loading}
      error={error}
      renderItem={(product) => <ProductCard product={product} />}
    />
  )}
</ProductProvider>
```

### **Custom Hooks Composition**
```tsx
function useProductManagement() {
  const filters = useProductFilters()
  const actions = useProductActions()
  const stats = useProductStats()

  return { filters, actions, stats }
}
```

## 🔧 Convenciones de Nomenclatura

### **Componentes**
- PascalCase: `ProductCard`, `ProductList`
- Prefijos descriptivos: `ProductFilters`, `BulkActions`
- Sufijos para variantes: `ProductCardCompact`, `ProductTableDetailed`

### **Hooks**
- Prefijo `use`: `useProductFilters`, `useProductActions`
- CamelCase: `useProductManagement`

### **Utilidades**
- CamelCase: `formatCurrency`, `validateProduct`
- Prefijos por dominio: `productHelpers`, `filterUtils`

### **Tipos**
- PascalCase con sufijo: `ProductFilters`, `ProductActions`
- Interfaces: `IProduct`, `ProductFormData`
- Uniones: `ProductStatus`, `FilterType`

## 📚 Documentación por Componente

Cada componente debe tener:

### **JSDoc Comments**
```tsx
/**
 * Componente para mostrar una tarjeta de producto
 * @param {ProductCardProps} props - Propiedades del componente
 * @param {Product} props.product - Datos del producto
 * @param {boolean} props.compact - Modo compacto
 * @param {(product: Product) => void} props.onEdit - Callback de edición
 */
export function ProductCard({ product, compact, onEdit }: ProductCardProps) {
  // ...
}
```

### **Prop Types Documentation**
```tsx
interface ProductCardProps {
  /** Datos del producto a mostrar */
  product: Product
  /** Modo de visualización compacta */
  compact?: boolean
  /** Callback cuando se hace clic en editar */
  onEdit?: (product: Product) => void
  /** Clases CSS adicionales */
  className?: string
}
```

### **Storybook Stories**
```tsx
// ProductCard.stories.tsx
export const Default = {
  args: {
    product: mockProduct,
    onEdit: action('onEdit')
  }
}

export const Compact = {
  args: {
    ...Default.args,
    compact: true
  }
}
```

## 🧪 Estrategia de Testing

### **Unit Tests**
```tsx
describe('ProductCard', () => {
  it('renders product information correctly', () => {
    // Test implementation
  })

  it('calls onEdit when edit button is clicked', () => {
    // Test implementation
  })
})
```

### **Integration Tests**
```tsx
describe('ProductList', () => {
  it('filters products correctly', () => {
    // Test implementation
  })

  it('handles loading states', () => {
    // Test implementation
  })
})
```

## 🚀 Guía de Migración

### **Fase 1: Reorganización**
1. Crear nueva estructura de carpetas
2. Mover componentes existentes
3. Actualizar imports

### **Fase 2: Refactorización**
1. Implementar nuevos patrones
2. Mejorar tipos TypeScript
3. Agregar documentación

### **Fase 3: Optimización**
1. Implementar lazy loading
2. Optimizar re-renders
3. Mejorar performance

## 📊 Métricas de Calidad

- **Coverage de Tests**: > 80%
- **Complejidad Ciclomática**: < 10 por función
- **Tamaño de Bundle**: < 200KB para componentes críticos
- **Performance Score**: > 90 en Lighthouse
- **Accessibility Score**: > 95 en Lighthouse

## 🔄 Ciclo de Vida

1. **Desarrollo**: Crear componente siguiendo convenciones
2. **Testing**: Escribir tests unitarios e integración
3. **Review**: Code review y testing manual
4. **Documentación**: Actualizar docs y stories
5. **Release**: Merge a main branch