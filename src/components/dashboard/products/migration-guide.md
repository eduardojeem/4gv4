# Guía de Migración: Componentes de Productos

## 🎯 Objetivos de la Migración

### **Problemas Actuales**
- Componentes desorganizados en `/dashboard/`
- Imports largos y confusos
- Falta de documentación
- Código duplicado
- Dificultad para mantener y escalar

### **Beneficios Esperados**
- ✅ Estructura clara y organizada
- ✅ Imports limpios y consistentes
- ✅ Documentación completa
- ✅ Mejor mantenibilidad
- ✅ Mayor reutilización
- ✅ Performance optimizada

## 📋 Plan de Migración

### **Fase 1: Preparación (1-2 días)**

#### **1.1 Crear Estructura de Carpetas**
```bash
mkdir -p src/components/dashboard/products/{
  core,
  forms,
  filters,
  stats,
  alerts,
  shared,
  hooks,
  utils,
  types
}
```

#### **1.2 Configurar Archivos Base**
```typescript
// src/components/dashboard/products/types/index.ts
export * from './product.types'
export * from './ui.types'
export * from './filter.types'

// src/components/dashboard/products/utils/index.ts
export * from './formatters'
export * from './validators'
export * from './constants'
```

#### **1.3 Instalar Dependencias Adicionales**
```bash
npm install --save-dev @types/lodash-es clsx tailwind-merge
```

### **Fase 2: Migración de Componentes Core (3-4 días)**

#### **2.1 Migrar ProductCard**
```typescript
// Antes
import ProductCard from '@/components/dashboard/product-card'

// Después
import { ProductCard } from '@/components/dashboard/products'
```

**Pasos:**
1. Copiar `product-card.tsx` → `core/ProductCard.tsx`
2. Actualizar tipos usando `ProductCardProps`
3. Agregar JSDoc documentation
4. Crear archivo de stories para Storybook

#### **2.2 Migrar EnhancedProductList**
```typescript
// Antes
import EnhancedProductList from '@/components/dashboard/enhanced-product-list'

// Después
import { ProductList } from '@/components/dashboard/products'
```

**Refactorización necesaria:**
- Separar en componentes más pequeños
- Implementar compound component pattern
- Mejorar tipos TypeScript

#### **2.3 Migrar ProductTable**
```typescript
// Antes
import ProductTable from '@/components/dashboard/product-table'

// Después
import { ProductTable } from '@/components/dashboard/products'
```

### **Fase 3: Migración de Formularios (2-3 días)**

#### **3.1 Migrar ProductModal**
```typescript
// Antes
import { ProductModal } from '@/components/dashboard/product-modal'

// Después
import { ProductModal } from '@/components/dashboard/products'
```

#### **3.2 Migrar ProductForm**
```typescript
// Antes
import { ProductForm } from '@/components/dashboard/product-form'

// Después
import { ProductForm } from '@/components/dashboard/products'
```

### **Fase 4: Migración de Utilidades (1-2 días)**

#### **4.1 Crear Utilidades Centralizadas**
```typescript
// src/components/dashboard/products/utils/formatters.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(amount)
}

export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
```

#### **4.2 Migrar Hooks Personalizados**
```typescript
// src/components/dashboard/products/hooks/useProductFilters.ts
export function useProductFilters() {
  // Lógica de filtros
}
```

### **Fase 5: Testing y Documentación (2-3 días)**

#### **5.1 Crear Tests**
```typescript
// src/components/dashboard/products/core/ProductCard.test.tsx
import { render, screen } from '@testing-library/react'
import { ProductCard } from './ProductCard'

describe('ProductCard', () => {
  it('renders product information correctly', () => {
    // Test implementation
  })
})
```

#### **5.2 Crear Stories para Storybook**
```typescript
// src/components/dashboard/products/core/ProductCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ProductCard } from './ProductCard'

const meta: Meta<typeof ProductCard> = {
  title: 'Products/ProductCard',
  component: ProductCard,
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    product: mockProduct,
  },
}
```

#### **5.3 Actualizar Documentación**
- Actualizar README.md
- Crear guias de uso
- Documentar APIs

### **Fase 6: Optimización y Limpieza (1-2 días)**

#### **6.1 Implementar Optimizaciones**
```typescript
// Lazy loading
const ProductModal = lazy(() => import('./forms/ProductModal'))

// Memoización
const ProductCard = memo(function ProductCard(props) {
  // ...
})
```

#### **6.2 Limpiar Código Legacy**
- Remover archivos antiguos
- Actualizar todos los imports
- Verificar que no queden referencias

## 🔄 Estrategia de Deployment

### **Branch Strategy**
```bash
# Crear branch de feature
git checkout -b feature/product-components-refactor

# Commits por fase
git commit -m "feat: create product components structure"
git commit -m "feat: migrate core components"
git commit -m "feat: migrate forms and modals"
git commit -m "feat: add utilities and hooks"
git commit -m "feat: add tests and documentation"
git commit -m "feat: optimize and cleanup"
```

### **Testing Strategy**
```bash
# Ejecutar tests por fase
npm run test:unit -- --testPathPattern="components/dashboard/products"
npm run test:integration -- --testPathPattern="products"
npm run test:e2e -- --spec="products/**/*.cy.ts"
```

### **Rollback Plan**
```bash
# Si algo sale mal, revertir cambios
git revert HEAD~6..HEAD
git push origin feature/product-components-refactor
```

## 📊 Checklist de Migración

### **Pre-Migración**
- [ ] Backup del código actual
- [ ] Crear branch de feature
- [ ] Configurar entorno de desarrollo
- [ ] Ejecutar tests existentes

### **Durante la Migración**
- [ ] Crear estructura de carpetas
- [ ] Migrar componentes por dominio
- [ ] Actualizar imports progresivamente
- [ ] Mantener compatibilidad hacia atrás
- [ ] Ejecutar tests después de cada cambio

### **Post-Migración**
- [ ] Verificar que todos los imports funcionan
- [ ] Ejecutar suite completa de tests
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Code review
- [ ] Merge a main branch

## 🚨 Riesgos y Mitigaciones

### **Riesgo: Imports Rotos**
**Mitigación:**
- Usar barrel exports desde el inicio
- Actualizar imports de forma incremental
- Mantener compatibilidad hacia atrás temporalmente

### **Riesgo: Pérdida de Funcionalidad**
**Mitigación:**
- Tests exhaustivos antes y después
- Code review detallado
- Deployment gradual con feature flags

### **Riesgo: Performance Degradation**
**Mitigación:**
- Medir performance antes y después
- Implementar lazy loading
- Optimizar re-renders

## 📈 Métricas de Éxito

### **Cuantitativas**
- ✅ **Tiempo de Build**: < 10% de aumento
- ✅ **Bundle Size**: < 5% de aumento
- ✅ **Test Coverage**: > 85%
- ✅ **Performance Score**: > 90

### **Cualitativas**
- ✅ **Developer Experience**: Imports más limpios
- ✅ **Maintainability**: Código más organizado
- ✅ **Reusability**: Componentes más reutilizables
- ✅ **Documentation**: Documentación completa

## 🆘 Plan de Contingencia

### **Si la Migración Falla**
1. **Revert inmediato**: `git revert` de todos los cambios
2. **Análisis post-mortem**: Identificar qué salió mal
3. **Re-planificación**: Ajustar estrategia basada en lecciones aprendidas
4. **Migración incremental**: Migrar componente por componente

### **Contactos de Emergencia**
- **Tech Lead**: Para decisiones técnicas críticas
- **DevOps**: Para problemas de deployment
- **QA**: Para validación de funcionalidad

## 📚 Recursos Adicionales

- [Documentación de Arquitectura](./architecture.md)
- [Guía de Estilo](../STYLE_GUIDE.md)
- [Patrones de Diseño](../DESIGN_PATTERNS.md)
- [Testing Strategy](../TESTING_STRATEGY.md)