# Guía de Implementación - Optimización de Inventory

## 🎯 Objetivo
Refactorizar la sección `/dashboard/repairs/inventory` para mejorar rendimiento, mantenibilidad y experiencia de usuario.

## 📋 Pre-requisitos

### 1. Instalar Dependencias
```bash
npm install @tanstack/react-virtual @tanstack/react-table swr xlsx date-fns
```

### 2. Backup del Código Actual
```bash
# Crear rama de backup
git checkout -b backup/inventory-before-refactor
git add .
git commit -m "Backup: Estado actual de inventory antes de refactorización"

# Crear rama de trabajo
git checkout -b feature/inventory-optimization
```

## 🚀 Implementación Paso a Paso

### PASO 1: Consolidar Hooks (30 min)

#### 1.1 Eliminar hook duplicado
```bash
# Renombrar el hook antiguo por si acaso
mv src/hooks/use-inventory.ts src/hooks/use-inventory.ts.backup
```

#### 1.2 Verificar que no se use en otros lugares
```bash
# Buscar referencias
grep -r "use-inventory" src/
```

#### 1.3 Actualizar imports si es necesario
Si encuentras referencias, reemplázalas por `useProductsSupabase`

---

### PASO 2: Crear Context API (45 min)

#### 2.1 Crear archivo de contexto
Ya creado en: `src/app/dashboard/repairs/inventory/context/InventoryContext.tsx`

#### 2.2 Agregar import de useState faltante
```typescript
// En InventoryContext.tsx, línea 2
import { createContext, useContext, useCallback, useMemo, ReactNode, useState } from 'react'
```

#### 2.3 Probar el contexto
```typescript
// En page.tsx temporal
import { InventoryProvider, useInventory } from './context/InventoryContext'

function TestComponent() {
  const { products, loading } = useInventory()
  return <div>Productos: {products.length}</div>
}

export default function Page() {
  return (
    <InventoryProvider>
      <TestComponent />
    </InventoryProvider>
  )
}
```

---

### PASO 3: Crear Componentes Modulares (2 horas)

#### 3.1 InventoryHeader
```typescript
// src/app/dashboard/repairs/inventory/components/InventoryHeader.tsx
"use client"

import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, FileDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useInventory } from '../context/InventoryContext'

export function InventoryHeader() {
  const router = useRouter()
  const { refresh, exportPDF, loading } = useInventory()

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <Button 
          variant="ghost" 
          className="mb-2 pl-0 hover:pl-2 transition-all" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          Inventario y Servicios
        </h1>
        <p className="text-muted-foreground">
          Gestiona repuestos, servicios y movimientos de stock.
        </p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={refresh} 
          size="icon"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="outline" onClick={exportPDF}>
          <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
      </div>
    </div>
  )
}
```

#### 3.2 InventoryStats
```typescript
// src/app/dashboard/repairs/inventory/components/InventoryStats.tsx
"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Wrench, AlertTriangle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'

export function InventoryStats() {
  const { inventory, services } = useInventory()

  const stats = useMemo(() => {
    const totalValue = inventory.reduce(
      (acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || 0)), 
      0
    )
    
    const lowStockCount = inventory.filter(
      p => (p.stock_quantity || 0) <= (p.min_stock || 5)
    ).length

    return {
      totalValue,
      productCount: inventory.length,
      serviceCount: services.length,
      lowStockCount
    }
  }, [inventory, services])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Valor del Inventario
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.totalValue.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.productCount} productos físicos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Servicios Activos
          </CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.serviceCount}</div>
          <p className="text-xs text-muted-foreground">
            Catálogo de reparaciones
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Alertas de Stock
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.lowStockCount}</div>
          <p className="text-xs text-muted-foreground">
            Productos con stock bajo
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 3.3 InventoryTabs
```typescript
// src/app/dashboard/repairs/inventory/components/InventoryTabs.tsx
"use client"

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { InventoryTab } from './tabs/InventoryTab'
import { ServicesTab } from './tabs/ServicesTab'
import { MovementsTab } from './tabs/MovementsTab'

export function InventoryTabs() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="overview">Repuestos</TabsTrigger>
        <TabsTrigger value="services">Servicios</TabsTrigger>
        <TabsTrigger value="movements">Movimientos</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <InventoryTab />
      </TabsContent>

      <TabsContent value="services">
        <ServicesTab />
      </TabsContent>

      <TabsContent value="movements">
        <MovementsTab />
      </TabsContent>
    </Tabs>
  )
}
```

---

### PASO 4: Implementar Virtualización (1 hora)

Ya creado en: `src/app/dashboard/repairs/inventory/components/InventoryTable.tsx`

**Nota importante**: Necesitas instalar la dependencia:
```bash
npm install @tanstack/react-virtual
```

---

### PASO 5: Migrar Página Principal (30 min)

#### 5.1 Respaldar página actual
```bash
cp src/app/dashboard/repairs/inventory/page.tsx src/app/dashboard/repairs/inventory/page.tsx.backup
```

#### 5.2 Reemplazar con versión refactorizada
Usar el contenido de `REFACTOR_EXAMPLE.tsx` como base

#### 5.3 Crear componentes faltantes
- `InventorySkeleton.tsx`
- `tabs/InventoryTab.tsx`
- `tabs/ServicesTab.tsx`
- `tabs/MovementsTab.tsx`

---

### PASO 6: Testing (1 hora)

#### 6.1 Crear tests básicos
```typescript
// src/app/dashboard/repairs/inventory/__tests__/InventoryContext.test.tsx
import { renderHook } from '@testing-library/react'
import { InventoryProvider, useInventory } from '../context/InventoryContext'

describe('InventoryContext', () => {
  it('should provide inventory data', () => {
    const wrapper = ({ children }) => (
      <InventoryProvider>{children}</InventoryProvider>
    )
    
    const { result } = renderHook(() => useInventory(), { wrapper })
    
    expect(result.current).toBeDefined()
    expect(result.current.products).toBeDefined()
    expect(result.current.services).toBeDefined()
  })
})
```

#### 6.2 Testing manual
1. Verificar que carga la lista de productos
2. Probar filtros
3. Probar creación de servicio
4. Probar eliminación
5. Verificar exportación PDF

---

### PASO 7: Optimización de Base de Datos (1 hora)

#### 7.1 Crear función RPC para filtros
```sql
-- supabase/migrations/20260115_inventory_filters_rpc.sql

CREATE OR REPLACE FUNCTION get_inventory_filtered(
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_stock_status TEXT DEFAULT 'all',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  category_id UUID,
  supplier_id UUID,
  sale_price NUMERIC,
  purchase_price NUMERIC,
  stock_quantity INT,
  min_stock INT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.category_id,
    p.supplier_id,
    p.sale_price,
    p.purchase_price,
    p.stock_quantity,
    p.min_stock,
    p.is_active,
    p.created_at
  FROM products p
  WHERE 
    (p_search IS NULL OR 
     p.name ILIKE '%' || p_search || '%' OR 
     p.sku ILIKE '%' || p_search || '%')
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (
      p_stock_status = 'all' OR
      (p_stock_status = 'low_stock' AND p.stock_quantity <= p.min_stock AND p.stock_quantity > 0) OR
      (p_stock_status = 'out_of_stock' AND p.stock_quantity = 0) OR
      (p_stock_status = 'in_stock' AND p.stock_quantity > 0)
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
```

#### 7.2 Agregar índices
```sql
-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
```

#### 7.3 Aplicar migración
```bash
# Si usas Supabase CLI
supabase db push

# O ejecuta manualmente en el dashboard de Supabase
```

---

### PASO 8: Implementar Caché con SWR (30 min)

#### 8.1 Actualizar InventoryContext para usar SWR
```typescript
import useSWR from 'swr'

// En InventoryContext.tsx
const { data: products, error, mutate } = useSWR(
  ['inventory', filters],
  () => fetchProducts(filters),
  {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    refreshInterval: 30000 // Refrescar cada 30s
  }
)
```

---

## ✅ Checklist de Verificación

### Funcionalidad
- [ ] Lista de productos carga correctamente
- [ ] Filtros funcionan (búsqueda, categoría, stock)
- [ ] Crear servicio funciona
- [ ] Editar servicio funciona
- [ ] Eliminar producto/servicio funciona
- [ ] Exportar PDF funciona
- [ ] Tab de movimientos carga datos
- [ ] Estadísticas se calculan correctamente

### Rendimiento
- [ ] Tiempo de carga inicial < 1s
- [ ] Scroll fluido (60 FPS)
- [ ] Filtrado instantáneo (< 100ms)
- [ ] Sin re-renders innecesarios (verificar con React DevTools)

### UX
- [ ] Loading states visibles
- [ ] Mensajes de error claros
- [ ] Confirmaciones antes de eliminar
- [ ] Feedback visual en todas las acciones

### Código
- [ ] Sin errores de TypeScript
- [ ] Sin warnings en consola
- [ ] Código formateado (prettier)
- [ ] Imports organizados

---

## 🐛 Troubleshooting

### Error: "useInventory must be used within InventoryProvider"
**Solución**: Asegúrate de que todos los componentes que usan `useInventory()` estén dentro de `<InventoryProvider>`

### Error: "Cannot find module '@tanstack/react-virtual'"
**Solución**: 
```bash
npm install @tanstack/react-virtual
```

### Tabla no se renderiza correctamente
**Solución**: Verifica que el contenedor padre tenga altura definida:
```css
style={{ height: '600px' }}
```

### Filtros no funcionan
**Solución**: Verifica que `setFilters` esté sincronizando con Supabase:
```typescript
setSupabaseFilters({
  search: newFilters.search,
  category: newFilters.category === 'all' ? '' : newFilters.category,
  stockStatus: newFilters.stockStatus
})
```

---

## 📊 Métricas de Éxito

### Antes
- Tiempo de carga: ~3s
- Líneas de código (page.tsx): 700+
- Re-renders por acción: ~15
- Memoria: ~150MB

### Después (Objetivo)
- Tiempo de carga: <1s (-67%)
- Líneas de código (page.tsx): <100 (-86%)
- Re-renders por acción: <5 (-67%)
- Memoria: <80MB (-47%)

---

## 🎓 Recursos Adicionales

- [React Virtual Docs](https://tanstack.com/virtual/v3)
- [SWR Documentation](https://swr.vercel.app/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Supabase RPC](https://supabase.com/docs/guides/database/functions)

---

## 📝 Notas Finales

1. **Implementación gradual**: No es necesario hacer todo de una vez. Puedes implementar por fases.

2. **Testing continuo**: Prueba cada cambio antes de continuar al siguiente paso.

3. **Backup**: Mantén siempre un backup del código funcional.

4. **Documentación**: Actualiza la documentación a medida que implementas cambios.

5. **Comunicación**: Informa al equipo sobre los cambios y nuevas estructuras.

---

**Última actualización**: 15 de Enero, 2026
**Tiempo estimado total**: 6-8 horas
**Dificultad**: Media-Alta
