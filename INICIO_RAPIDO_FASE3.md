# 🚀 Inicio Rápido - Fase 3

## Guía de 5 Minutos para Empezar

Esta guía te ayudará a comenzar a usar las funcionalidades de la Fase 3 en menos de 5 minutos.

---

## 📦 Paso 1: Instalar Dependencias (30 segundos)

```bash
npm install idb
```

**Nota**: `date-fns` ya está instalado en el proyecto.

---

## ✅ Paso 2: Verificar Instalación (10 segundos)

```bash
npm list idb
```

Deberías ver: `idb@8.0.0`

---

## 🔧 Paso 3: Importar en page.tsx (1 minuto)

Agrega estos imports al inicio de tu archivo `page.tsx`:

```typescript
// Fase 3 - Modo Offline
import { useOfflineMode } from './hooks/useOfflineMode'
import { offlineManager } from './lib/offline-manager'

// Fase 3 - Analytics
import { usePOSAnalytics } from './hooks/usePOSAnalytics'

// Fase 3 - Recomendaciones
import { useSmartSuggestions } from './hooks/useSmartSuggestions'

// Fase 3 - Historial
import { useSearchHistory } from './hooks/useSearchHistory'
```

---

## 🎯 Paso 4: Usar los Hooks (2 minutos)

Dentro de tu componente `POSPage`:

```typescript
export default function POSPage() {
  // Inicializar hooks de Fase 3
  const offline = useOfflineMode()
  const analytics = usePOSAnalytics()
  const suggestions = useSmartSuggestions(
    cart.map(item => item.product_id),
    selectedCustomer?.id
  )
  const history = useSearchHistory()

  // Inicializar modo offline
  useEffect(() => {
    offline.initialize()
  }, [])

  // ... resto del código
}
```

---

## 🎨 Paso 5: Agregar Indicadores Visuales (1 minuto)

### Indicador de Estado Offline

```typescript
{/* En tu UI, agrega: */}
<div className="flex items-center gap-2">
  {offline.isOnline ? (
    <span className="text-green-600">🌐 En línea</span>
  ) : (
    <span className="text-yellow-600">📴 Sin conexión</span>
  )}
  
  {offline.stats?.pendingSales > 0 && (
    <span className="text-sm">
      ({offline.stats.pendingSales} ventas pendientes)
    </span>
  )}
</div>
```

### Métricas de Hoy

```typescript
{/* Mostrar métricas */}
{analytics.todayMetrics && (
  <div className="p-4 border rounded">
    <h3 className="font-semibold">Ventas de Hoy</h3>
    <p className="text-2xl">${analytics.todayMetrics.totalRevenue.toFixed(2)}</p>
    <p className="text-sm text-muted-foreground">
      {analytics.todayMetrics.totalSales} ventas
    </p>
  </div>
)}
```

### Recomendaciones

```typescript
{/* Mostrar recomendaciones */}
{suggestions.recommendations.length > 0 && (
  <div className="mt-4 p-4 border rounded bg-blue-50">
    <h3 className="font-semibold mb-2">💡 Sugerencias</h3>
    {suggestions.recommendations.map(rec => (
      <div key={rec.product_id} className="flex justify-between items-center mb-2">
        <span>{rec.product_name}</span>
        <button onClick={() => addToCart(rec.product_id)}>
          Agregar
        </button>
      </div>
    ))}
  </div>
)}
```

---

## 🔄 Paso 6: Integrar en Flujo de Venta (30 segundos)

Cuando completes una venta, agrega:

```typescript
const handleCompleteSale = async (saleData) => {
  // ... tu código existente ...

  // Agregar a analytics
  analytics.addSale({
    id: sale.id,
    timestamp: new Date(),
    total: sale.total,
    subtotal: sale.subtotal,
    tax: sale.tax,
    items: sale.items,
    payment_method: sale.payment_method,
    customer_id: sale.customer_id,
    cashier_id: user.id
  })

  // Registrar para recomendaciones
  suggestions.recordPurchase(
    sale.items.map(item => item.product_id),
    sale.customer_id,
    sale.total
  )
}
```

---

## ✅ ¡Listo!

En solo 5 minutos has integrado:
- ✅ Modo offline con sincronización automática
- ✅ Analytics en tiempo real
- ✅ Recomendaciones inteligentes
- ✅ Historial de búsquedas

---

## 🎯 Próximos Pasos Opcionales

### Ver Estadísticas de Offline

```typescript
console.log('Offline Stats:', offline.stats)
// {
//   isOnline: true,
//   pendingSales: 0,
//   cachedProducts: 150,
//   storageUsed: 2048000,
//   storageQuota: 50000000
// }
```

### Ver Top Productos

```typescript
console.log('Top Products:', analytics.topProducts)
// [
//   { product_name: 'iPhone 13', quantity_sold: 15, revenue: 15000 },
//   { product_name: 'Samsung S21', quantity_sold: 12, revenue: 12000 },
//   ...
// ]
```

### Ver Recomendaciones

```typescript
console.log('Recommendations:', suggestions.recommendations)
// [
//   { product_name: 'Funda iPhone', reason: 'frequently_bought_together', confidence: 0.85 },
//   { product_name: 'Protector', reason: 'similar_category', confidence: 0.70 },
//   ...
// ]
```

### Ver Búsquedas Frecuentes

```typescript
console.log('Frequent Searches:', history.frequentSearches)
// [
//   { query: 'iphone', count: 45, last_used: Date },
//   { query: 'samsung', count: 32, last_used: Date },
//   ...
// ]
```

---

## 🐛 Troubleshooting Rápido

### Error: "Cannot find module 'idb'"

```bash
# Reinstalar
npm install idb
```

### Error: "Database not initialized"

```typescript
// Asegúrate de llamar initialize()
useEffect(() => {
  offline.initialize()
}, [])
```

### No se muestran recomendaciones

```typescript
// Verifica que el carrito tenga productos
console.log('Cart:', cart.map(item => item.product_id))

// Verifica que haya metadata de productos
recommendationEngine.setProductsMetadata(products.map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price
})))
```

---

## 📚 Documentación Completa

Para más detalles, consulta:
- `MEJORAS_POS_FASE3.md` - Documentación técnica completa
- `EJEMPLO_INTEGRACION_FASE3.md` - Ejemplos detallados
- `RESUMEN_FASE3_POS.md` - Resumen ejecutivo

---

## 🎉 ¡Felicidades!

Has integrado exitosamente las funcionalidades avanzadas de la Fase 3. Tu POS ahora tiene:

- 📴 **Modo Offline**: Opera sin conexión
- 📊 **Analytics**: Métricas en tiempo real
- 🧠 **Recomendaciones**: Sugerencias inteligentes
- 🔍 **Historial**: Búsquedas frecuentes

**¡Disfruta de tu POS mejorado!** 🚀

---

*Guía de inicio rápido - Enero 2026*
*Versión: 3.0.0*
*Tiempo estimado: 5 minutos*

